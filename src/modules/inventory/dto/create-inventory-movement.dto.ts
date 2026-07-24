import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MovementType } from '../../../database/entities/inventory-movement.entity';

export class CreateInventoryMovementDto {
  @IsUUID()
  productId: string;

  @IsEnum(MovementType, { message: 'type must be IN, OUT, ADJUST, or TRANSFER' })
  type: MovementType;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}