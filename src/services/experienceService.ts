import { prisma } from "../db.js";
import type { ExperienceInput } from "../schemas/index.js";

export async function listExperience() {
  return prisma.experience.findMany({ orderBy: { period: "desc" } });
}

export async function getExperience(id: string) {
  return prisma.experience.findUnique({ where: { id } });
}

export async function createExperience(input: ExperienceInput) {
  return prisma.experience.create({ data: input });
}

export async function updateExperience(id: string, input: Partial<ExperienceInput>) {
  const existing = await prisma.experience.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.experience.update({ where: { id }, data: input });
}

export async function deleteExperience(id: string) {
  const existing = await prisma.experience.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.experience.delete({ where: { id } });
  return true;
}
