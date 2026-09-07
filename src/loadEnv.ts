import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Must be imported first from every Node entry. Prisma reads DATABASE_URL
 * when the client module loads; relative file:./ paths are resolved from
 * prisma/schema.prisma, not process.cwd(), which is why local
 * file:./data/portfolio.db fails with SQLite error 14.
 */

function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const loadFile = (process as NodeJS.Process & { loadEnvFile?: (file: string) => void }).loadEnvFile;
  if (typeof loadFile === "function") {
    try {
      loadFile(envPath);
      return;
    } catch {
      // parse below
    }
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function sqliteFileUrl(): string {
  const file = path.resolve(process.cwd(), "data", "portfolio.db");
  return `file:${file.replace(/\\/g, "/")}`;
}

function isAbsoluteSqliteUrl(url: string): boolean {
  return /^(file:\/\/\/|file:\/[A-Za-z]:|file:[A-Za-z]:)/.test(url);
}

function pinDatabaseUrl(): void {
  const current = process.env.DATABASE_URL ?? "";
  if (isAbsoluteSqliteUrl(current)) return;
  process.env.DATABASE_URL = sqliteFileUrl();
}

function ensureDirs(): void {
  fs.mkdirSync(path.resolve(process.cwd(), "data", "dnd"), { recursive: true });
  fs.mkdirSync(path.resolve(process.cwd(), "uploads"), { recursive: true });
}

loadDotEnv();
pinDatabaseUrl();
ensureDirs();

export function ensureLocalSchema(): void {
  const prismaCli = path.resolve(process.cwd(), "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "db", "push", "--skip-generate"], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
}
