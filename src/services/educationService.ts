import { prisma } from "../db.js";
import type { EducationInput } from "../schemas/index.js";

export async function listEducation() {
  return prisma.education.findMany({ orderBy: { institution: "asc" } });
}

export async function getEducation(id: string) {
  return prisma.education.findUnique({ where: { id } });
}

export async function createEducation(input: EducationInput) {
  return prisma.education.create({ data: input });
}

export async function updateEducation(id: string, input: Partial<EducationInput>) {
  const existing = await prisma.education.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.education.update({ where: { id }, data: input });
}

export async function deleteEducation(id: string) {
  const existing = await prisma.education.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.education.delete({ where: { id } });
  return true;
}
