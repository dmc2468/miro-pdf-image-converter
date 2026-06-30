import path from "node:path";
import "dotenv/config";

export type AppConfig = {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  appBaseUrl: string;
  frontendBaseUrl: string;
  mongoDbUri?: string;
  mongoDbName: string;
  seedUserEmail?: string;
  seedUserPassword?: string;
  seedUserName?: string;
  tempDir: string;
  localStorageDir: string;
  maxUploadBytes: number;
  s3?: {
    region: string;
    bucket: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
};

function requiredJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if ((process.env.NODE_ENV ?? "development") === "production") {
    throw new Error("JWT_SECRET must be set in production.");
  }
  return "development-only-change-me";
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}

function s3Config(): AppConfig["s3"] {
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return undefined;
  }

  const endpoint = process.env.S3_ENDPOINT || undefined;
  return {
    region,
    bucket,
    ...(endpoint ? { endpoint } : {}),
    accessKeyId,
    secretAccessKey,
  };
}

export const config: AppConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberFromEnv("PORT", 8080),
  jwtSecret: requiredJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "12h",
  appBaseUrl: process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`,
  mongoDbUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB_NAME ?? "miro_pdf_image_converter",
  seedUserEmail: process.env.SEED_USER_EMAIL,
  seedUserPassword: process.env.SEED_USER_PASSWORD,
  seedUserName: process.env.SEED_USER_NAME,
  tempDir: process.env.TEMP_STORAGE_PATH ?? path.resolve("tmp"),
  localStorageDir: process.env.LOCAL_OBJECT_STORAGE_PATH ?? path.resolve("storage"),
  maxUploadBytes: numberFromEnv("MAX_UPLOAD_MB", 50) * 1024 * 1024,
  s3: s3Config(),
};
