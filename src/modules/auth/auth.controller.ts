import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  Get,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Response, Request } from "express";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { CurrentUser, JwtPayload } from "@/common/decorators";
import {
  buildAccessCookieOptions,
  buildRefreshCookieOptions,
  buildClearAccessCookieOptions,
  buildClearRefreshCookieOptions,
} from "@/common/cookie.factory";
import { parseTtl } from "@/common/ttl.util";

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
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

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Iniciar sesión (devuelve cookies)" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto.email, dto.password);

    const isProduction = process.env.NODE_ENV === "production";
    const accessCookieName = isProduction ? "__Host-access" : "access";
    const refreshCookieName = isProduction ? "__Host-refresh" : "refresh";

    const accessTtl = process.env.JWT_ACCESS_EXPIRATION || "15m";
    const refreshTtl = process.env.JWT_REFRESH_EXPIRATION || "7d";

    res.cookie(accessCookieName, tokens.accessToken, {
      ...buildAccessCookieOptions(),
      maxAge: parseTtl(accessTtl),
    });
    res.cookie(refreshCookieName, tokens.refreshToken, {
      ...buildRefreshCookieOptions(),
      maxAge: parseTtl(refreshTtl),
    });

    return { message: "Login exitoso" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refrescar token desde cookie HttpOnly" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isProduction = process.env.NODE_ENV === "production";
    const accessCookieName = isProduction ? "__Host-access" : "access";
    const refreshCookieName = isProduction ? "__Host-refresh" : "refresh";
    const refreshToken = req.cookies?.[refreshCookieName];

    if (!refreshToken) {
      res
        .status(HttpStatus.UNAUTHORIZED)
        .send({ message: "No refresh token provided" });
      return;
    }

    const tokens = await this.authService.refresh(refreshToken);

    const accessTtl = process.env.JWT_ACCESS_EXPIRATION || "15m";
    const refreshTtl = process.env.JWT_REFRESH_EXPIRATION || "7d";

    res.cookie(accessCookieName, tokens.accessToken, {
      ...buildAccessCookieOptions(),
      maxAge: parseTtl(accessTtl),
    });
    res.cookie(refreshCookieName, tokens.refreshToken, {
      ...buildRefreshCookieOptions(),
      maxAge: parseTtl(refreshTtl),
    });

    return { message: "Token refrescado exitosamente" };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cerrar sesión (limpia cookies)" })
  async logout(
    @Req() req: Request,
    @Body() body: LogoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isProduction = process.env.NODE_ENV === "production";
    const accessCookieName = isProduction ? "__Host-access" : "access";
    const refreshCookieName = isProduction ? "__Host-refresh" : "refresh";

    const refreshToken =
      req.cookies?.[refreshCookieName] || body?.refreshToken;
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    res.clearCookie(accessCookieName, buildClearAccessCookieOptions());
    res.clearCookie(refreshCookieName, buildClearRefreshCookieOptions());

    return { message: "Logged out" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Obtener perfil del usuario autenticado" })
  getProfile(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Post("revoke-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revocar todos los tokens de un usuario (admin)" })
  async revokeAll(@Body("userId") userId: string) {
    await this.authService.revokeAllUserTokens(userId);
    return { message: "Tokens revocados exitosamente" };
  }

  @Post("users")
  @ApiOperation({ summary: "Crear usuario" })
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
