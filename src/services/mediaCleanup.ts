import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { parseJsonArray } from "../utils/json.js";

const MEDIA_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".webm", ".ogv", ".mov"]);
const KEEP_NAMES = new Set([".gitkeep"]);

function referencedFilenames(raw: string): string[] {
  return parseJsonArray<string>(raw)
    .map((stored) => {
      if (!stored.startsWith("/uploads/")) return "";
      return path.basename(stored);
    })
    .filter(Boolean);
}

async function collectReferenced(): Promise<Set<string>> {
  const projects = await prisma.project.findMany({ select: { images: true, videos: true } });
  const names = new Set<string>();
  for (const project of projects) {
    for (const name of referencedFilenames(project.images)) names.add(name);
    for (const name of referencedFilenames(project.videos)) names.add(name);
  }
  return names;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  skippedFresh: number;
  skippedReferenced: number;
  bytesFreed: number;
}

/**
 * Delete upload files that no project references.
 * Fresh files stay for MEDIA_CLEANUP_GRACE_MIN so an admin form can still attach them.
 */
export async function cleanupUnusedMedia(options?: { ignoreGrace?: boolean }): Promise<CleanupResult> {
  const result: CleanupResult = {
    scanned: 0,
    deleted: 0,
    skippedFresh: 0,
    skippedReferenced: 0,
    bytesFreed: 0,
  };

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(config.uploadDir, { withFileTypes: true });
  } catch {
    return result;
  }

  const referenced = await collectReferenced();
  const graceMs = config.mediaCleanupGraceMin * 60 * 1000;
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (KEEP_NAMES.has(entry.name)) continue;
    if (!MEDIA_EXT.has(path.extname(entry.name).toLowerCase())) continue;

    result.scanned += 1;
    if (referenced.has(entry.name)) {
      result.skippedReferenced += 1;
      continue;
    }

    const absolute = path.join(config.uploadDir, entry.name);
    const normalized = path.normalize(absolute);
    if (!normalized.startsWith(path.normalize(config.uploadDir))) continue;

    try {
      const stat = await fs.promises.stat(normalized);
      const ageMs = now - stat.mtimeMs;
      if (!options?.ignoreGrace && ageMs < graceMs) {
        result.skippedFresh += 1;
        continue;
      }
      await fs.promises.unlink(normalized);
      result.deleted += 1;
      result.bytesFreed += stat.size;
    } catch {
      // Race or missing file is not fatal.
    }
  }

  if (result.deleted > 0) {
    console.log(
      `[media] cleanup deleted ${result.deleted} unused file(s), freed ${result.bytesFreed} bytes`
    );
  }
  return result;
}

export function startMediaCleanupScheduler(): void {
  const intervalMs = config.mediaCleanupIntervalMin * 60 * 1000;
  void cleanupUnusedMedia().catch((error) => {
    console.error("[media] cleanup failed", error);
  });
  setInterval(() => {
    void cleanupUnusedMedia().catch((error) => {
      console.error("[media] cleanup failed", error);
    });
  }, intervalMs).unref();
}
