import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, BadRequestException } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const isProduction = process.env.NODE_ENV === "production";

  const bodySizeLimit = process.env.BODY_SIZE_LIMIT || "10mb";
  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));
  app.use(cookieParser());

  app.setGlobalPrefix("v1", {
    exclude: ["/docs", "/health", "/health/live", "/health/ready"],
  });

  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];

  const corsOptions: Record<string, unknown> = {
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization,X-Tenant-Id,Idempotency-Key",
    credentials: true,
  };

  if (corsOrigins.includes("*")) {
    if (isProduction || process.env.NODE_ENV === "habilitacion") {
      logger.error(
        "CORS_ALLOWED_ORIGINS contains wildcard in production/habilitacion; refusing to start",
      );
      process.exit(1);
    }
    corsOptions.origin = "*";
    corsOptions.credentials = false;
  } else {
    corsOptions.origin = corsOrigins;
  }

  app.enableCors(corsOptions as any);

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:"],
              connectSrc: ["'self'"],
            },
          }
        : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      hidePoweredBy: true,
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  if (isProduction || process.env.TRUST_PROXY) {
    const proxyConfig =
      process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal";
    app.getHttpAdapter().getInstance().set("trust proxy", proxyConfig);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Surface validation errors in logs and response
      exceptionFactory: (errors) => {
        const logger = new Logger('Validation');
        const msg = errors
          .map((e) => `${e.property}: ${Object.values(e.constraints || {}).join(', ')}`)
          .join('; ');
        logger.warn(`Validation failed: ${msg}`);
        return new BadRequestException({ message: 'Validation failed', errors: msg });
      },
    }),
  );

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED !== "false" && !isProduction;
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle("API Facturación Electrónica DIAN")
      .setDescription(
        "API SaaS multiempresa para facturación electrónica DIAN - Anexo Técnico 1.9",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .addApiKey(
        { type: "apiKey", name: "X-Tenant-Id", in: "header" },
        "X-Tenant-Id",
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs at http://localhost:${port}/docs`);
  }
  logger.log(`Health check at http://localhost:${port}/health`);
  logger.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  logger.log(`CORS origins: ${corsOrigins.join(", ")}`);
}

bootstrap().catch((err) => {
  Logger.error("Bootstrap failed", err.stack);
  process.exit(1);
});
