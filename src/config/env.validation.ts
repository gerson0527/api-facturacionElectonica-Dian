import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRATION: Joi.string().default('60m'),
  JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
  ENCRYPTION_KEY: Joi.string().length(64).hex().required(),
  DIAN_ENVIRONMENT: Joi.string().valid('habilitacion', 'produccion').default('habilitacion'),
  DIAN_HABILITACION_URL: Joi.string().uri().default('https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc'),
  DIAN_PRODUCCION_URL: Joi.string().uri().default('https://vpfe.dian.gov.co/WcfDianCustomerServices.svc'),
  STORAGE_PATH: Joi.string().default('./storage'),
  XSD_PATH: Joi.string().default('./xsd'),
  QUEUE_SUBMISSION_MAX_ATTEMPTS: Joi.number().default(5),
  QUEUE_STATUS_MAX_ATTEMPTS: Joi.number().default(5),
});

export type EnvConfig = {
  PORT: number;
  NODE_ENV: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  ENCRYPTION_KEY: string;
  DIAN_ENVIRONMENT: string;
  DIAN_HABILITACION_URL: string;
  DIAN_PRODUCCION_URL: string;
  STORAGE_PATH: string;
  XSD_PATH: string;
  QUEUE_SUBMISSION_MAX_ATTEMPTS: number;
  QUEUE_STATUS_MAX_ATTEMPTS: number;
};
