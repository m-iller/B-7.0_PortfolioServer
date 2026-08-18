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
  title: string;
  description: string;
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
  images: string;
  videos: string;
  tagsLinks: string;
  youtubeUrl: string;
  createdAt: Date;
}): ProjectDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: parseJsonArray<string>(row.images),
    videos: parseJsonArray<string>(row.videos),
    tagsLinks: parseJsonArray<TagLinkDto>(row.tagsLinks),
    youtubeUrl: row.youtubeUrl,
    youtubeEmbed: youtubeEmbedSrc(row.youtubeUrl),
    createdAt: row.createdAt.toISOString(),
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
      title: input.title,
      description: input.description,
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

  const row = await prisma.project.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
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
