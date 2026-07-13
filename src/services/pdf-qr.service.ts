import { Injectable, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";
import * as QRCode from "qrcode";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import { join } from "path";

@Injectable()
export class PdfQrService {
  private readonly logger = new Logger(PdfQrService.name);

  async generatePdf(
    invoiceNumber: string,
    customerName: string,
    customerDocument: string,
    issueDate: string,
    subtotal: number,
    totalTax: number,
    totalAmount: number,
    cufe: string,
    issuerName: string,
    issuerNit: string,
    filePath: string,
  ): Promise<string> {
    const qrDataUrl = await QRCode.toDataURL(
      `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`,
      { width: 200, margin: 2 },
    );

    return new Promise<string>((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("FACTURA ELECTRÓNICA", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Número: ${invoiceNumber}`, { align: "center" });
      doc.moveDown(0.3);

      // Issuer info
      doc.fontSize(10).font("Helvetica-Bold").text("EMISOR:");
      doc.font("Helvetica").fontSize(9);
      doc.text(`Razón Social: ${issuerName}`);
      doc.text(`NIT: ${issuerNit}`);
      doc.moveDown(0.5);

      // Customer info
      doc.font("Helvetica-Bold").text("ADQUIRENTE:");
      doc.font("Helvetica").fontSize(9);
      doc.text(`Nombre: ${customerName}`);
      doc.text(`Documento: ${customerDocument}`);
      doc.text(`Fecha de Emisión: ${issueDate}`);
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      doc.font("Helvetica-Bold").fontSize(9);
      doc.text("Descripción", 50, tableTop, { width: 200 });
      doc.text("Cant.", 260, tableTop, { width: 50, align: "center" });
      doc.text("Precio", 310, tableTop, { width: 80, align: "right" });
      doc.text("Total", 400, tableTop, { width: 100, align: "right" });
      doc.moveDown(0.5);

      doc.font("Helvetica").fontSize(9);
      doc.text(`Venta`, 50, doc.y, { width: 200 });
      doc.text("1", 260, doc.y - 12, { width: 50, align: "center" });
      doc.text(`$${subtotal.toFixed(2)}`, 310, doc.y - 12, {
        width: 80,
        align: "right",
      });
      doc.text(`$${subtotal.toFixed(2)}`, 400, doc.y - 12, {
        width: 100,
        align: "right",
      });
      doc.moveDown(1);

      // Totals
      const totalsY = doc.y;
      doc.font("Helvetica").fontSize(9);
      doc.text("Subtotal:", 350, totalsY);
      doc.text(`$${subtotal.toFixed(2)}`, 400, totalsY, {
        width: 100,
        align: "right",
      });
      doc.text("Total Impuestos:", 350, doc.y + 15);
      doc.text(`$${totalTax.toFixed(2)}`, 400, doc.y, {
        width: 100,
        align: "right",
      });
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("TOTAL:", 350, doc.y + 20);
      doc.text(`$${totalAmount.toFixed(2)}`, 400, doc.y, {
        width: 100,
        align: "right",
      });
      doc.moveDown(2);

      // QR Code
      const qrY = doc.y + 20;
      doc.image(qrDataUrl, doc.page.width - 250, qrY, {
        width: 150,
        height: 150,
      });
      doc.fontSize(7).font("Helvetica");
      doc.text(`CUFE: ${cufe}`, 50, qrY + 10, { width: doc.page.width - 300 });

      // Footer
      doc
        .fontSize(7)
        .text(
          `Esta factura se asimila en todos sus efectos a una factura electrónica según la DIAN.`,
          50,
          doc.page.height - 80,
          { align: "center", width: doc.page.width - 100 },
        );
      doc.text(
        `Generado por: ${issuerName} | NIT: ${issuerNit}`,
        50,
        doc.page.height - 60,
        { align: "center", width: doc.page.width - 100 },
      );

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }
}
