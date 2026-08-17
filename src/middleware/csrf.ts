import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, config, CSRF_COOKIE } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sign(value: string): string {
  return crypto.createHmac("sha256", config.jwtSecret).update(value).digest("hex");
}

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, `${token}.${sign(token)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.cookieSecure,
    path: "/",
  });
  return token;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Login itself issues the session; still require a CSRF cookie pair.
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.get("x-csrf-token") ?? "";
  if (!cookie || !header) {
    res.status(403).json({ error: "CSRF token missing" });
    return;
  }

  const [token, mac] = cookie.split(".");
  if (!token || !mac || !crypto.timingSafeEqual(Buffer.from(sign(token)), Buffer.from(mac))) {
    res.status(403).json({ error: "CSRF token invalid" });
    return;
  }

  const headerBuf = Buffer.from(header);
  const tokenBuf = Buffer.from(token);
  if (headerBuf.length !== tokenBuf.length || !crypto.timingSafeEqual(headerBuf, tokenBuf)) {
    res.status(403).json({ error: "CSRF token mismatch" });
    return;
  }

  next();
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(CSRF_COOKIE, { path: "/" });
}
