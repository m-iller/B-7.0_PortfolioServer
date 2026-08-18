import path from "node:path";
import fs from "node:fs";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const nodeEnv = optional("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const jwtSecret = required(
  "JWT_SECRET",
  isProduction ? undefined : "dev-only-jwt-secret-change-me-32chars!!"
);

if (isProduction && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

const uploadMaxMb = Number(optional("UPLOAD_MAX_MB", "64"));
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "uploads");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
  nodeEnv,
  isProduction,
  port: Number(optional("PORT", "3000")),
  publicOrigin: optional("PUBLIC_ORIGIN", "http://localhost:3000"),
  databaseUrl: optional("DATABASE_URL", "file:./data/portfolio.db"),
  jwtSecret,
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "8h"),
  cookieSecure: optional("COOKIE_SECURE", isProduction ? "true" : "false") === "true",
  adminUsername: required("ADMIN_USERNAME", "admin"),
  adminPassword: required(
    "ADMIN_PASSWORD",
    isProduction ? undefined : "ChangeThisAdminPass1!"
  ),
  telegramBotToken: optional("TELEGRAM_BOT_TOKEN"),
  telegramAdminId: optional("TELEGRAM_ADMIN_ID"),
  uploadMaxMb,
  uploadMaxBytes: Math.max(1, uploadMaxMb) * 1024 * 1024,
  dataDir,
  uploadDir,
  frontendDir: path.resolve(process.cwd(), "frontend", "dist"),
};

export const AUTH_COOKIE = "portfolio_session";
export const CSRF_COOKIE = "portfolio_csrf";
