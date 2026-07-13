import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

export interface MailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailerService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>("MAIL_HOST") || "smtp.mailtrap.io",
      port: this.configService.get<number>("MAIL_PORT") || 2525,
      auth: {
        user: this.configService.get<string>("MAIL_USER") || "user",
        pass: this.configService.get<string>("MAIL_PASS") || "pass",
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      const from = this.configService.get<string>("MAIL_FROM") || "no-reply@facturacion.com";
      await this.transporter.sendMail({
        from,
        ...options,
      });
      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      this.logger.error(`Error sending email to ${options.to}: ${(error as Error).message}`);
      throw error;
    }
  }
}
