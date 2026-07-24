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
import { InvoicePayment } from "@/database/entities/invoice-payment.entity";
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

import { CashSession } from "@/database/entities/cash-session.entity";
import { CashRegister } from "@/database/entities/cash-register.entity";

export const INVOICE_STATES = {
  DRAFT: "draft",
  QUEUED: "queued",
  SIGNING: "signing",
  SIGNED: "signed",
  SUBMITTED: "submitted",
  PENDING_DIAN: "pending_dian",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  TRANSMISSION_FAILED: "transmission_failed",
};

export const INVOICE_STATE_TRANSITIONS: Record<string, string[]> = {
  [INVOICE_STATES.DRAFT]: [INVOICE_STATES.QUEUED],
  [INVOICE_STATES.QUEUED]: [INVOICE_STATES.SIGNING],
  [INVOICE_STATES.SIGNING]: [INVOICE_STATES.SIGNED, INVOICE_STATES.TRANSMISSION_FAILED],
  [INVOICE_STATES.SIGNED]: [INVOICE_STATES.SUBMITTED, INVOICE_STATES.TRANSMISSION_FAILED],
  [INVOICE_STATES.SUBMITTED]: [INVOICE_STATES.PENDING_DIAN, INVOICE_STATES.TRANSMISSION_FAILED],
  [INVOICE_STATES.PENDING_DIAN]: [INVOICE_STATES.ACCEPTED, INVOICE_STATES.REJECTED, INVOICE_STATES.TRANSMISSION_FAILED],
  [INVOICE_STATES.TRANSMISSION_FAILED]: [INVOICE_STATES.QUEUED],
  [INVOICE_STATES.ACCEPTED]: [],
  [INVOICE_STATES.REJECTED]: [],
};

export interface CreateInvoiceInput {
  invoiceType?: string;
  paymentFormCode?: string;
  paymentMethodCode?: string;
  issueDate: string;
  dueDate?: string;
  customerId: string;
  prefix: string;
  idempotencyKey: string;
  cashRegisterId?: string;
  cashSessionId?: string;
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

