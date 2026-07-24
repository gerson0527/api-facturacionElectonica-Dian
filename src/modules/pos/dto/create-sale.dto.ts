import {
  IsString,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsPositive,
  Min,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const DIAN_PAYMENT_CODES = [
  '10', // Efectivo
  '11', // Transferencia
  '12', // Cheque
  '13', // Transferencia bancaria
  '20', // Tarjeta crédito
  '21', // Tarjeta débito
  '30', // Bonos
  '41', // Nequi
  '42', // Daviplata
  '50', // Canje
  'ZZ', // Otros
];

export class SaleLineDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;
}

export class SalePaymentDto {
  @IsString()
  @IsIn(DIAN_PAYMENT_CODES, {
    message: `paymentMethodCode must be one of: ${DIAN_PAYMENT_CODES.join(', ')}`,
  })
  paymentMethodCode: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class CreateSaleDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  /**
   * Array of payments. Supports split/mixed payments.
   * Sum of all payment amounts must equal the invoice total.
   */
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one payment is required' })
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments: SalePaymentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleLineDto)
  lines: SaleLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  paymentFormCode?: string; // "1" contado, "2" crédito
}