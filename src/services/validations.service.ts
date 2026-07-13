import { Injectable, BadRequestException, Logger } from "@nestjs/common";

export interface InvoiceValidationInput {
  lines: Array<{
    lineExtensionAmount: number;
    quantity: number;
    unitPrice: number;
    taxCode: string;
    taxPercent: number;
    taxAmount: number;
  }>;
  taxTotals: Array<{
    taxId: string;
    taxPercent: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  customerDocumentType: string;
  customerDocumentNumber: string;
  issueDate: string;
  paymentFormCode: string;
  prefix: string;
}

const VALID_TAX_CODES = ["01", "02", "03", "04", "05", "06", "07", "08"];
const VALID_DOC_TYPES = ["11", "12", "13", "31"];
const VALID_PAYMENT_FORMS = ["1", "2", "3", "4", "5"];
const VALID_TAX_PERCENTS = [0, 5, 19];

const TAX_CODE_PATTERN = /^(01|02|03|04|05|06|07|08)$/;
const NIT_PATTERN = /^\d{8,10}$/;
const CC_PATTERN = /^\d{5,10}$/;
const DOC_NUMBER_PATTERN = /^[a-zA-Z0-9]{4,20}$/;

@Injectable()
export class ValidationsService {
  private readonly logger = new Logger(ValidationsService.name);

  validateInvoice(input: InvoiceValidationInput): void {
    this.validateLines(input);
    this.validateTaxTotals(input);
    this.validateTotals(input);
    this.validateDocument(
      input.customerDocumentType,
      input.customerDocumentNumber,
    );
    this.validatePaymentForm(input.paymentFormCode);
    this.validatePrefix(input.prefix);
    this.validateIssueDate(input.issueDate);
  }

  private validateLines(input: InvoiceValidationInput): void {
    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException(
        "Debe incluir al menos una línea de factura",
      );
    }

    if (input.lines.length > 500) {
      throw new BadRequestException("Máximo 500 líneas por factura");
    }

    let calculatedSubtotal = 0;
    for (const [index, line] of input.lines.entries()) {
      const lineNum = index + 1;

      if (line.quantity <= 0) {
        throw new BadRequestException(
          `Línea ${lineNum}: cantidad debe ser mayor a 0`,
        );
      }

      if (line.unitPrice < 0) {
        throw new BadRequestException(
          `Línea ${lineNum}: precio unitario no puede ser negativo`,
        );
      }

      const expectedAmount = parseFloat(
        (line.quantity * line.unitPrice).toFixed(2),
      );
      if (Math.abs(line.lineExtensionAmount - expectedAmount) > 1) {
        throw new BadRequestException(
          `Línea ${lineNum}: monto total (${line.lineExtensionAmount}) no coincide con cantidad x precio unitario (${expectedAmount})`,
        );
      }

      if (!TAX_CODE_PATTERN.test(line.taxCode)) {
        throw new BadRequestException(
          `Línea ${lineNum}: código de impuesto inválido (${line.taxCode}). Valores: ${VALID_TAX_CODES.join(", ")}`,
        );
      }

      if (
        line.taxCode === "01" &&
        !VALID_TAX_PERCENTS.includes(line.taxPercent)
      ) {
        throw new BadRequestException(
          `Línea ${lineNum}: porcentaje de IVA inválido (${line.taxPercent}%). Valores válidos: ${VALID_TAX_PERCENTS.join(", ")}`,
        );
      }

      if (line.taxPercent < 0 || line.taxPercent > 100) {
        throw new BadRequestException(
          `Línea ${lineNum}: porcentaje de impuesto fuera de rango (0-100)`,
        );
      }

      calculatedSubtotal += line.lineExtensionAmount;
    }

    calculatedSubtotal = parseFloat(calculatedSubtotal.toFixed(2));
    if (Math.abs(calculatedSubtotal - input.subtotal) > 1) {
      throw new BadRequestException(
        `Subtotal calculado (${calculatedSubtotal}) no coincide con subtotal declarado (${input.subtotal})`,
      );
    }
  }

