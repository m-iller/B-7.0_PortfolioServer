import { prisma } from "../db.js";
import type { ProjectInput } from "../schemas/index.js";
import { parseJsonArray, toJson } from "../utils/json.js";
import { youtubeEmbedSrc } from "../utils/sanitize.js";
import { deleteStoredFiles } from "./uploadService.js";

export interface TagLinkDto {
  label: string;
  url: string;
}

export interface ProjectDto {
  id: string;
  titleEn: string;
  titleRu: string;
  descriptionEn: string;
  descriptionRu: string;
  images: string[];
  videos: string[];
  tagsLinks: TagLinkDto[];
  youtubeUrl: string;
  youtubeEmbed: string | null;
  createdAt: string;
}

function toDto(row: {
  id: string;
  title: string;
  description: string;
  titleEn: string;
  titleRu: string;
  descriptionEn: string;
  descriptionRu: string;
  images: string;
  videos: string;
  tagsLinks: string;
  youtubeUrl: string;
  createdAt: Date;
}): ProjectDto {
  return {
    id: row.id,
    titleEn: row.titleEn || row.title,
    titleRu: row.titleRu || row.titleEn || row.title,
    descriptionEn: row.descriptionEn || row.description,
    descriptionRu: row.descriptionRu || row.descriptionEn || row.description,
    images: parseJsonArray<string>(row.images),
    videos: parseJsonArray<string>(row.videos),
    tagsLinks: parseJsonArray<TagLinkDto>(row.tagsLinks),
    youtubeUrl: row.youtubeUrl,
    youtubeEmbed: youtubeEmbedSrc(row.youtubeUrl),
    createdAt: row.createdAt.toISOString(),
  };
}

function bilingualWrite(input: Pick<ProjectInput, "titleEn" | "titleRu" | "descriptionEn" | "descriptionRu">) {
  return {
    titleEn: input.titleEn,
    titleRu: input.titleRu,
    descriptionEn: input.descriptionEn,
    descriptionRu: input.descriptionRu,
    title: input.titleEn,
    description: input.descriptionEn,
  };
}

export async function listProjects(): Promise<ProjectDto[]> {
  const rows = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toDto);
}

export async function getProject(id: string): Promise<ProjectDto | null> {
  const row = await prisma.project.findUnique({ where: { id } });
  return row ? toDto(row) : null;
}

export async function createProject(input: ProjectInput): Promise<ProjectDto> {
  const row = await prisma.project.create({
    data: {
      ...bilingualWrite(input),
      images: toJson(input.images),
      videos: toJson(input.videos),
      tagsLinks: toJson(input.tagsLinks),
      youtubeUrl: input.youtubeUrl,
    },
  });
  return toDto(row);
}

function removedPaths(previous: string[], next: string[]): string[] {
  return previous.filter((item) => !next.includes(item));
}

export async function updateProject(id: string, input: Partial<ProjectInput>): Promise<ProjectDto | null> {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return null;

  if (input.images) {
    deleteStoredFiles(removedPaths(parseJsonArray<string>(existing.images), input.images));
  }
  if (input.videos) {
    deleteStoredFiles(removedPaths(parseJsonArray<string>(existing.videos), input.videos));
  }

  const bilingual =
    input.titleEn !== undefined &&
    input.titleRu !== undefined &&
    input.descriptionEn !== undefined &&
    input.descriptionRu !== undefined
      ? bilingualWrite({
          titleEn: input.titleEn,
          titleRu: input.titleRu,
          descriptionEn: input.descriptionEn,
          descriptionRu: input.descriptionRu,
        })
      : {
          ...(input.titleEn !== undefined ? { titleEn: input.titleEn, title: input.titleEn } : {}),
          ...(input.titleRu !== undefined ? { titleRu: input.titleRu } : {}),
          ...(input.descriptionEn !== undefined
            ? { descriptionEn: input.descriptionEn, description: input.descriptionEn }
            : {}),
          ...(input.descriptionRu !== undefined ? { descriptionRu: input.descriptionRu } : {}),
        };

  const row = await prisma.project.update({
    where: { id },
    data: {
      ...bilingual,
      ...(input.images !== undefined ? { images: toJson(input.images) } : {}),
      ...(input.videos !== undefined ? { videos: toJson(input.videos) } : {}),
      ...(input.tagsLinks !== undefined ? { tagsLinks: toJson(input.tagsLinks) } : {}),
      ...(input.youtubeUrl !== undefined ? { youtubeUrl: input.youtubeUrl } : {}),
    },
  });
  return toDto(row);
}

export async function deleteProject(id: string): Promise<boolean> {
  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return false;
  deleteStoredFiles([
    ...parseJsonArray<string>(existing.images),
    ...parseJsonArray<string>(existing.videos),
  ]);
  await prisma.project.delete({ where: { id } });
  return true;
}

export async function migrateProjectTranslations(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    UPDATE Project
    SET titleEn = title
    WHERE (titleEn IS NULL OR titleEn = '') AND title IS NOT NULL AND title != ''
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE Project
    SET descriptionEn = description
    WHERE (descriptionEn IS NULL OR descriptionEn = '') AND description IS NOT NULL AND description != ''
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE Project
    SET titleRu = titleEn
    WHERE (titleRu IS NULL OR titleRu = '') AND titleEn IS NOT NULL AND titleEn != ''
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE Project
    SET descriptionRu = descriptionEn
    WHERE (descriptionRu IS NULL OR descriptionRu = '') AND descriptionEn IS NOT NULL AND descriptionEn != ''
  `);
}
