import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  const safeClientErrors = new Set([
    "Invalid URL",
    "URL protocol must be http or https",
    "URL protocol must be http, https, mailto, or tel",
    "youtube_url must be a valid YouTube link",
    "Unsupported file type",
    "File too large",
  ]);

  if (safeClientErrors.has(message)) {
    res.status(400).json({ error: message });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error" });
}
