import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { config } from "../config.js";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, config.uploadDir),
    filename: (_req, file, cb) => {
      const ext = ALLOWED_MIME[file.mimetype];
      if (!ext) {
        cb(new Error("Unsupported file type"), "");
        return;
      }
      cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: config.uploadMaxBytes, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(new Error("Unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

export function publicUploadPath(filename: string): string {
  return `/uploads/${filename}`;
}

export function resolveStoredPath(stored: string): string | null {
  if (!stored.startsWith("/uploads/")) return null;
  const filename = path.basename(stored);
  const absolute = path.join(config.uploadDir, filename);
  const normalized = path.normalize(absolute);
  if (!normalized.startsWith(path.normalize(config.uploadDir))) return null;
  return normalized;
}

export function deleteStoredFiles(paths: string[]): void {
  for (const stored of paths) {
    const absolute = resolveStoredPath(stored);
    if (!absolute) continue;
    try {
      fs.unlinkSync(absolute);
    } catch {
      // Missing file is not fatal.
    }
  }
}

export async function saveBufferAsImage(buffer: Buffer, mimeHint = "image/jpeg"): Promise<string> {
  const ext = ALLOWED_MIME[mimeHint] ?? ".jpg";
  const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const absolute = path.join(config.uploadDir, filename);
  await fs.promises.writeFile(absolute, buffer);
  return publicUploadPath(filename);
}
