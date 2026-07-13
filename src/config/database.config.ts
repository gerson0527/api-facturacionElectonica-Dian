import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { join } from "path";

config();

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_DATABASE || "api_facturacion",
  entities: [join(__dirname, "..", "database", "entities", "*.entity.{ts,js}")],
  migrations: [join(__dirname, "..", "database", "migrations", "*.{ts,js}")],
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  ssl:
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "habilitacion"
      ? { 
          rejectUnauthorized: true, 
          ...(process.env.DB_CA_CERT ? { ca: process.env.DB_CA_CERT } : {})
        }
      : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
