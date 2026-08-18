import { prisma } from "../db.js";
import type { EducationInput } from "../schemas/index.js";

export interface EducationDto {
  id: string;
  institutionEn: string;
  institutionRu: string;
  specialtyEn: string;
  specialtyRu: string;
  detailsEn: string;
  detailsRu: string;
}

function toDto(row: {
  id: string;
  institution: string;
  specialty: string;
  details: string;
  institutionEn: string;
  institutionRu: string;
  specialtyEn: string;
  specialtyRu: string;
  detailsEn: string;
  detailsRu: string;
}): EducationDto {
  return {
    id: row.id,
    institutionEn: row.institutionEn || row.institution,
    institutionRu: row.institutionRu || row.institutionEn || row.institution,
    specialtyEn: row.specialtyEn || row.specialty,
    specialtyRu: row.specialtyRu || row.specialtyEn || row.specialty,
    detailsEn: row.detailsEn || row.details,
    detailsRu: row.detailsRu || row.detailsEn || row.details,
  };
}

function writeFields(input: EducationInput) {
  return {
    institutionEn: input.institutionEn,
    institutionRu: input.institutionRu,
    specialtyEn: input.specialtyEn,
    specialtyRu: input.specialtyRu,
    detailsEn: input.detailsEn,
    detailsRu: input.detailsRu,
    institution: input.institutionEn,
    specialty: input.specialtyEn,
    details: input.detailsEn,
  };
}

export async function listEducation(): Promise<EducationDto[]> {
  const rows = await prisma.education.findMany({ orderBy: { institutionEn: "asc" } });
  return rows.map(toDto);
}

export async function getEducation(id: string): Promise<EducationDto | null> {
  const row = await prisma.education.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

export async function createEducation(input: EducationInput): Promise<EducationDto> {
  return toDto(await prisma.education.create({ data: writeFields(input) }));
}

export async function updateEducation(id: string, input: Partial<EducationInput>): Promise<EducationDto | null> {
  const existing = await prisma.education.findUnique({ where: { id } });
  if (!existing) return null;
  const merged: EducationInput = {
    institutionEn: input.institutionEn ?? (existing.institutionEn || existing.institution),
    institutionRu: input.institutionRu ?? (existing.institutionRu || existing.institution),
    specialtyEn: input.specialtyEn ?? (existing.specialtyEn || existing.specialty),
    specialtyRu: input.specialtyRu ?? (existing.specialtyRu || existing.specialty),
    detailsEn: input.detailsEn ?? (existing.detailsEn || existing.details),
    detailsRu: input.detailsRu ?? (existing.detailsRu || existing.details),
  };
  return toDto(await prisma.education.update({ where: { id }, data: writeFields(merged) }));
}

export async function deleteEducation(id: string) {
  const existing = await prisma.education.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.education.delete({ where: { id } });
  return true;
}

export async function migrateEducationTranslations(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE Education SET
      institutionEn = CASE WHEN institutionEn = '' THEN institution ELSE institutionEn END,
      institutionRu = CASE WHEN institutionRu = '' THEN institution ELSE institutionRu END,
      specialtyEn = CASE WHEN specialtyEn = '' THEN specialty ELSE specialtyEn END,
      specialtyRu = CASE WHEN specialtyRu = '' THEN specialty ELSE specialtyRu END,
      detailsEn = CASE WHEN detailsEn = '' THEN details ELSE detailsEn END,
      detailsRu = CASE WHEN detailsRu = '' THEN details ELSE detailsRu END
  `);
}
