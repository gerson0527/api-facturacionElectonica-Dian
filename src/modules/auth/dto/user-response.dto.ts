import { Exclude, Expose } from "class-transformer";
import { User } from "@/database/entities/user.entity";

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  tenantId: string;

  @Expose()
  email: string;

  @Expose()
  fullName: string;

  @Expose()
  role: string;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Exclude()
  hashedPassword: string;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.tenantId = user.tenantId;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.createdAt = (user as any).createdAt;
    dto.updatedAt = (user as any).updatedAt;
    return dto;
  }
}