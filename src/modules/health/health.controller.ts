import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Health check básico" })
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>("NODE_ENV") || "development",
    };
  }

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  live() {
    return { status: "alive" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe (DB + Redis)" })
  async ready() {
    const checks: Record<string, string> = {};

    try {
      await this.dataSource.query("SELECT 1");
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    const allOk = Object.values(checks).every((s) => s === "ok");
    return { status: allOk ? "ok" : "degraded", checks };
  }
}
