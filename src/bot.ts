import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { configureSqlite, prisma } from "./db.js";
import { projectInputSchema, tagLinkSchema, type TagLink } from "./schemas/index.js";
import { listFolders } from "./services/folderService.js";
import { createProject } from "./services/projectService.js";
import { saveBufferAsUpload } from "./services/uploadService.js";

type WizardStep =
  | "idle"
  | "titleEn"
  | "titleRu"
  | "descriptionEn"
  | "descriptionRu"
  | "photos"
  | "videos"
  | "youtube"
  | "links"
  | "folder";

interface Session {
  step: WizardStep;
  titleEn?: string;
  titleRu?: string;
  descriptionEn?: string;
  descriptionRu?: string;
  images: string[];
  videos: string[];
  youtubeUrl: string;
  tagsLinks: TagLink[];
}

const sessions = new Map<number, Session>();

function isAdmin(userId: number | undefined): boolean {
  if (!config.telegramAdminId || userId === undefined) return false;
  return String(userId) === String(config.telegramAdminId);
}

function emptySession(): Session {
  return { step: "idle", images: [], videos: [], youtubeUrl: "", tagsLinks: [] };
}

function getSession(userId: number): Session {
  const existing = sessions.get(userId);
  if (existing) return existing;
  const created = emptySession();
  sessions.set(userId, created);
  return created;
}

function resetSession(userId: number): void {
  sessions.set(userId, emptySession());
}

function parseTagLinks(raw: string) {
  if (!raw || raw.toLowerCase() === "skip") return [];
  return raw.split(",").map((chunk) => {
    const [label, url] = chunk.split("|").map((part) => part.trim());
    return tagLinkSchema.parse({ label, url });
  });
}

