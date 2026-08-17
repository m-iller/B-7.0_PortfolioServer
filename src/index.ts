import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { config } from "./config.js";
import { configureSqlite, prisma } from "./db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { applySecurity } from "./middleware/security.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";
import { ensureAdmin } from "./services/adminService.js";

async function main(): Promise<void> {
  await configureSqlite();
  await ensureAdmin();

  const app = express();
  applySecurity(app);

  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ extended: false, limit: "256kb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api", publicRouter);

  app.use(
    "/uploads",
    express.static(config.uploadDir, {
      dotfiles: "deny",
      index: false,
      fallthrough: false,
      setHeaders(res) {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Content-Disposition", "inline");
      },
    })
  );

  app.use(express.static(config.frontendDir, { index: false, dotfiles: "deny" }));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(config.frontendDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[web] listening on ${config.port} (${config.publicOrigin})`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  console.error("[web] fatal", error);
  process.exit(1);
});
