import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RadianEvent } from "@/database/entities/radian-event.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { OutboxEvent } from "@/database/entities/outbox-event.entity";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { CufeService } from "@/services/cufe.service";
import { TenantRlsService } from "@/common/database/tenant-rls.service";
import { StorageService } from "@/services/storage.service";
import { XmlRadianBuilderService } from "@/services/xml-radian-builder.service";
import { v4 as uuidv4 } from "uuid";
import { ConfigService } from "@nestjs/config";
import archiver from "archiver";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class RadianService {
  private readonly logger = new Logger(RadianService.name);

  constructor(
    @InjectRepository(RadianEvent)
    private readonly radianRepo: Repository<RadianEvent>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    @InjectRepository(DianSubmission)
    private readonly submissionRepo: Repository<DianSubmission>,
    private readonly cufeService: CufeService,
    private readonly tenantRls: TenantRlsService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly xmlBuilder: XmlRadianBuilderService,
  ) {}

  async emitEvent(
    tenantId: string,
    invoiceId: string,
    eventCode: string,
    description: string,
    userId: string
  ) {
    await this.tenantRls.setSessionTenant(tenantId);

    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: ["customer", "tenant"],
    });

    if (!invoice) {
      throw new NotFoundException("Factura no encontrada");
    }

    if (!invoice.cufe) {
      throw new BadRequestException("La factura aún no tiene CUFE generado");
    }

    // Check if event already exists
    const existing = await this.radianRepo.findOne({
      where: { invoice: { id: invoiceId }, eventCode }
    });

    if (existing && existing.status !== "rejected" && existing.status !== "failed") {
      throw new BadRequestException(`El evento ${eventCode} ya fue emitido o está en proceso`);
    }

    const issueDate = new Date();
    const fecDoc = issueDate.toISOString().split("T")[0];
    const horDoc = issueDate.toISOString().split("T")[1].substring(0, 8) + "-05:00";

    const env = this.configService.get<string>("DIAN_ENVIRONMENT") === "produccion" ? "1" : "2";

    // CUDE Generation
    // NumDoc is usually the Event ID or a consecutive number for events. We will use a random or UUID prefix
    const eventId = `EVT${eventCode}${Date.now().toString().slice(-6)}`;
    
    // Software Pin for CUDE
    const creds = await this.radianRepo.manager.query(
      `SELECT software_pin, software_id FROM dian_software_credentials WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const pin = creds.length > 0 ? creds[0].software_pin : "12345";

    const cudeInput = {
      numFac: eventId,
      fecFac: fecDoc,
      horFac: horDoc,
      valBruto: "0.00",
      valIva: "0.00",
      valAdicional: "0.00",
      valTotal: "0.00",
      nitEmisor: invoice.customer.documentNumber, 
      dvEmisor: invoice.customer.dv || "0",
      tipoDocEmisor: invoice.customer.documentType,
      tipoDocAdquirente: invoice.tenant.nit, 
      numDocAdquirente: invoice.tenant.nit,
      dvAdquirente: invoice.tenant.dv || "0",
      softwarePin: pin,
      ambiente: env,
    };

    const cude = this.cufeService.generateCude(cudeInput);

    // Save RadianEvent
    const radianEvent = this.radianRepo.create({
      invoice,
      tenant: invoice.tenant,
      eventCode,
      cude,
      status: "pending",
    });
    await this.radianRepo.save(radianEvent);

    // Generate XML
    const xml = this.xmlBuilder.buildApplicationResponse({
      eventId,
      eventCode,
      eventDescription: description,
      issueDate: fecDoc,
      issueTime: horDoc,
      cude,
      environment: env,
      softwareId: creds.length > 0 ? creds[0].software_id : "",
      pin: pin,
      softwareSecurityCode: "HASH", // Should ideally calculate SHA384(softwareId + pin + eventId)
      tenant: {
        nit: invoice.tenant.nit,
        dv: invoice.tenant.dv || "0",
        name: invoice.tenant.name,
      },
      receiver: {
        nit: invoice.customer.documentNumber,
        dv: invoice.customer.dv || "0",
        name: invoice.customer.name,
      },
      invoice: {
        prefix: invoice.prefix,
        number: invoice.number,
        cufe: invoice.cufe,
        issueDate: invoice.issueDate.toISOString().split("T")[0],
      }
    });

    const xmlFileName = `Face_Evt_${tenantId}_${eventId}.xml`;
    const xmlPath = await this.storageService.save(tenantId, "xml", xmlFileName, xml);

    const zipFileName = `z_${tenantId}_${eventId}.zip`;
    const zipPath = this.storageService.getFullPath(tenantId, "xml", zipFileName);
    
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      archive.on("error", (err: any) => reject(err));
      archive.pipe(output);
      archive.append(Buffer.from(xml, "utf8"), { name: xmlFileName });
      archive.finalize();
    });

    radianEvent.xmlPath = xmlPath;
    await this.radianRepo.save(radianEvent);

    // Create DianSubmission
    const submission = this.submissionRepo.create({
      invoice,
      tenant: invoice.tenant,
      documentType: "ApplicationResponse",
      attemptNumber: 1,
      status: "pending",
      requestZipPath: zipPath,
    });
    await this.submissionRepo.save(submission);

    // Create OutboxEvent to process it asynchronously
    const outboxEvent = this.outboxRepo.create({
      tenantId: invoice.tenant.id,
      aggregateType: "RadianEvent",
      aggregateId: invoice.id, // OutboxRelayService expects aggregateId to be invoiceId
      eventType: "radian_event.created",
      payload: {
        eventId: radianEvent.id,
        eventCode,
        description,
        issueDate: fecDoc,
        issueTime: horDoc,
        cude,
      },
      status: "pending",
    });

    await this.outboxRepo.save(outboxEvent);

    this.logger.log(`Evento RADIAN ${eventCode} encolado para la factura ${invoiceId}`);

    return {
      success: true,
      eventId,
      cude,
      status: "pending",
    };
  }
}