async function saveWizardProject(
  userId: number,
  session: Session,
  folderId: string | null,
  reply: (text: string) => Promise<unknown>
): Promise<void> {
  try {
    const payload = projectInputSchema.parse({
      titleEn: session.titleEn,
      titleRu: session.titleRu,
      descriptionEn: session.descriptionEn,
      descriptionRu: session.descriptionRu,
      images: session.images,
      videos: session.videos,
      tagsLinks: session.tagsLinks,
      youtubeUrl: session.youtubeUrl,
      folderId,
    });
    const created = await createProject(payload);
    resetSession(userId);
    await reply(`Project saved: ${created.titleEn} / ${created.titleRu} (${created.id})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed";
    await reply(`Rejected: ${message}. Fix the last step or /cancel.`);
  }
}

async function downloadTelegramFile(bot: Telegraf, fileId: string, mimeFallback: string): Promise<string> {
  const link = await bot.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) {
    throw new Error("Failed to download Telegram file");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? mimeFallback;
  return saveBufferAsUpload(buffer, contentType);
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
        "/folders — list project folders",
        "/cancel — abort the current wizard",
        "/help — this message",
        "Edit profile, folders, projects, skills, experience, and education in /admin.",
      ].join("\n")
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      [
        "/newproject flow:",
        "1. Title EN",
        "2. Title RU",
        "3. Description EN",
        "4. Description RU",
        "5. Photos (album or one-by-one). Send /done when finished.",
        "6. Videos (mp4). Send /done or skip when finished.",
        "7. YouTube URL or skip",
        "8. Links as Label|https://url, Label|https://url or skip",
        "9. Folder number from the list, or skip (no folder)",
        "",
        "Create folders and edit every section in the /admin panel.",
      ].join("\n")
    );
  });

  bot.command("cancel", async (ctx) => {
    resetSession(ctx.from!.id);
    await ctx.reply("Wizard cancelled.");
  });

  bot.command("folders", async (ctx) => {
    const folders = await listFolders();
    if (folders.length === 0) {
      await ctx.reply("No folders yet. Create them in /admin.");
      return;
    }
    await ctx.reply(
      folders.map((folder) => `${folder.titleEn} / ${folder.titleRu} (${folder.projectCount} projects)`).join("\n")
    );
  });

  bot.command("newproject", async (ctx) => {
    const session = getSession(ctx.from!.id);
    session.step = "titleEn";
    session.images = [];
    session.videos = [];
    session.youtubeUrl = "";
    session.tagsLinks = [];
    session.titleEn = undefined;
    session.titleRu = undefined;
    session.descriptionEn = undefined;
    session.descriptionRu = undefined;
    await ctx.reply("Step 1/9 — send the English title.");
  });

  bot.command("done", async (ctx) => {
    const session = getSession(ctx.from!.id);
    if (session.step === "photos") {
      session.step = "videos";
      await ctx.reply("Step 6/9 — send videos (mp4), or type skip / /done.");
      return;
    }
    if (session.step === "videos") {
      session.step = "youtube";
      await ctx.reply("Step 7/9 — send a YouTube URL, or type skip.");
      return;
    }
    await ctx.reply("Nothing to finish. Use /newproject.");
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
    const stored = await downloadTelegramFile(bot, best.file_id, "image/jpeg");
    session.images.push(stored);
    await ctx.reply(`Stored ${session.images.length} photo(s). Send more or /done.`);
  });

  bot.on("video", async (ctx) => {
    const session = getSession(ctx.from!.id);
    if (session.step !== "videos") {
      await ctx.reply("Videos are only accepted during /newproject.");
      return;
    }
    const video = ctx.message.video;
    const stored = await downloadTelegramFile(bot, video.file_id, video.mime_type ?? "video/mp4");
    session.videos.push(stored);
    await ctx.reply(`Stored ${session.videos.length} video(s). Send more or /done.`);
  });

  bot.on("document", async (ctx) => {
    const session = getSession(ctx.from!.id);
    if (session.step !== "videos") {
      await ctx.reply("Documents are only accepted as videos during /newproject.");
      return;
    }
    const doc = ctx.message.document;
    const mime = doc.mime_type ?? "";
    if (!mime.startsWith("video/")) {
      await ctx.reply("Send a video file (mp4/webm).");
      return;
    }
    const stored = await downloadTelegramFile(bot, doc.file_id, mime);
    session.videos.push(stored);
    await ctx.reply(`Stored ${session.videos.length} video(s). Send more or /done.`);
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const session = getSession(ctx.from!.id);

    if (session.step === "titleEn") {
      session.titleEn = text;
      session.step = "titleRu";
      await ctx.reply("Step 2/9 — send the Russian title.");
      return;
    }

    if (session.step === "titleRu") {
      session.titleRu = text;
      session.step = "descriptionEn";
      await ctx.reply("Step 3/9 — send the English description.");
      return;
    }

    if (session.step === "descriptionEn") {
      session.descriptionEn = text;
      session.step = "descriptionRu";
      await ctx.reply("Step 4/9 — send the Russian description.");
      return;
    }

    if (session.step === "descriptionRu") {
      session.descriptionRu = text;
      session.step = "photos";
      await ctx.reply("Step 5/9 — send photos (bulk allowed). Type /done when finished.");
      return;
    }

    if (session.step === "videos" && text.toLowerCase() === "skip") {
      session.step = "youtube";
      await ctx.reply("Step 7/9 — send a YouTube URL, or type skip.");
      return;
    }

    if (session.step === "youtube") {
      session.youtubeUrl = text.toLowerCase() === "skip" ? "" : text;
      session.step = "links";
      await ctx.reply("Step 8/9 — send links as Label|url, Label|url or type skip.");
      return;
    }

    if (session.step === "links") {
      try {
        session.tagsLinks = parseTagLinks(text);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Validation failed";
        await ctx.reply(`Rejected: ${message}. Fix the last step or /cancel.`);
        return;
      }
      const folders = await listFolders();
      if (folders.length === 0) {
        await saveWizardProject(ctx.from!.id, session, null, ctx.reply.bind(ctx));
        return;
      }
      session.step = "folder";
      await ctx.reply(
        [
          "Step 9/9 — send a folder number, or type skip:",
          ...folders.map((folder, index) => `${index + 1}. ${folder.titleEn} / ${folder.titleRu}`),
        ].join("\n")
      );
      return;
    }

    if (session.step === "folder") {
      let folderId: string | null = null;
      if (text.toLowerCase() !== "skip") {
        const folders = await listFolders();
        const picked = folders[Number(text) - 1];
        if (!picked) {
          await ctx.reply("Unknown folder. Send a number from the list or skip.");
          return;
        }
        folderId = picked.id;
      }
      await saveWizardProject(ctx.from!.id, session, folderId, ctx.reply.bind(ctx));
      return;
    }

    await ctx.reply("Use /newproject to add a record. Edit everything in /admin.");
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
