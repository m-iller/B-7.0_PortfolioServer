import { Router } from "express";
import { optionalAuth, requireAuth, setSessionCookie, signSession } from "../middleware/auth.js";
import { clearAuthCookies, csrfProtection, issueCsrfToken } from "../middleware/csrf.js";
import { loginLimiter } from "../middleware/security.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema } from "../schemas/index.js";
import { verifyAdmin } from "../services/adminService.js";

export const authRouter = Router();

authRouter.get("/csrf", (_req, res) => {
  const token = issueCsrfToken(res);
  res.json({ csrfToken: token });
});

authRouter.get("/me", optionalAuth, (req, res) => {
  if (!req.admin) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, username: req.admin.username });
});

authRouter.post("/login", loginLimiter, csrfProtection, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    const admin = await verifyAdmin(username, password);
    if (!admin) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signSession({ sub: admin.id, username: admin.username });
    setSessionCookie(res, token);
    const csrfToken = issueCsrfToken(res);
    res.json({ ok: true, username: admin.username, csrfToken });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, csrfProtection, (_req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});
