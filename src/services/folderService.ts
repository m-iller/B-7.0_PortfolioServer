import { prisma } from "../db.js";
import type { FolderInput } from "../schemas/index.js";

export interface FolderDto {
  id: string;
  titleEn: string;
  titleRu: string;
  sortOrder: number;
  projectCount: number;
  createdAt: string;
}

function toDto(row: {
  id: string;
  titleEn: string;
  titleRu: string;
  sortOrder: number;
  createdAt: Date;
  _count?: { projects: number };
}): FolderDto {
  return {
    id: row.id,
    titleEn: row.titleEn,
    titleRu: row.titleRu,
    sortOrder: row.sortOrder,
    projectCount: row._count?.projects ?? 0,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listFolders(): Promise<FolderDto[]> {
  const rows = await prisma.projectFolder.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { projects: true } } },
  });
  return rows.map(toDto);
}

export async function getFolder(id: string): Promise<FolderDto | null> {
  const row = await prisma.projectFolder.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });
  return row ? toDto(row) : null;
}

export async function createFolder(input: FolderInput): Promise<FolderDto> {
  const row = await prisma.projectFolder.create({
    data: {
      titleEn: input.titleEn,
      titleRu: input.titleRu,
      sortOrder: input.sortOrder,
    },
    include: { _count: { select: { projects: true } } },
  });
  return toDto(row);
}

export async function updateFolder(id: string, input: Partial<FolderInput>): Promise<FolderDto | null> {
  const existing = await prisma.projectFolder.findUnique({ where: { id } });
  if (!existing) return null;
  const row = await prisma.projectFolder.update({
    where: { id },
    data: {
      ...(input.titleEn !== undefined ? { titleEn: input.titleEn } : {}),
      ...(input.titleRu !== undefined ? { titleRu: input.titleRu } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: { _count: { select: { projects: true } } },
  });
  return toDto(row);
}

export async function deleteFolder(id: string): Promise<boolean> {
  const existing = await prisma.projectFolder.findUnique({ where: { id } });
  if (!existing) return false;
  await prisma.projectFolder.delete({ where: { id } });
  return true;
}

export async function assertFolderId(folderId: string | null | undefined): Promise<string | null> {
  if (!folderId) return null;
  const folder = await prisma.projectFolder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new Error("Folder not found");
  }
  return folder.id;
}
