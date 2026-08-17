import { prisma } from "../db.js";
import type { SkillInput } from "../schemas/index.js";

export async function listSkills() {
  return prisma.skill.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] });
}

export async function getSkill(id: string) {
  return prisma.skill.findUnique({ where: { id } });
}

export async function createSkill(input: SkillInput) {
  return prisma.skill.create({ data: input });
}

export async function updateSkill(id: string, input: Partial<SkillInput>) {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.skill.update({ where: { id }, data: input });
}

export async function deleteSkill(id: string) {
  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.skill.delete({ where: { id } });
  return true;
}