  async transitionState(
    manager: import("typeorm").EntityManager,
    invoice: Invoice,
    newState: string,
  ): Promise<Invoice> {
    const allowedTransitions = INVOICE_STATE_TRANSITIONS[invoice.status] || [];
    if (!allowedTransitions.includes(newState)) {
      throw new ConflictException(
        `Transición de estado inválida: no se puede pasar de '${invoice.status}' a '${newState}'`,
      );
    }

    // El @VersionColumn() en Invoice maneja el lock optimista automáticamente al guardar.
    invoice.status = newState;
    return manager.save(Invoice, invoice);
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

        // Get software credentials (optional for offline billing)
        const softwareCreds = await this.softwareCredRepo.findOne({
          where: { tenantId },
        });
        let softwarePin = '00000';
        if (softwareCreds) {
          try {
            softwarePin = await this.softwareCredentialsService.decryptPin(softwareCreds);
          } catch {
            softwarePin = '00000';
          }
        }

        // Get active certificate (optional for offline billing)
        const cert = await this.certRepo.findOne({
          where: { tenant: { id: tenantId }, isActive: true },
        });

        // Business validations
        const subtotal = input.lines.reduce(
          (sum, l) => sum.add(new Money(String(l.lineExtensionAmount || new Money(String(l.quantity)).multiply(String(l.unitPrice)).toExactString()))),
          new Money("0"),
        );
        const totalTax = input.taxTotals.reduce((sum, t) => sum.add(new Money(String(t.taxAmount))), new Money("0"));
        const totalAmount = subtotal.add(totalTax);

        this.validationsService.validateInvoice({
          lines: input.lines.map((l) => ({
            lineExtensionAmount: Number(l.lineExtensionAmount || new Money(String(l.quantity)).multiply(String(l.unitPrice)).toExactString()),
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxCode: l.taxCode || "01",
            taxPercent: l.taxPercent || 0,
            taxAmount: l.taxAmount || 0,
          })),
          taxTotals: input.taxTotals,
          subtotal: subtotal.toExactString() as any,
          totalTax: totalTax.toExactString() as any,
          totalAmount: totalAmount.toExactString() as any,
          customerDocumentType: customer.documentType,
          customerDocumentNumber: customer.documentNumber,
          issueDate: input.issueDate,
          paymentFormCode: input.paymentFormCode || "1",
          prefix: input.prefix,
        });

        // Reserve consecutive number
        const { number, rangeId } =
          await this.numberingRangesService.reserveNextNumber(
            tenantId,
            input.prefix,
            manager,
          );

        const numberingRange = await manager.findOne(NumberingRange, {
          where: { id: rangeId },
        });
        const formatDate = (d: Date | string | null | undefined): string => {
          if (!d) return "";
          const dt = typeof d === "string" ? new Date(d) : d;
          if (isNaN(dt.getTime())) return "";
          return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
        };
        const authorizationPeriod = {
          startDate:
            formatDate(numberingRange?.validFrom) ||
            formatDate(numberingRange?.resolutionDate) ||
            "2020-01-01",
          endDate:
            formatDate(numberingRange?.validTo) || "2099-12-31",
        };

        // Calculate taxes per DIAN category for CUFE
        let valIva = new Money("0");
        let valAdicional = new Money("0");

        for (const tax of input.taxTotals) {
          if (tax.taxId === "01") {
            valIva = valIva.add(new Money(String(tax.taxAmount)));
          } else if (["04", "22", "34", "35"].includes(tax.taxId)) {
            // INC and Impuestos Saludables
            valAdicional = valAdicional.add(new Money(String(tax.taxAmount)));
          }
        }

        const issueDate = new Date(input.issueDate);
        const cufeInput = {
          numFac: number,
          fecFac: issueDate.toISOString().split("T")[0],
          horFac:
            issueDate.toISOString().split("T")[1]?.split(".")[0] || "00:00:00",
          valBruto: subtotal.toFixed(2),
          valIva: valIva.toFixed(2),
          valAdicional: valAdicional.toFixed(2),
          valTotal: totalAmount.toFixed(2),
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

        // Resolve Cash Session & Cash Register for every invoice
        let resolvedSessionId = input.cashSessionId;
        let resolvedRegisterId = input.cashRegisterId;
        if (!resolvedSessionId || !resolvedRegisterId) {
          const openSession = await manager.findOne(CashSession, { where: { tenantId, status: 'open' } });
          if (openSession) {
            resolvedSessionId = resolvedSessionId || openSession.id;
            resolvedRegisterId = resolvedRegisterId || openSession.cashRegisterId;
          } else if (!resolvedRegisterId) {
            const defaultReg = await manager.findOne(CashRegister, { where: { tenantId, active: true } });
            if (defaultReg) {
              resolvedRegisterId = defaultReg.id;
            }
          }
        }

        // Create invoice entity
        const invoice = manager.create(Invoice, {
          tenantId,
          prefix: input.prefix,
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
          cashRegisterId: resolvedRegisterId,
          cashSessionId: resolvedSessionId,
          subtotal: subtotal.toExactString() as any,
          totalTax: totalTax.toExactString() as any,
          totalAmount: totalAmount.toExactString() as any,
          status: INVOICE_STATES.DRAFT,
          cufe,
          qrCode,
          idempotencyKey: (input.idempotencyKey && input.idempotencyKey.length === 36 && input.idempotencyKey.includes('-'))
            ? input.idempotencyKey
            : uuidv4(),
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

        // Generate PDF document (always generated)
        const pdfDir = path.join(this.storagePath, "pdf", tenantId);
        await fs.mkdir(pdfDir, { recursive: true });
        const pdfFileName = `${number.replace(/\s/g, "_")}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFileName);
        await this.pdfQrService.generatePdf(
          number,
          customer.name,
          customer.documentNumber,
          input.issueDate,
          subtotal.toExactString(),
          totalTax.toExactString(),
          totalAmount.toExactString(),
          cufe,
          tenant.name,
          tenant.nit,
          pdfPath,
        );
        savedInvoice.pdfPath = pdfPath;

        // If DIAN credentials & certificate exist, build & sign XML and submission
        if (softwareCreds && cert) {
          try {
            // Load payments (supports split / mixed payments from POS)
            const invoicePayments = await manager.find(InvoicePayment, {
              where: { invoiceId: invoice.id },
              order: { createdAt: 'ASC' },
            });

            const xmlData: InvoiceXmlData = {
              number,
              issueDate: issueDate.toISOString().split("T")[0],
              issueTime:
                issueDate.toISOString().split("T")[1]?.split(".")[0] || "00:00:00",
              invoiceType: input.invoiceType || "01",
              paymentFormCode: input.paymentFormCode || "1",
              paymentMethodCode: input.paymentMethodCode || "10",
              payments: invoicePayments.map(p => ({
                paymentMethodCode: p.paymentMethodCode,
                amount: Number(p.amount),
                paidDate: p.paidAt || issueDate.toISOString().split("T")[0],
                reference: p.reference || undefined,
              })),
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
              subtotal: subtotal.toExactString() as any,
              totalTax: totalTax.toExactString() as any,
              totalAmount: totalAmount.toExactString() as any,
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
              authorizationPeriod,
            };

            const xmlContent = await this.xmlBuilderService.buildInvoiceXml(xmlData);
            await this.xmlBuilderService.validateAgainstXsd(xmlContent);

            const xmlDir = path.join(this.storagePath, "xml", tenantId);
            await fs.mkdir(xmlDir, { recursive: true });
            const xmlFileName = `${number.replace(/\s/g, "_")}.xml`;
            const xmlPath = path.join(xmlDir, xmlFileName);
            await fs.writeFile(xmlPath, xmlContent, "utf-8");

            const { pfxBuffer, password } =
              await this.certificatesService.getDecryptedPfx(cert.id, tenantId);
            const { signedXml } = await this.signingService.signXmlFromBuffer(
              xmlContent,
              pfxBuffer,
              password,
            );

            const signedXmlFileName = `signed_${number.replace(/\s/g, "_")}.xml`;
            const signedXmlPath = path.join(xmlDir, signedXmlFileName);
            await fs.writeFile(signedXmlPath, signedXml, "utf-8");

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

            savedInvoice.xmlPath = xmlPath;
            savedInvoice.signedXmlPath = signedXmlPath;
            await this.transitionState(manager, savedInvoice, INVOICE_STATES.QUEUED);

            const submission = manager.create(DianSubmission, {
              tenantId,
              invoiceId: savedInvoice.id,
              documentType: "invoice",
              attemptNumber: 1,
              status: "pending",
              requestZipPath: zipPath,
            });
            await manager.save(submission);
          } catch (e: any) {
            this.logger.warn(`Electrónica opcional omitida por error o falta de config: ${e.message}`);
          }
        } else {
          this.logger.log(`Factura creada sin envío electrónico (faltan credenciales/certificado DIAN). PDF disponible.`);
        }

        const finalInvoice = await manager.save(Invoice, savedInvoice);
        return { snapshot: finalInvoice, statusCode: 201 };
      },
    );
  }

  async findAll(
    tenantId: string,
    options: { limit?: number; offset?: number; status?: string },
  ): Promise<{ data: Invoice[]; total: number }> {
    try {
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
    } catch (e) {
      this.logger.error(`findAll query failed: ${(e as Error).message}`, (e as Error).stack);
      const where: any = { tenantId };
      if (options.status) where.status = options.status;
      const data = await this.invoiceRepo.find({
        where,
        order: { createdAt: "DESC" },
        take: options.limit || 50,
        skip: options.offset || 0,
      });
      const total = await this.invoiceRepo.count({ where });
      return { data, total };
    }
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
