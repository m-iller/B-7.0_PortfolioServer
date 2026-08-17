import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { configureSqlite, prisma } from "./db.js";
import { projectInputSchema, tagLinkSchema } from "./schemas/index.js";
import { createProject } from "./services/projectService.js";
import { saveBufferAsImage } from "./services/uploadService.js";

type WizardStep = "idle" | "title" | "description" | "photos" | "youtube" | "links";

interface Session {
  step: WizardStep;
  title?: string;
  description?: string;
  images: string[];
  youtubeUrl: string;
}

const sessions = new Map<number, Session>();

function isAdmin(userId: number | undefined): boolean {
  if (!config.telegramAdminId || userId === undefined) return false;
  return String(userId) === String(config.telegramAdminId);
}

function getSession(userId: number): Session {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const created: Session = { step: "idle", images: [], youtubeUrl: "" };
  sessions.set(userId, created);
  return created;
}

function resetSession(userId: number): void {
  sessions.set(userId, { step: "idle", images: [], youtubeUrl: "" });
}

function parseTagLinks(raw: string) {
  if (!raw || raw.toLowerCase() === "skip") return [];
  return raw.split(",").map((chunk) => {
    const [label, url] = chunk.split("|").map((part) => part.trim());
    return tagLinkSchema.parse({ label, url });
  });
}

async function downloadTelegramFile(bot: Telegraf, fileId: string): Promise<string> {
  const link = await bot.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error("Failed to download Telegram file");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  return saveBufferAsImage(buffer, contentType);
}

async function main(): Promise<void> {
  if (!config.telegramBotToken) {
    console.log("[bot] TELEGRAM_BOT_TOKEN empty — worker idle");
    setInterval(() => undefined, 60_000);
    return;
  }
  if (!config.telegramAdminId) {
    throw new Error("TELEGRAM_ADMIN_ID is required when the bot token is set");
  }

  await configureSqlite();

  const bot = new Telegraf(config.telegramBotToken);

  bot.use(async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) {
      await ctx.reply("Access denied.");
      return;
    }
    await next();
  });

  bot.start(async (ctx) => {
    await ctx.reply(
      [
        "Portfolio admin bot.",
        "/newproject — add a project",
        "/cancel — abort the current wizard",
        "/help — this message",
      ].join("\n")
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "/newproject flow:",
        "1. Title",
        "2. Description",
        "3. Photos (album or one-by-one). Send /done when finished.",
        "4. YouTube URL or skip",
        "5. Links as Label|https://url, Label|https://url or skip",
      ].join("\n")
    );
  });

  bot.command("cancel", async (ctx) => {
    resetSession(ctx.from!.id);
    await ctx.reply("Wizard cancelled.");
  });

  bot.command("newproject", async (ctx) => {
    const session = getSession(ctx.from!.id);
    session.step = "title";
    session.images = [];
    session.youtubeUrl = "";
    session.title = undefined;
    session.description = undefined;
    await ctx.reply("Step 1/5 — send the project title.");
  });

  bot.command("done", async (ctx) => {
    const session = getSession(ctx.from!.id);
    if (session.step !== "photos") {
      await ctx.reply("Nothing to finish. Use /newproject.");
      return;
    }
    session.step = "youtube";
    await ctx.reply("Step 4/5 — send a YouTube URL, or type skip.");
  });

  bot.on("photo", async (ctx) => {
    const session = getSession(ctx.from!.id);
    if (session.step !== "photos") {
      await ctx.reply("Photos are only accepted during /newproject.");
      return;
    }
    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    if (!best) return;
    const stored = await downloadTelegramFile(bot, best.file_id);
    session.images.push(stored);
    await ctx.reply(`Stored ${session.images.length} photo(s). Send more or /done.`);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const session = getSession(ctx.from!.id);

    if (session.step === "title") {
      session.title = text;
      session.step = "description";
      await ctx.reply("Step 2/5 — send the project description.");
      return;
    }

    if (session.step === "description") {
      session.description = text;
      session.step = "photos";
      await ctx.reply("Step 3/5 — send photos (bulk allowed). Type /done when finished.");
      return;
    }

    if (session.step === "youtube") {
      session.youtubeUrl = text.toLowerCase() === "skip" ? "" : text;
      session.step = "links";
      await ctx.reply("Step 5/5 — send links as Label|url, Label|url or type skip.");
      return;
    }

    if (session.step === "links") {
      try {
        const payload = projectInputSchema.parse({
          title: session.title,
          description: session.description,
          images: session.images,
          tagsLinks: parseTagLinks(text),
          youtubeUrl: session.youtubeUrl,
        });
        const created = await createProject(payload);
        resetSession(ctx.from!.id);
        await ctx.reply(`Project saved: ${created.title} (${created.id})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Validation failed";
        await ctx.reply(`Rejected: ${message}. Fix the last step or /cancel.`);
      }
      return;
    }

    await ctx.reply("Use /newproject to add a record.");
  });

  await bot.launch();
  console.log("[bot] long-polling");

  const shutdown = async () => {
    bot.stop("shutdown");
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[bot] fatal", error);
  process.exit(1);
});
