import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client. WAL + busy_timeout lets the web and bot
 * containers share one SQLite file without immediate lock errors.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function configureSqlite(): Promise<void> {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000;");
  await prisma.$queryRawUnsafe("PRAGMA foreign_keys=ON;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous=NORMAL;");
}
