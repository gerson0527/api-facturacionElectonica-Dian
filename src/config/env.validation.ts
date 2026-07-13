import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid("development", "test", "habilitacion", "production")
    .default("development"),
  DB_HOST: Joi.string().default("localhost"),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow("").default(""),
  DB_DATABASE: Joi.string().required(),
  DB_CA_CERT: Joi.string().when("NODE_ENV", {
    is: "production",
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  }),
  TRUST_PROXY: Joi.string().optional().default("loopback"),
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().default(6379),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default("60m"),
  JWT_REFRESH_EXPIRATION: Joi.string().default("7d"),
  ENCRYPTION_KEY: Joi.string().length(64).hex().required(),
  ENCRYPTION_KEY_VERSION: Joi.number().default(1),
  DIAN_ENVIRONMENT: Joi.string()
    .valid("habilitacion", "produccion")
    .default("habilitacion"),
  DIAN_HABILITACION_URL: Joi.string()
    .uri()
    .default("https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc"),
  DIAN_PRODUCCION_URL: Joi.string()
    .uri()
    .default("https://vpfe.dian.gov.co/WcfDianCustomerServices.svc"),
  DIAN_TIMEOUT_CONNECTION: Joi.number().default(15000),
  DIAN_TIMEOUT_READ: Joi.number().default(60000),
  DIAN_TIMEOUT_TOTAL: Joi.number().default(120000),
  CORS_ALLOWED_ORIGINS: Joi.string().default("http://localhost:3000"),
  THROTTLER_TTL: Joi.number().default(60),
  THROTTLER_LIMIT: Joi.number().default(30),
  THROTTLER_LIMIT_LOGIN: Joi.number().default(5),
  STORAGE_PATH: Joi.string().default("./storage"),
  XSD_PATH: Joi.string().default("./xsd"),
  QUEUE_SUBMISSION_MAX_ATTEMPTS: Joi.number().default(5),
  QUEUE_STATUS_MAX_ATTEMPTS: Joi.number().default(5),
  BODY_SIZE_LIMIT: Joi.string().default("10mb"),
  MULTIPART_FILE_SIZE_LIMIT: Joi.number().default(5242880),
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug", "verbose")
    .default("info"),
});

export type EnvConfig = {
  PORT: number;
  NODE_ENV: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_CA_CERT?: string;
  TRUST_PROXY?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  ENCRYPTION_KEY: string;
  ENCRYPTION_KEY_VERSION: number;
  DIAN_ENVIRONMENT: string;
  DIAN_HABILITACION_URL: string;
  DIAN_PRODUCCION_URL: string;
  DIAN_TIMEOUT_CONNECTION: number;
  DIAN_TIMEOUT_READ: number;
  DIAN_TIMEOUT_TOTAL: number;
  CORS_ALLOWED_ORIGINS: string;
  THROTTLER_TTL: number;
  THROTTLER_LIMIT: number;
  THROTTLER_LIMIT_LOGIN: number;
  STORAGE_PATH: string;
  XSD_PATH: string;
  QUEUE_SUBMISSION_MAX_ATTEMPTS: number;
  QUEUE_STATUS_MAX_ATTEMPTS: number;
  BODY_SIZE_LIMIT: string;
  MULTIPART_FILE_SIZE_LIMIT: number;
  LOG_LEVEL: string;
};
