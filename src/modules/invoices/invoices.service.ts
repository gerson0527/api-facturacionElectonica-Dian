import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { Invoice } from "@/database/entities/invoice.entity";
import { InvoiceLine } from "@/database/entities/invoice-line.entity";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { TaxTotal } from "@/database/entities/tax-total.entity";
import { NumberingRange } from "@/database/entities/numbering-range.entity";
import { DianSoftwareCredential } from "@/database/entities/dian-software-credential.entity";
import { DigitalCertificate } from "@/database/entities/digital-certificate.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Customer } from "@/database/entities/customer.entity";
import { Tenant } from "@/database/entities/tenant.entity";
import { CufeService } from "@/services/cufe.service";
import {
  XmlBuilderService,
  InvoiceXmlData,
} from "@/services/xml-builder.service";
import { SigningService } from "@/services/signing.service";
import { DianSoapClient } from "@/services/dian-soap.client";
import { PdfQrService } from "@/services/pdf-qr.service";
import { IdempotencyService } from "@/services/idempotency.service";
import { ValidationsService } from "@/services/validations.service";
import { SoftwareCredentialsService } from "../software-credentials/software-credentials.service";
import { CertificatesService } from "../certificates/certificates.service";
import { NumberingRangesService } from "../numbering-ranges/numbering-ranges.service";
import * as fs from "fs/promises";
import * as path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";
import { v4 as uuidv4 } from "uuid";
import { Money } from "@/domain/value-objects/money.vo";

