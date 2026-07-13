import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Invoice } from "@/database/entities/invoice.entity";
import { MailerService } from "./mailer.service";
import { AttachedDocumentService } from "@/services/attached-document.service";
import * as fs from "fs/promises";
import * as path from "path";
import archiver = require("archiver");
import { Writable } from "stream";

@Processor("mailer")
export class MailerProcessor extends WorkerHost {
  private readonly logger = new Logger(MailerProcessor.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly mailerService: MailerService,
    private readonly attachedDocumentService: AttachedDocumentService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { invoiceId, tenantId } = job.data;
    this.logger.log(`Processing email for Invoice ${invoiceId}`);

    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, tenant: { id: tenantId } },
      relations: ["tenant", "customer"],
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (!invoice.customer || !invoice.customer.email) {
      this.logger.warn(`Invoice ${invoiceId} has no customer or email. Skipping.`);
      return;
    }

    if (!invoice.signedXmlPath || !invoice.dianResponsePath) {
      throw new Error(`Missing signed XML or DIAN response for Invoice ${invoiceId}`);
    }

    // Read original XMLs
    const signedInvoiceXml = await fs.readFile(invoice.signedXmlPath, "utf-8");
    const dianResponseXml = await fs.readFile(invoice.dianResponsePath, "utf-8");

    // Build AttachedDocument
    const attachedDocXml = this.attachedDocumentService.build({
      documentId: invoice.number,
      issueDate: invoice.issueDate.toISOString().split("T")[0],
      issueTime: invoice.createdAt.toISOString().split("T")[1].split(".")[0] + "-05:00", // approx
      issuer: {
        nit: invoice.tenant.nit,
        name: invoice.tenant.name,
      },
      customer: {
        documentType: invoice.customer.documentType,
        documentNumber: invoice.customer.documentNumber,
        name: invoice.customer.name,
      },
      signedInvoiceXml,
      applicationResponseXml: dianResponseXml,
      cufe: invoice.cufe,
      invoiceType: invoice.invoiceType,
    });

    // Create ZIP in memory
    const zipBuffer = await this.createZipBuffer(
      `AttachedDocument-${invoice.number}.xml`,
      attachedDocXml,
    );

    // Read PDF if exists
    let pdfBuffer: Buffer | undefined;
    if (invoice.pdfPath) {
      try {
        pdfBuffer = await fs.readFile(invoice.pdfPath);
      } catch (e) {
        this.logger.warn(`Could not read PDF for invoice ${invoice.id}: ${(e as Error).message}`);
      }
    }

    // Attachments
    const attachments = [
      {
        filename: `AttachedDocument-${invoice.number}.zip`,
        content: zipBuffer,
        contentType: "application/zip",
      },
    ];

    if (pdfBuffer) {
      attachments.push({
        filename: `Factura-${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }

    const html = `
      <h3>Factura Electrónica ${invoice.number}</h3>
      <p>Estimado(a) ${invoice.customer.name},</p>
      <p>Adjuntamos a este correo su factura electrónica y el respectivo XML legal autorizado por la DIAN (AttachedDocument).</p>
      <p>Atentamente,<br/>${invoice.tenant.name}</p>
    `;

    // Send email
    await this.mailerService.sendMail({
      to: invoice.customer.email,
      subject: `Factura Electrónica - ${invoice.number}`,
      html,
      attachments,
    });

    this.logger.log(`AttachedDocument email sent to ${invoice.customer.email}`);
  }

  private createZipBuffer(filename: string, content: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const outStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });

      const archive = archiver("zip", { zlib: { level: 9 } });

      outStream.on("finish", () => {
        resolve(Buffer.concat(chunks));
      });
      archive.on("error", (err: Error) => reject(err));

      archive.pipe(outStream);
      archive.append(content, { name: filename });
      archive.finalize();
    });
  }
}
