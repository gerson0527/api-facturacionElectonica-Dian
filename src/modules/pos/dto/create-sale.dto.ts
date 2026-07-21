import { IsString, IsUUID, IsNumber, IsArray, ValidateNested, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

export class CreateSaleDto {
  @IsUUID()
  sessionId: string;

  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsString()
  paymentMethod: string;

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
}
