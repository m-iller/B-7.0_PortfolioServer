import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { isGroupChat, isPrivileged } from "./dnd/access.js";
import { MAX_POLL_OPTIONS } from "./dnd/constants.js";
import { wrap } from "./dnd/logic.js";
import { DndRuntime } from "./dnd/runtime.js";
import {
  ensureChat,
  getPlaces,
  getSettings,
  listChatIds,
  patchSettings,
  putPlaces,
} from "./dnd/store.js";
import {
  groupPickKeyboard,
  helpText,
  parseCallback,
  placesKeyboard,
  placesText,
  settingsKeyboard,
  settingsText,
} from "./dnd/ui.js";

type Pending =
  | { kind: "text"; field: "zeroVotesMessage" | "resultMessage" | "nemoguMessage"; chatId: number }
  | { kind: "addPlace"; chatId: number }
  | { kind: "places"; chatId: number };

const pending = new Map<number, Pending>();

function commandOf(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

async function privilegedGroups(
  telegram: Telegraf["telegram"],
  userId: number
): Promise<{ chatId: number; title: string }[]> {
  const groups = [];
  for (const chatId of listChatIds()) {
    if (await isPrivileged(telegram, chatId, userId)) {
      const settings = getSettings(chatId);
      groups.push({ chatId, title: settings.title || String(chatId) });
    }
  }
  return groups;
}

async function failPoll(reply: (text: string) => Promise<unknown>, error: unknown): Promise<void> {
  console.error("[dnd] poll", error);
  await reply("Не удалось запустить опрос. Дайте боту право отправлять сообщения и опросы.");
}

async function showSettings(
  telegram: Telegraf["telegram"],
  chatId: number,
  userId: number,
  send: (text: string, extra?: object) => Promise<unknown>
): Promise<void> {
  const title = (await telegram.getChat(chatId).catch(() => null)) as { title?: string } | null;
  const settings = ensureChat(chatId, title?.title);
  const canEdit = await isPrivileged(telegram, chatId, userId);
  await send(settingsText(chatId, settings, canEdit), canEdit ? settingsKeyboard(chatId) : undefined);
}

async function showPlaces(
  telegram: Telegraf["telegram"],
  chatId: number,
  userId: number,
  send: (text: string, extra?: object) => Promise<unknown>
): Promise<boolean> {
  if (!(await isPrivileged(telegram, chatId, userId))) {
    await send("Места меняет создатель чата или админ бота.");
    return false;
  }
  const title = (await telegram.getChat(chatId).catch(() => null)) as { title?: string } | null;
  const settings = ensureChat(chatId, title?.title);
  const places = getPlaces(chatId);
  await send(placesText(chatId, settings.title, places), placesKeyboard(chatId, places));
  return true;
}

async function pickGroup(
  telegram: Telegraf["telegram"],
  userId: number,
  purpose: "s" | "p",
  reply: (text: string, extra?: object) => Promise<unknown>
): Promise<void> {
  const groups = await privilegedGroups(telegram, userId);
  if (groups.length === 0) {
    await reply("Нет групп, где вы создатель (или админ бота). Сначала добавьте бота в группу.");
    return;
  }
  await reply("Выберите группу:", groupPickKeyboard(groups, purpose));
}

async function main(): Promise<void> {
  if (!config.telegramBotToken) {
    console.log("[bot] TELEGRAM_BOT_TOKEN empty — worker idle");
    setInterval(() => undefined, 60_000);
    return;
  }

  const bot = new Telegraf(config.telegramBotToken);
  const me = await bot.telegram.getMe();
  const runtime = new DndRuntime(bot.telegram, me.id);

  bot.start(async (ctx) => {
    await ctx.reply(helpText());
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;
    const text = ctx.message.text;
    const cmd = commandOf(text);
    const chat = ctx.chat;
    const reply = (body: string, extra?: object) => ctx.reply(body, extra);

    if (cmd === "dnd help") {
      pending.delete(userId);
      await reply(helpText());
      return;
    }

    if (cmd === "dnd vote start") {
      pending.delete(userId);
      if (!isGroupChat(chat.type)) {
        await reply("Запустите опрос в группе.");
        return;
      }
      try {
        await reply(await runtime.startSchedulePoll(chat.id, "manual"));
      } catch (error) {
        await failPoll(reply, error);
      }
      return;
    }

    if (cmd === "dnd place vote start") {
      pending.delete(userId);
      if (!isGroupChat(chat.type)) {
        await reply("Запустите опрос места в группе.");
        return;
      }
      try {
        const result = await runtime.startPlacePoll(chat.id, "manual");
        if (result) await reply(result);
      } catch (error) {
        await failPoll(reply, error);
      }
      return;
    }

    if (cmd === "dnd place edit") {
      pending.delete(userId);
      if (isGroupChat(chat.type)) {
        if (await showPlaces(bot.telegram, chat.id, userId, reply)) {
          pending.set(userId, { kind: "places", chatId: chat.id });
        }
        return;
      }
      await pickGroup(bot.telegram, userId, "p", reply);
      return;
    }

    if (cmd === "dnd") {
      pending.delete(userId);
      if (isGroupChat(chat.type)) {
        await showSettings(bot.telegram, chat.id, userId, reply);
        return;
      }
      await pickGroup(bot.telegram, userId, "s", reply);
      return;
    }

    const wait = pending.get(userId);
    if (!wait) return;

    const trimmed = text.trim();
    if (trimmed.toLowerCase() === "стоп") {
      pending.delete(userId);
      await reply("Ок.");
      return;
    }

    if (wait.kind === "text") {
      if (!(await isPrivileged(bot.telegram, wait.chatId, userId))) {
        pending.delete(userId);
        await reply("Недостаточно прав.");
        return;
      }
      if (!trimmed) {
        await reply("Пустой текст. Пришлите сообщение или стоп.");
        return;
      }
      patchSettings(wait.chatId, { [wait.field]: trimmed });
      pending.delete(userId);
      const settings = getSettings(wait.chatId);
      await reply(settingsText(wait.chatId, settings, true), settingsKeyboard(wait.chatId));
      return;
    }

    if (wait.kind === "addPlace" || wait.kind === "places") {
      if (!(await isPrivileged(bot.telegram, wait.chatId, userId))) {
        pending.delete(userId);
        await reply("Недостаточно прав.");
        return;
      }
      const places = getPlaces(wait.chatId);
      const addMatch = /^\+\s+(.+)$/.exec(trimmed);
      const delMatch = /^-\s+(\d+)$/.exec(trimmed);
      if (wait.kind === "addPlace" && !addMatch && !delMatch) {
        if (places.length >= MAX_POLL_OPTIONS) {
          await reply("Уже 10 мест — лимит опроса Telegram.");
          pending.set(userId, { kind: "places", chatId: wait.chatId });
          return;
        }
        putPlaces(wait.chatId, [...places, trimmed]);
        pending.set(userId, { kind: "places", chatId: wait.chatId });
        const settings = getSettings(wait.chatId);
        await reply(placesText(wait.chatId, settings.title, getPlaces(wait.chatId)), placesKeyboard(wait.chatId, getPlaces(wait.chatId)));
        return;
      }
      if (addMatch) {
        if (places.length >= MAX_POLL_OPTIONS) {
          await reply("Уже 10 мест — лимит опроса Telegram.");
          return;
        }
        putPlaces(wait.chatId, [...places, addMatch[1].trim()]);
      } else if (delMatch) {
        const index = Number(delMatch[1]) - 1;
        if (index < 0 || index >= places.length) {
          await reply("Нет такого номера.");
          return;
        }
        const next = places.filter((_, i) => i !== index);
        putPlaces(wait.chatId, next);
      } else if (wait.kind === "places") {
        return;
      }
      pending.set(userId, { kind: "places", chatId: wait.chatId });
      const settings = getSettings(wait.chatId);
      const nextPlaces = getPlaces(wait.chatId);
      await reply(placesText(wait.chatId, settings.title, nextPlaces), placesKeyboard(wait.chatId, nextPlaces));
    }
  });

  bot.on("callback_query", async (ctx) => {
    const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
    const userId = ctx.from.id;
    const parsed = data ? parseCallback(data) : undefined;
    if (!parsed) {
      await ctx.answerCbQuery();
      return;
    }

    const { scope, action, chatId, extra } = parsed;

    if (scope === "g") {
      if (!(await isPrivileged(bot.telegram, chatId, userId))) {
        await ctx.answerCbQuery("Недостаточно прав.", { show_alert: true });
        return;
      }
      if (action === "s") {
        pending.delete(userId);
        await ctx.answerCbQuery();
        await showSettings(bot.telegram, chatId, userId, (body, extraMarkup) => ctx.editMessageText(body, extraMarkup));
        return;
      }
      if (action === "p") {
        await ctx.answerCbQuery();
        if (await showPlaces(bot.telegram, chatId, userId, (body, extraMarkup) => ctx.editMessageText(body, extraMarkup))) {
          pending.set(userId, { kind: "places", chatId });
        }
        return;
      }
      await ctx.answerCbQuery();
      return;
    }

    if (!(await isPrivileged(bot.telegram, chatId, userId))) {
      await ctx.answerCbQuery("Недостаточно прав.", { show_alert: true });
      return;
    }

    if (scope === "s") {
      const settings = getSettings(chatId);
      if (action === "av") patchSettings(chatId, { autoVote: !settings.autoVote });
      if (action === "ap") patchSettings(chatId, { autoPlaceVote: !settings.autoPlaceVote });
      if (action === "nm") patchSettings(chatId, { skipIfNemogu: !settings.skipIfNemogu });
      if (action === "wd") patchSettings(chatId, { autoWeekday: wrap(settings.autoWeekday + 1, 0, 6) });
      if (action === "hp") patchSettings(chatId, { autoHour: wrap(settings.autoHour + 1, 0, 23) });
      if (action === "hm") patchSettings(chatId, { autoHour: wrap(settings.autoHour - 1, 0, 23) });
      if (action === "mp") {
        patchSettings(chatId, { autoMinute: wrap(Math.floor(settings.autoMinute / 15) + 1, 0, 3) * 15 });
      }
      if (action === "mm") {
        patchSettings(chatId, { autoMinute: wrap(Math.floor(settings.autoMinute / 15) - 1, 0, 3) * 15 });
      }
      if (action === "tz" || action === "tr" || action === "tn") {
        const field =
          action === "tz" ? "zeroVotesMessage" : action === "tr" ? "resultMessage" : "nemoguMessage";
        pending.set(userId, { kind: "text", field, chatId });
        await ctx.answerCbQuery();
        await ctx.reply("Пришлите новый текст одним сообщением. стоп — отмена. Плейсхолдеры: {days} {places}");
        return;
      }
      await ctx.answerCbQuery();
      const next = getSettings(chatId);
      try {
        await ctx.editMessageText(settingsText(chatId, next, true), settingsKeyboard(chatId));
      } catch {
        /* not modified */
      }
      return;
    }

    if (scope === "p") {
      if (action === "x") {
        pending.delete(userId);
        await ctx.answerCbQuery("Готово");
        try {
          await ctx.editMessageReplyMarkup(undefined);
        } catch {
          /* ignore */
        }
        return;
      }
      if (action === "a") {
        pending.set(userId, { kind: "addPlace", chatId });
        await ctx.answerCbQuery();
        await ctx.reply("Пришлите название места. стоп — отмена.");
        return;
      }
      if (action === "d" && extra !== undefined) {
        const places = getPlaces(chatId);
        if (extra >= 0 && extra < places.length) {
          putPlaces(
            chatId,
            places.filter((_, index) => index !== extra)
          );
        }
        pending.set(userId, { kind: "places", chatId });
        const nextPlaces = getPlaces(chatId);
        const settings = getSettings(chatId);
        await ctx.answerCbQuery();
        try {
          await ctx.editMessageText(
            placesText(chatId, settings.title, nextPlaces),
            placesKeyboard(chatId, nextPlaces)
          );
        } catch {
          /* not modified */
        }
        return;
      }
    }

    await ctx.answerCbQuery();
  });

  bot.on("poll_answer", async (ctx) => {
    const answer = ctx.pollAnswer;
    if (!answer.user || answer.user.is_bot) return;
    await runtime.onPollAnswer(answer.poll_id, answer.user.id, answer.option_ids);
  });

  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    const chat = update.chat;
    if (!isGroupChat(chat.type)) return;
    const present = (status: string) =>
      status === "member" || status === "administrator" || status === "restricted";
    if (!present(update.new_chat_member.status) || present(update.old_chat_member.status)) return;
    const title = "title" in chat ? chat.title : String(chat.id);
    ensureChat(chat.id, title);
    await ctx.telegram.sendMessage(
      chat.id,
      ["DND-бот на месте. Напишите dnd help.", "BotFather → /setprivacy → Disable, иначе команды без / не работают."].join(
        "\n"
      )
    );
  });

  runtime.startTimers();

  await bot.launch({
    allowedUpdates: ["message", "callback_query", "poll_answer", "my_chat_member"],
  });
  console.log(`[bot] DND long-polling as @${me.username ?? me.id}`);

  const shutdown = async () => {
    bot.stop("shutdown");
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[bot] fatal", error);
  process.exit(1);
});
