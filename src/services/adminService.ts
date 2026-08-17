import bcrypt from "bcrypt";
import { config } from "../config.js";
import { prisma } from "../db.js";

const BCRYPT_ROUNDS = 12;

export async function ensureAdmin(): Promise<void> {
  const existing = await prisma.admin.findUnique({
    where: { username: config.adminUsername },
  });
  const passwordHash = await bcrypt.hash(config.adminPassword, BCRYPT_ROUNDS);

  if (!existing) {
    await prisma.admin.create({
      data: {
        username: config.adminUsername,
        passwordHash,
      },
    });
    return;
  }

  // Keep hash in sync with env on boot so a rotated ADMIN_PASSWORD takes effect.
  await prisma.admin.update({
    where: { username: config.adminUsername },
    data: { passwordHash },
  });
}

export async function verifyAdmin(username: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? admin : null;
}
