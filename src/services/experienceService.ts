import { prisma } from "../db.js";
import type { ExperienceInput } from "../schemas/index.js";

export interface ExperienceDto {
  id: string;
  companyOrProjectEn: string;
  companyOrProjectRu: string;
  roleEn: string;
  roleRu: string;
  descriptionEn: string;
  descriptionRu: string;
  period: string;
}

function toDto(row: {
  id: string;
  companyOrProject: string;
  role: string;
  description: string;
  period: string;
  companyOrProjectEn: string;
  companyOrProjectRu: string;
  roleEn: string;
  roleRu: string;
  descriptionEn: string;
  descriptionRu: string;
}): ExperienceDto {
  return {
    id: row.id,
    companyOrProjectEn: row.companyOrProjectEn || row.companyOrProject,
    companyOrProjectRu: row.companyOrProjectRu || row.companyOrProjectEn || row.companyOrProject,
    roleEn: row.roleEn || row.role,
    roleRu: row.roleRu || row.roleEn || row.role,
    descriptionEn: row.descriptionEn || row.description,
    descriptionRu: row.descriptionRu || row.descriptionEn || row.description,
    period: row.period,
  };
}

function writeFields(input: ExperienceInput) {
  return {
    companyOrProjectEn: input.companyOrProjectEn,
    companyOrProjectRu: input.companyOrProjectRu,
    roleEn: input.roleEn,
    roleRu: input.roleRu,
    descriptionEn: input.descriptionEn,
    descriptionRu: input.descriptionRu,
    period: input.period,
    companyOrProject: input.companyOrProjectEn,
    role: input.roleEn,
    description: input.descriptionEn,
  };
}

export async function listExperience(): Promise<ExperienceDto[]> {
  const rows = await prisma.experience.findMany({ orderBy: { period: "desc" } });
  return rows.map(toDto);
}

export async function getExperience(id: string): Promise<ExperienceDto | null> {
  const row = await prisma.experience.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

export async function createExperience(input: ExperienceInput): Promise<ExperienceDto> {
  return toDto(await prisma.experience.create({ data: writeFields(input) }));
}

export async function updateExperience(id: string, input: Partial<ExperienceInput>): Promise<ExperienceDto | null> {
  const existing = await prisma.experience.findUnique({ where: { id } });
  if (!existing) return null;
  const merged: ExperienceInput = {
    companyOrProjectEn: input.companyOrProjectEn ?? (existing.companyOrProjectEn || existing.companyOrProject),
    companyOrProjectRu: input.companyOrProjectRu ?? (existing.companyOrProjectRu || existing.companyOrProject),
    roleEn: input.roleEn ?? (existing.roleEn || existing.role),
    roleRu: input.roleRu ?? (existing.roleRu || existing.role),
    descriptionEn: input.descriptionEn ?? (existing.descriptionEn || existing.description),
    descriptionRu: input.descriptionRu ?? (existing.descriptionRu || existing.description),
    period: input.period ?? existing.period,
  };
  return toDto(await prisma.experience.update({ where: { id }, data: writeFields(merged) }));
}

export async function deleteExperience(id: string) {
  const existing = await prisma.experience.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.experience.delete({ where: { id } });
  return true;
}

export async function migrateExperienceTranslations(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE Experience SET
      companyOrProjectEn = CASE WHEN companyOrProjectEn = '' THEN companyOrProject ELSE companyOrProjectEn END,
      companyOrProjectRu = CASE WHEN companyOrProjectRu = '' THEN companyOrProject ELSE companyOrProjectRu END,
      roleEn = CASE WHEN roleEn = '' THEN role ELSE roleEn END,
      roleRu = CASE WHEN roleRu = '' THEN role ELSE roleRu END,
      descriptionEn = CASE WHEN descriptionEn = '' THEN description ELSE descriptionEn END,
      descriptionRu = CASE WHEN descriptionRu = '' THEN description ELSE descriptionRu END
  `);
}