  private validateTaxTotals(input: InvoiceValidationInput): void {
    if (!input.taxTotals || input.taxTotals.length === 0) {
      throw new BadRequestException(
        "Debe incluir al menos un total de impuesto",
      );
    }

    let calculatedTotalTax = 0;
    for (const [index, tax] of input.taxTotals.entries()) {
      if (!TAX_CODE_PATTERN.test(tax.taxId)) {
        throw new BadRequestException(
          `Impuesto ${index + 1}: código inválido (${tax.taxId})`,
        );
      }

      if (tax.taxPercent < 0 || tax.taxPercent > 100) {
        throw new BadRequestException(
          `Impuesto ${index + 1}: porcentaje fuera de rango`,
        );
      }

      if (tax.taxableAmount < 0) {
        throw new BadRequestException(
          `Impuesto ${index + 1}: base imponible no puede ser negativa`,
        );
      }

      if (tax.taxAmount < 0) {
        throw new BadRequestException(
          `Impuesto ${index + 1}: valor de impuesto no puede ser negativo`,
        );
      }

      const expectedTax = parseFloat(
        (tax.taxableAmount * (tax.taxPercent / 100)).toFixed(2),
      );
      if (Math.abs(tax.taxAmount - expectedTax) > 1) {
        this.logger.warn(
          `Impuesto ${index + 1}: valor (${tax.taxAmount}) difiere del esperado (${expectedTax}) al ${tax.taxPercent}% de ${tax.taxableAmount}`,
        );
      }

      calculatedTotalTax += tax.taxAmount;
    }

    calculatedTotalTax = parseFloat(calculatedTotalTax.toFixed(2));
    if (Math.abs(calculatedTotalTax - input.totalTax) > 1) {
      throw new BadRequestException(
        `Total impuestos calculado (${calculatedTotalTax}) no coincide con total declarado (${input.totalTax})`,
      );
    }
  }

  private validateTotals(input: InvoiceValidationInput): void {
    const expectedTotal = parseFloat(
      (input.subtotal + input.totalTax).toFixed(2),
    );
    if (Math.abs(expectedTotal - input.totalAmount) > 1) {
      throw new BadRequestException(
        `Total calculado (subtotal + impuestos = ${expectedTotal}) no coincide con total declarado (${input.totalAmount})`,
      );
    }

    if (input.subtotal < 0) {
      throw new BadRequestException("Subtotal no puede ser negativo");
    }

    if (input.totalAmount <= 0) {
      throw new BadRequestException("Total debe ser mayor a 0");
    }
  }

  private validateDocument(documentType: string, documentNumber: string): void {
    if (!VALID_DOC_TYPES.includes(documentType)) {
      throw new BadRequestException(
        `Tipo de documento inválido (${documentType}). Valores: ${VALID_DOC_TYPES.join(", ")}`,
      );
    }

    if (documentType === "31") {
      if (!NIT_PATTERN.test(documentNumber)) {
        throw new BadRequestException("NIT debe tener entre 8 y 10 dígitos");
      }
    } else if (documentType === "13") {
      if (!CC_PATTERN.test(documentNumber)) {
        throw new BadRequestException(
          "Cédula de ciudadanía debe tener entre 5 y 10 dígitos",
        );
      }
    } else if (!DOC_NUMBER_PATTERN.test(documentNumber)) {
      throw new BadRequestException("Formato de número de documento inválido");
    }
  }

  private validatePaymentForm(paymentFormCode: string): void {
    if (!VALID_PAYMENT_FORMS.includes(paymentFormCode)) {
      throw new BadRequestException(
        `Forma de pago inválida (${paymentFormCode}). Valores: ${VALID_PAYMENT_FORMS.join(", ")}`,
      );
    }
  }

  private validatePrefix(prefix: string): void {
    if (!prefix || prefix.trim().length === 0) {
      throw new BadRequestException("Prefijo de factura es requerido");
    }
    if (prefix.length > 10) {
      throw new BadRequestException("Prefijo no puede exceder 10 caracteres");
    }
    if (!/^[A-Za-z0-9]+$/.test(prefix)) {
      throw new BadRequestException(
        "Prefijo solo permite caracteres alfanuméricos",
      );
    }
  }

  private validateIssueDate(issueDate: string): void {
    const date = new Date(issueDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException("Fecha de emisión inválida");
    }
    const now = new Date();
    if (date > now) {
      throw new BadRequestException("La fecha de emisión no puede ser futura");
    }
    const maxPast = new Date();
    maxPast.setFullYear(maxPast.getFullYear() - 5);
    if (date < maxPast) {
      throw new BadRequestException(
        "La fecha de emisión no puede ser mayor a 5 años en el pasado",
      );
    }
  }
}
