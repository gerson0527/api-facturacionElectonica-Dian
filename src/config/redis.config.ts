import { config } from "dotenv";

config();

const nodeEnv = process.env.NODE_ENV || "development";
const isDev = nodeEnv === "development" || nodeEnv === "test";

export const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: isDev ? 1 : 10,
  enableOfflineQueue: !isDev,
  connectTimeout: isDev ? 3000 : 10000,
  retryStrategy: (times: number) => {
    if (isDev && times > 1) return null;
    return Math.min(times * 200, 5000);
  },
};
