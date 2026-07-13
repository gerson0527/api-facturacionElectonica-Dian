import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class CreateUserDto {
  @IsString()
  tenantId: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  fullName: string;

  @IsString()
  role: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Sesión cerrada exitosamente' };
  }

  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revocar todos los tokens de un usuario (admin)' })
  async revokeAll(@Body('userId') userId: string) {
    await this.authService.revokeAllUserTokens(userId);
    return { message: 'Tokens revocados exitosamente' };
  }

  @Post('users')
  @ApiOperation({ summary: 'Crear usuario' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(
      dto.tenantId,
      dto.email,
      dto.password,
      dto.fullName,
      dto.role,
    );
  }
}