export interface CreateInvoiceInput {
  invoiceType?: string;
  paymentFormCode?: string;
  paymentMethodCode?: string;
  issueDate: string;
  dueDate?: string;
  customerId: string;
  prefix: string;
  idempotencyKey: string;
  lines: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitCode?: string;
    unitPrice: number;
    lineExtensionAmount?: number;
    taxCode?: string;
    taxPercent?: number;
    taxAmount?: number;
  }>;
  taxTotals: Array<{
    taxId: string;
    taxPercent: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly storagePath: string;

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly lineRepo: Repository<InvoiceLine>,
    @InjectRepository(TaxTotal)
    private readonly taxTotalRepo: Repository<TaxTotal>,
    @InjectRepository(NumberingRange)
    private readonly rangeRepo: Repository<NumberingRange>,
    @InjectRepository(DianSoftwareCredential)
    private readonly softwareCredRepo: Repository<DianSoftwareCredential>,
    @InjectRepository(DigitalCertificate)
    private readonly certRepo: Repository<DigitalCertificate>,
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectQueue("dian-submission") private submissionQueue: Queue,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly cufeService: CufeService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly signingService: SigningService,
    private readonly dianSoapClient: DianSoapClient,
    private readonly pdfQrService: PdfQrService,
    private readonly idempotencyService: IdempotencyService,
    private readonly softwareCredentialsService: SoftwareCredentialsService,
    private readonly certificatesService: CertificatesService,
    private readonly numberingRangesService: NumberingRangesService,
    private readonly validationsService: ValidationsService,
  ) {
    this.storagePath =
      this.configService.get<string>("STORAGE_PATH") || "./storage";
  }

  async create(
    tenantId: string,
    input: CreateInvoiceInput,
    actorId: string,
  ): Promise<any> {
    return this.idempotencyService.executeWithIdempotency(
      tenantId,
      input.idempotencyKey,
      input,
      this.invoiceRepo,
      async (payloadHash, manager) => {
        // Validate customer
        const customer = await this.customerRepo.findOne({
          where: { id: input.customerId, tenantId },
        });
        if (!customer) {
          throw new NotFoundException("Cliente no encontrado");
        }

        // Get tenant info
        const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
        if (!tenant) {
          throw new NotFoundException("Tenant no encontrado");
        }

        // Get software credentials
        const softwareCreds = await this.softwareCredRepo.findOne({
          where: { tenantId },
        });
        if (!softwareCreds) {
          throw new NotFoundException(
            "Credenciales de software DIAN no encontradas",
          );
        }
        const softwarePin =
          await this.softwareCredentialsService.decryptPin(softwareCreds);

        // Get active certificate
        const cert = await this.certRepo.findOne({
          where: { tenant: { id: tenantId }, isActive: true },
        });
        if (!cert) {
          throw new NotFoundException("Certificado digital no encontrado");
        }

        // Business validations
        const subtotal = input.lines.reduce(
          (sum, l) => sum.add(new Money(l.lineExtensionAmount || new Money(l.quantity).multiply(l.unitPrice).toNumber())),
          new Money(0),
        );
        const totalTax = input.taxTotals.reduce((sum, t) => sum.add(new Money(t.taxAmount)), new Money(0));
        const totalAmount = subtotal.add(totalTax);

        this.validationsService.validateInvoice({
          lines: input.lines.map((l) => ({
            lineExtensionAmount: l.lineExtensionAmount || new Money(l.quantity).multiply(l.unitPrice).toNumber(),
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxCode: l.taxCode || "01",
            taxPercent: l.taxPercent || 0,
            taxAmount: l.taxAmount || 0,
          })),
          taxTotals: input.taxTotals,
          subtotal: subtotal.toNumber(),
          totalTax: totalTax.toNumber(),
          totalAmount: totalAmount.toNumber(),
          customerDocumentType: customer.documentType,
          customerDocumentNumber: customer.documentNumber,
          issueDate: input.issueDate,
          paymentFormCode: input.paymentFormCode || "1",
          prefix: input.prefix,
        });

        // Reserve consecutive number
        const { number } = await this.numberingRangesService.reserveNextNumber(
          tenantId,
          input.prefix,
        );

        // Generate CUFE
        const issueDate = new Date(input.issueDate);
        const cufeInput = {
          numFac: number,
          fecFac: issueDate.toISOString().split("T")[0],
          horFac:
            issueDate.toISOString().split("T")[1]?.split(".")[0] || "00:00:00",
          valBruto: subtotal.toString(),
          valIva: totalTax.toString(),
          valAdicional: "0.00",
          valTotal: totalAmount.toString(),
          nitEmisor: tenant.nit,
          dvEmisor: tenant.dv,
          tipoDocEmisor: tenant.documentType || "31",
          tipoDocAdquirente: customer.documentType,
          numDocAdquirente: customer.documentNumber,
          dvAdquirente: customer.dv || "",
          softwarePin,
          ambiente: tenant.environment === "produccion" ? "2" : "1",
        };
        const cufe = this.cufeService.generate(cufeInput);

        // Build QR URL
        const qrCode = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;

        // Create invoice entity
        const invoice = manager.create(Invoice, {
          tenantId,
          number,
          invoiceType: input.invoiceType || "01",
          paymentFormCode: input.paymentFormCode || "1",
          paymentMethodCode: input.paymentMethodCode || "10",
          issueDate,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          customerId: customer.id,
          customerName: customer.name,
          customerDocument: customer.documentNumber,
          customerDocumentType: customer.documentType,
          subtotal: subtotal.toNumber(),
          totalTax: totalTax.toNumber(),
          totalAmount: totalAmount.toNumber(),
          status: "draft",
          cufe,
          qrCode,
          idempotencyKey: input.idempotencyKey,
          requestPayloadHash: payloadHash,
          responseStatusCode: 201,
        });
        const savedInvoice = await manager.save(invoice);

        // Save lines
        for (const lineInput of input.lines) {
          const line = manager.create(InvoiceLine, {
            tenantId,
            invoiceId: savedInvoice.id,
            lineNumber: lineInput.lineNumber,
            description: lineInput.description,
            quantity: lineInput.quantity,
            unitCode: lineInput.unitCode || "94",
            unitPrice: lineInput.unitPrice,
            lineExtensionAmount:
              lineInput.lineExtensionAmount ||
              lineInput.quantity * lineInput.unitPrice,
            taxCode: lineInput.taxCode || "01",
            taxPercent: lineInput.taxPercent || 19,
            taxAmount: lineInput.taxAmount || 0,
          });
          await manager.save(line);
        }

        for (const taxInput of input.taxTotals) {
          const tax = manager.create(TaxTotal, {
            tenantId,
            invoiceId: savedInvoice.id,
            taxAmount: taxInput.taxAmount,
            taxableAmount: taxInput.taxableAmount,
            taxId: taxInput.taxId,
            taxPercent: taxInput.taxPercent,
          });
          await manager.save(tax);
        }

        // Emit outbox event
        const outboxEvent = manager.create(OutboxEvent, {
          tenantId,
          aggregateType: "INVOICE",
          aggregateId: savedInvoice.id,
          eventType: "INVOICE_CREATED",
          payload: {
            invoiceId: savedInvoice.id,
            number: savedInvoice.number,
            cufe: savedInvoice.cufe,
          },
          status: "pending",
        });
        await manager.save(outboxEvent);

        const xmlData: InvoiceXmlData = {
          number,
          issueDate: issueDate.toISOString().split("T")[0],
          issueTime:
            issueDate.toISOString().split("T")[1]?.split(".")[0] || "00:00:00",
          invoiceType: input.invoiceType || "01",
          paymentFormCode: input.paymentFormCode || "1",
          paymentMethodCode: input.paymentMethodCode || "10",
          currencyCode: "COP",
          dueDate: input.dueDate,
          cufe,
          qrCode,
          softwareId: softwareCreds.softwareId,
          softwarePin,
          environment: tenant.environment,
          testSetId: softwareCreds.testSetId || "",
          issuer: {
            nit: tenant.nit,
            dv: tenant.dv,
            name: tenant.name,
            address: tenant.address || "N/A",
            phone: tenant.phone || "N/A",
            email: tenant.email || "N/A",
            municipalityCode: "11001",
            fiscalResponsibilities: ["O-99"],
          },
          customer: {
            documentType: customer.documentType,
            documentNumber: customer.documentNumber,
            dv: customer.dv,
            name: customer.name,
            address: customer.address || "N/A",
            phone: customer.phone || "N/A",
            email: customer.email || "N/A",
            municipalityCode: customer.municipalityCode || "11001",
            fiscalResponsibilities: customer.fiscalResponsibilities || ["O-99"],
          },
          taxTotals: input.taxTotals,
          subtotal: subtotal.toNumber(),
          totalTax: totalTax.toNumber(),
          totalAmount: totalAmount.toNumber(),
          lines: input.lines.map((l) => ({
            lineNumber: l.lineNumber,
            description: l.description,
            quantity: l.quantity,
            unitCode: l.unitCode || "94",
            unitPrice: l.unitPrice,
            lineExtensionAmount: l.lineExtensionAmount || l.quantity * l.unitPrice,
            taxCode: l.taxCode || "01",
            taxPercent: l.taxPercent || 19,
            taxAmount: l.taxAmount || 0,
          })),
        };

        const xmlContent = await this.xmlBuilderService.buildInvoiceXml(xmlData);

        // Validate against XSD
        await this.xmlBuilderService.validateAgainstXsd(xmlContent);

        // Save unsigned XML
        const xmlDir = path.join(this.storagePath, "xml", tenantId);
        await fs.mkdir(xmlDir, { recursive: true });
        const xmlFileName = `${number.replace(/\s/g, "_")}.xml`;
        const xmlPath = path.join(xmlDir, xmlFileName);
        await fs.writeFile(xmlPath, xmlContent, "utf-8");

        // Sign XML
        const { pfxBuffer, password } =
          await this.certificatesService.getDecryptedPfx(cert.id, tenantId);
        const { signedXml } = await this.signingService.signXmlFromBuffer(
          xmlContent,
          pfxBuffer,
          password,
        );

        // Save signed XML
        const signedXmlFileName = `signed_${number.replace(/\s/g, "_")}.xml`;
        const signedXmlPath = path.join(xmlDir, signedXmlFileName);
        await fs.writeFile(signedXmlPath, signedXml, "utf-8");

        // Create ZIP for DIAN
        const zipDir = path.join(this.storagePath, "dian", tenantId);
        await fs.mkdir(zipDir, { recursive: true });
        const zipFileName = `${number.replace(/\s/g, "_")}.zip`;
        const zipPath = path.join(zipDir, zipFileName);

        await new Promise<void>((resolve, reject) => {
          const output = createWriteStream(zipPath);
          const archive = archiver("zip", { zlib: { level: 9 } });
          output.on("close", () => resolve());
          archive.on("error", reject);
          archive.pipe(output);
          archive.append(signedXml, { name: "fa.xml" });
          archive.finalize();
        });

        // Generate PDF
        const pdfDir = path.join(this.storagePath, "pdf", tenantId);
        await fs.mkdir(pdfDir, { recursive: true });
        const pdfFileName = `${number.replace(/\s/g, "_")}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFileName);
        await this.pdfQrService.generatePdf(
          number,
          customer.name,
          customer.documentNumber,
          input.issueDate,
          subtotal.toNumber(),
          totalTax.toNumber(),
          totalAmount.toNumber(),
          cufe,
          tenant.name,
          tenant.nit,
          pdfPath,
        );

        // Update invoice with paths
        await manager.update(Invoice, savedInvoice.id, {
          xmlPath,
          signedXmlPath,
          pdfPath,
          status: "pending",
        });

        // Create submission record
        const submission = manager.create(DianSubmission, {
          tenantId,
          invoiceId: savedInvoice.id,
          documentType: "invoice",
          attemptNumber: 1,
          status: "pending",
          requestZipPath: zipPath,
        });
        await manager.save(submission);

        const finalInvoice = await manager.findOne(Invoice, {
          where: { id: savedInvoice.id },
        });

        await manager.update(Invoice, savedInvoice.id, {
          responseSnapshot: finalInvoice as any,
        });

        return { snapshot: finalInvoice, statusCode: 201 };
      },
    );
  }

  async findAll(
    tenantId: string,
    options: { limit?: number; offset?: number; status?: string },
  ): Promise<{ data: Invoice[]; total: number }> {
    const query = this.invoiceRepo
      .createQueryBuilder("i")
      .where("i.tenantId = :tenantId", { tenantId })
      .orderBy("i.createdAt", "DESC");

    if (options.status) {
      query.andWhere("i.status = :status", { status: options.status });
    }

    const [data, total] = await query
      .skip(options.offset || 0)
      .take(options.limit || 50)
      .getManyAndCount();

    return { data, total };
  }

  async findOne(id: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id, tenantId } });
    if (!invoice) {
      throw new NotFoundException("Factura no encontrada");
    }
    return invoice;
  }

  async getDianStatus(
    id: string,
    tenantId: string,
  ): Promise<{ invoice: Invoice; submissions: DianSubmission[] }> {
    const invoice = await this.findOne(id, tenantId);
    const submissions = await this.submissionRepo.find({
      where: { invoiceId: id, tenantId },
      order: { attemptNumber: "DESC" },
    });
    return { invoice, submissions };
  }

  async retrySubmission(id: string, tenantId: string): Promise<Invoice> {
    const invoice = await this.findOne(id, tenantId);
    if (invoice.status !== "rejected") {
      throw new ConflictException(
        "Solo se pueden reintentar facturas rechazadas",
      );
    }

    const submission = await this.submissionRepo.findOne({
      where: { invoiceId: id, tenantId },
      order: { attemptNumber: "DESC" },
    });
    if (!submission || !submission.requestZipPath) {
      throw new NotFoundException("No se encontró zip de envío");
    }

    const newAttempt = submission.attemptNumber + 1;
    const newSubmission = this.submissionRepo.create({
      tenantId,
      invoiceId: id,
      documentType: "invoice",
      attemptNumber: newAttempt,
      status: "pending",
      requestZipPath: submission.requestZipPath,
    });
    await this.submissionRepo.save(newSubmission);

    await this.invoiceRepo.update(id, { status: "pending" });

    await this.submissionQueue.add(
      "dian-submission",
      {
        submissionId: newSubmission.id,
        invoiceId: id,
        tenantId,
        zipPath: submission.requestZipPath,
      },
      {
        attempts:
          this.configService.get<number>("QUEUE_SUBMISSION_MAX_ATTEMPTS") || 5,
        backoff: { type: "exponential", delay: 30000 },
      },
    );

    return this.invoiceRepo.findOne({ where: { id } }) as Promise<Invoice>;
  }
}
