import { prisma } from "../db.js";
import type { SkillInput } from "../schemas/index.js";

export interface SkillDto {
  id: string;
  titleEn: string;
  titleRu: string;
  categoryEn: string;
  categoryRu: string;
  experienceYears: number;
  proficiencyLevelEn: string;
  proficiencyLevelRu: string;
  descriptionEn: string;
  descriptionRu: string;
}

function toDto(row: {
  id: string;
  title: string;
  category: string;
  experienceYears: number;
  proficiencyLevel: string;
  description: string;
  titleEn: string;
  titleRu: string;
  categoryEn: string;
  categoryRu: string;
  proficiencyLevelEn: string;
  proficiencyLevelRu: string;
  descriptionEn: string;
  descriptionRu: string;
}): SkillDto {
  return {
    id: row.id,
    titleEn: row.titleEn || row.title,
    titleRu: row.titleRu || row.titleEn || row.title,
    categoryEn: row.categoryEn || row.category,
    categoryRu: row.categoryRu || row.categoryEn || row.category,
    experienceYears: row.experienceYears,
    proficiencyLevelEn: row.proficiencyLevelEn || row.proficiencyLevel,
    proficiencyLevelRu: row.proficiencyLevelRu || row.proficiencyLevelEn || row.proficiencyLevel,
    descriptionEn: row.descriptionEn || row.description,
    descriptionRu: row.descriptionRu || row.descriptionEn || row.description,
  };
}

function writeFields(input: SkillInput) {
  return {
    titleEn: input.titleEn,
    titleRu: input.titleRu,
    categoryEn: input.categoryEn,
    categoryRu: input.categoryRu,
    experienceYears: input.experienceYears,
    proficiencyLevelEn: input.proficiencyLevelEn,
    proficiencyLevelRu: input.proficiencyLevelRu,
    descriptionEn: input.descriptionEn,
    descriptionRu: input.descriptionRu,
    title: input.titleEn,
    category: input.categoryEn,
    proficiencyLevel: input.proficiencyLevelEn,
    description: input.descriptionEn,
  };
}

export async function listSkills(): Promise<SkillDto[]> {
  const rows = await prisma.skill.findMany({ orderBy: [{ categoryEn: "asc" }, { titleEn: "asc" }] });
  return rows.map(toDto);
}

export async function getSkill(id: string): Promise<SkillDto | null> {
  const row = await prisma.skill.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

export async function createSkill(input: SkillInput): Promise<SkillDto> {
  return toDto(await prisma.skill.create({ data: writeFields(input) }));
}

export async function updateSkill(id: string, input: Partial<SkillInput>): Promise<SkillDto | null> {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) return null;
  const merged: SkillInput = {
    titleEn: input.titleEn ?? (existing.titleEn || existing.title),
    titleRu: input.titleRu ?? (existing.titleRu || existing.title),
    categoryEn: input.categoryEn ?? (existing.categoryEn || existing.category),
    categoryRu: input.categoryRu ?? (existing.categoryRu || existing.category),
    experienceYears: input.experienceYears ?? existing.experienceYears,
    proficiencyLevelEn: input.proficiencyLevelEn ?? (existing.proficiencyLevelEn || existing.proficiencyLevel),
    proficiencyLevelRu: input.proficiencyLevelRu ?? (existing.proficiencyLevelRu || existing.proficiencyLevel),
    descriptionEn: input.descriptionEn ?? (existing.descriptionEn || existing.description),
    descriptionRu: input.descriptionRu ?? (existing.descriptionRu || existing.description),
  };
  return toDto(await prisma.skill.update({ where: { id }, data: writeFields(merged) }));
}

export async function deleteSkill(id: string) {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.skill.delete({ where: { id } });
  return true;
}

export async function migrateSkillTranslations(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE Skill SET
      titleEn = CASE WHEN titleEn = '' THEN title ELSE titleEn END,
      titleRu = CASE WHEN titleRu = '' THEN title ELSE titleRu END,
      categoryEn = CASE WHEN categoryEn = '' THEN category ELSE categoryEn END,
      categoryRu = CASE WHEN categoryRu = '' THEN category ELSE categoryRu END,
      proficiencyLevelEn = CASE WHEN proficiencyLevelEn = '' THEN proficiencyLevel ELSE proficiencyLevelEn END,
      proficiencyLevelRu = CASE WHEN proficiencyLevelRu = '' THEN proficiencyLevel ELSE proficiencyLevelRu END,
      descriptionEn = CASE WHEN descriptionEn = '' THEN description ELSE descriptionEn END,
      descriptionRu = CASE WHEN descriptionRu = '' THEN description ELSE descriptionRu END
  `);
}
