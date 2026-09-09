import "./loadEnv.js";
import { Telegraf } from "telegraf";
import { config } from "./config.js";
import { isGroupChat, isPrivileged } from "./dnd/access.js";
import {
  MAX_POLL_OPTIONS,
  MAX_POLL_TTL_HOURS,
  MAX_QUORUM_COUNT,
  MIN_POLL_TTL_HOURS,
  MIN_QUORUM_COUNT,
} from "./dnd/constants.js";
import { wrap } from "./dnd/logic.js";
import { parsePlaceInput } from "./dnd/places.js";
import { DndRuntime, NoActivePollError, statsText } from "./dnd/runtime.js";
import {
  ensureChat,
  findRosterByUsername,
  getPlaces,
  getRoster,
  getSettings,
  listChatIds,
  patchSettings,
  putPlaces,
  upsertRosterPerson,
} from "./dnd/store.js";
import {
  groupPickKeyboard,
  helpText,
  parseCallback,
  placesKeyboard,
  placesText,
  settingsKeyboard,
  settingsText,
  spectatorsKeyboard,
  spectatorsText,
} from "./dnd/ui.js";
import type { RosterPerson } from "./dnd/types.js";

type TextField = "zeroVotesMessage" | "resultMessage" | "nemoguMessage";

type Pending =
  | { kind: "text"; field: TextField; chatId: number }
  | { kind: "addPlace"; chatId: number }
  | { kind: "places"; chatId: number }
  | { kind: "spectators"; chatId: number };

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
  await send(settingsText(chatId, settings, canEdit), canEdit ? settingsKeyboard(chatId, settings) : undefined);
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

function spectatorRows(chatId: number): { userId: number; person: RosterPerson }[] {
  return Object.entries(getRoster(chatId))
    .filter(([, person]) => person.spectator && !person.left)
    .map(([id, person]) => ({ userId: Number(id), person }));
}

function addPlaceFromText(
  chatId: number,
  raw: string,
  entities: readonly {
    type: string;
    offset: number;
    length: number;
    user?: { id: number; is_bot?: boolean; username?: string; first_name: string };
  }[] | undefined,
  runtime: DndRuntime
): string | undefined {
  const parsed = parsePlaceInput(raw, entities);
  if (!parsed.name) return "Пустое название.";
  const places = getPlaces(chatId);
  if (places.length >= MAX_POLL_OPTIONS) return "Уже 10 мест — лимит опроса Telegram.";
  if (places.some((place) => place.name === parsed.name)) return "Такое место уже есть.";
  let ownerId: number | null = null;
  if (parsed.ownerUser) {
    runtime.rememberUser(chatId, parsed.ownerUser);
    ownerId = parsed.ownerUser.id;
  } else if (parsed.ownerUsername) {
    const found = findRosterByUsername(chatId, parsed.ownerUsername);
    if (!found) return "Нет в списке. Пусть напишет в чат или проголосует.";
    ownerId = found.userId;
  }
  putPlaces(chatId, [...places, { name: parsed.name, ownerId }]);
  return undefined;
}

async function showSpectators(
  telegram: Telegraf["telegram"],
  chatId: number,
  userId: number,
  send: (text: string, extra?: object) => Promise<unknown>
): Promise<boolean> {
  if (!(await isPrivileged(telegram, chatId, userId))) {
    await send("Зрителей меняет создатель чата или админ бота.");
    return false;
  }
  const title = (await telegram.getChat(chatId).catch(() => null)) as { title?: string } | null;
  const settings = ensureChat(chatId, title?.title);
  const people = spectatorRows(chatId);
  await send(spectatorsText(chatId, settings.title, people), spectatorsKeyboard(chatId, people));
  return true;
}

async function pickGroup(
  telegram: Telegraf["telegram"],
  userId: number,
  purpose: "s" | "p" | "v",
  reply: (text: string, extra?: object) => Promise<unknown>
): Promise<void> {
  const groups = await privilegedGroups(telegram, userId);
  if (groups.length === 0) {
    await reply("Нет групп, где вы создатель (или админ бота). Сначала добавьте бота в группу.");
    return;
  }
  await reply("Выберите группу:", groupPickKeyboard(groups, purpose));
}

function toggleAlways(chatId: number, targetId: number, username: string, firstName: string): string {
  const current = getRoster(chatId)[String(targetId)];
  const next = !current?.alwaysCan;
  upsertRosterPerson(chatId, targetId, { username, firstName, alwaysCan: next, left: false });
  const who = username ? `@${username}` : firstName;
  return next ? `${who} всегда может — дни засчитаются без голоса.` : `${who} больше не «всегда могу».`;
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
    if (ctx.chat && isGroupChat(ctx.chat.type)) return;
    await ctx.reply(helpText());
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;
    const text = ctx.message.text;
    const cmd = commandOf(text);
    const chat = ctx.chat;
    const reply = (body: string, extra?: object) => ctx.reply(body, extra);

    if (isGroupChat(chat.type) && ctx.from) {
      runtime.rememberUser(chat.id, ctx.from);
    }

    if (cmd === "dnd help") {
      pending.delete(userId);
      await reply(helpText());
      return;
    }

    if (cmd === "dnd stats") {
      pending.delete(userId);
      if (!isGroupChat(chat.type)) {
        await reply("Статистика смотрится в группе.");
        return;
      }
      await reply(statsText(chat.id));
      return;
    }

    const alwaysMatch = /^dnd always(?:\s+@?(\S+))?$/.exec(cmd);
    if (alwaysMatch) {
      pending.delete(userId);
      if (!isGroupChat(chat.type)) {
        await reply("dnd always — только в группе.");
        return;
      }
      const targetName = alwaysMatch[1];
      if (!targetName) {
        await reply(toggleAlways(chat.id, userId, ctx.from.username ?? "", ctx.from.first_name));
        return;
      }
      if (!(await isPrivileged(bot.telegram, chat.id, userId))) {
        await reply("Чужой статус меняет создатель чата или админ бота.");
        return;
      }
      const found = findRosterByUsername(chat.id, targetName);
      if (!found) {
        await reply("Нет в списке. Пусть напишет в чат или проголосует.");
        return;
      }
      await reply(toggleAlways(chat.id, found.userId, found.person.username, found.person.firstName));
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

    if (cmd === "dnd spectators") {
      pending.delete(userId);
      if (isGroupChat(chat.type)) {
        if (await showSpectators(bot.telegram, chat.id, userId, reply)) {
          pending.set(userId, { kind: "spectators", chatId: chat.id });
        }
        return;
      }
      await pickGroup(bot.telegram, userId, "v", reply);
      return;
    }

    if (cmd === "dnd stop") {
      pending.delete(userId);
      if (!isGroupChat(chat.type)) {
        await reply("Остановить опрос можно только в группе.");
        return;
      }
      if (!(await isPrivileged(bot.telegram, chat.id, userId))) {
        await reply("Остановить может создатель чата или админ бота.");
        return;
      }
      try {
        await runtime.stopPollEarly(chat.id);
      } catch (error) {
        if (error instanceof NoActivePollError) {
          await reply(error.message);
          return;
        }
        console.error("[dnd] stop", error);
        await reply("Не удалось остановить опрос.");
      }
      return;
    }

    if (cmd === "dnd settings") {
      pending.delete(userId);
      if (isGroupChat(chat.type)) {
        await showSettings(bot.telegram, chat.id, userId, reply);
        return;
      }
      await pickGroup(bot.telegram, userId, "s", reply);
      return;
    }

    if (cmd === "dnd") {
      pending.delete(userId);
      await reply("Настройки: dnd settings");
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
      await reply(settingsText(wait.chatId, settings, true), settingsKeyboard(wait.chatId, settings));
      return;
    }

    if (wait.kind === "spectators") {
      if (!(await isPrivileged(bot.telegram, wait.chatId, userId))) {
        pending.delete(userId);
        await reply("Недостаточно прав.");
        return;
      }
      const replyFrom = ctx.message.reply_to_message?.from;
      const addMatch = /^\+\s+@?(\S+)$/.exec(trimmed);
      const delMatch = /^-\s+(\d+)$/.exec(trimmed);
      if (replyFrom && !replyFrom.is_bot && (trimmed === "+" || trimmed.toLowerCase() === "+")) {
        runtime.rememberUser(wait.chatId, replyFrom, { spectator: true });
      } else if (addMatch) {
        const found = findRosterByUsername(wait.chatId, addMatch[1]);
        if (!found) {
          await reply("Нет в списке. Пусть напишет в чат или проголосует.");
          return;
        }
        upsertRosterPerson(wait.chatId, found.userId, { spectator: true });
      } else if (delMatch) {
        const people = spectatorRows(wait.chatId);
        const index = Number(delMatch[1]) - 1;
        if (index < 0 || index >= people.length) {
          await reply("Нет такого номера.");
          return;
        }
        upsertRosterPerson(wait.chatId, people[index].userId, { spectator: false });
      } else {
        return;
      }
      pending.set(userId, { kind: "spectators", chatId: wait.chatId });
      const settings = getSettings(wait.chatId);
      const people = spectatorRows(wait.chatId);
      await reply(spectatorsText(wait.chatId, settings.title, people), spectatorsKeyboard(wait.chatId, people));
      return;
    }

    if (wait.kind === "addPlace" || wait.kind === "places") {
      if (!(await isPrivileged(bot.telegram, wait.chatId, userId))) {
        pending.delete(userId);
        await reply("Недостаточно прав.");
        return;
      }
      const places = getPlaces(wait.chatId);
      const delMatch = /^-\s+(\d+)$/.exec(trimmed);
      if (delMatch) {
        const index = Number(delMatch[1]) - 1;
        if (index < 0 || index >= places.length) {
          await reply("Нет такого номера.");
          return;
        }
        putPlaces(
          wait.chatId,
          places.filter((_, i) => i !== index)
        );
      } else if (wait.kind === "addPlace" || /^\+\s+/.test(trimmed)) {
        const error = addPlaceFromText(wait.chatId, text, ctx.message.entities, runtime);
        if (error) {
          await reply(error);
          return;
        }
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
      if (action === "v") {
        await ctx.answerCbQuery();
        if (await showSpectators(bot.telegram, chatId, userId, (body, extraMarkup) => ctx.editMessageText(body, extraMarkup))) {
          pending.set(userId, { kind: "spectators", chatId });
        }
        return;
      }
      await ctx.answerCbQuery();
      return;
    }

    if (scope === "o") {
      await ctx.answerCbQuery("Кнопки устарели. Голосуйте в опросе «Да» / «Нет».", { show_alert: true });
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
      if (action === "pn") patchSettings(chatId, { pinPolls: !settings.pinPolls });
      if (action === "rh") patchSettings(chatId, { reminderHours: wrap(settings.reminderHours + 1, 0, 2) });
      if (action === "wd") patchSettings(chatId, { autoWeekday: wrap(settings.autoWeekday + 1, 0, 6) });
      if (action === "hp") patchSettings(chatId, { autoHour: wrap(settings.autoHour + 1, 0, 23) });
      if (action === "hm") patchSettings(chatId, { autoHour: wrap(settings.autoHour - 1, 0, 23) });
      if (action === "mp") {
        patchSettings(chatId, { autoMinute: wrap(Math.floor(settings.autoMinute / 15) + 1, 0, 3) * 15 });
      }
      if (action === "mm") {
        patchSettings(chatId, { autoMinute: wrap(Math.floor(settings.autoMinute / 15) - 1, 0, 3) * 15 });
      }
      if (action === "th") {
        patchSettings(chatId, { pollTtlHours: wrap(settings.pollTtlHours + 1, MIN_POLL_TTL_HOURS, MAX_POLL_TTL_HOURS) });
      }
      if (action === "tl") {
        patchSettings(chatId, { pollTtlHours: wrap(settings.pollTtlHours - 1, MIN_POLL_TTL_HOURS, MAX_POLL_TTL_HOURS) });
      }
      if (action === "dh") {
        patchSettings(chatId, {
          dayPickTtlHours: wrap(settings.dayPickTtlHours + 1, MIN_POLL_TTL_HOURS, MAX_POLL_TTL_HOURS),
        });
      }
      if (action === "dl") {
        patchSettings(chatId, {
          dayPickTtlHours: wrap(settings.dayPickTtlHours - 1, MIN_POLL_TTL_HOURS, MAX_POLL_TTL_HOURS),
        });
      }
      if (action === "qa") patchSettings(chatId, { scheduleQuorumAll: !settings.scheduleQuorumAll });
      if (action === "qp") {
        patchSettings(chatId, {
          scheduleQuorumAll: false,
          scheduleQuorumCount: Math.min(MAX_QUORUM_COUNT, settings.scheduleQuorumCount + 1),
        });
      }
      if (action === "qm") {
        patchSettings(chatId, {
          scheduleQuorumAll: false,
          scheduleQuorumCount: Math.max(MIN_QUORUM_COUNT, settings.scheduleQuorumCount - 1),
        });
      }
      if (action === "ra") patchSettings(chatId, { placeQuorumAll: !settings.placeQuorumAll });
      if (action === "rp") {
        patchSettings(chatId, {
          placeQuorumAll: false,
          placeQuorumCount: Math.min(MAX_QUORUM_COUNT, settings.placeQuorumCount + 1),
        });
      }
      if (action === "rm") {
        patchSettings(chatId, {
          placeQuorumAll: false,
          placeQuorumCount: Math.max(MIN_QUORUM_COUNT, settings.placeQuorumCount - 1),
        });
      }
      if (action === "tz" || action === "tr" || action === "tn") {
        const field: TextField =
          action === "tz" ? "zeroVotesMessage" : action === "tr" ? "resultMessage" : "nemoguMessage";
        pending.set(userId, { kind: "text", field, chatId });
        await ctx.answerCbQuery();
        await ctx.reply("Пришлите новый текст одним сообщением. стоп — отмена. Плейсхолдеры: {day} {days} {place} {places} {tags}");
        return;
      }
      await ctx.answerCbQuery();
      const next = getSettings(chatId);
      try {
        await ctx.editMessageText(settingsText(chatId, next, true), settingsKeyboard(chatId, next));
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
        await ctx.reply("Пришлите название. Хозяин: тег @user в том же сообщении. Без тега — без хозяина (кафе). стоп — отмена.");
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

    if (scope === "v") {
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
      if (action === "d" && extra !== undefined) {
        const people = spectatorRows(chatId);
        if (extra >= 0 && extra < people.length) {
          upsertRosterPerson(chatId, people[extra].userId, { spectator: false });
        }
        pending.set(userId, { kind: "spectators", chatId });
        const settings = getSettings(chatId);
        const nextPeople = spectatorRows(chatId);
        await ctx.answerCbQuery();
        try {
          await ctx.editMessageText(
            spectatorsText(chatId, settings.title, nextPeople),
            spectatorsKeyboard(chatId, nextPeople)
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
    await runtime.onPollAnswer(answer.poll_id, answer.user, answer.option_ids);
  });

  bot.on("new_chat_members", async (ctx) => {
    if (!isGroupChat(ctx.chat.type)) return;
    for (const user of ctx.message.new_chat_members) {
      runtime.rememberUser(ctx.chat.id, user);
    }
  });

  bot.on("left_chat_member", async (ctx) => {
    if (!isGroupChat(ctx.chat.type)) return;
    runtime.markLeft(ctx.chat.id, ctx.message.left_chat_member);
  });

  bot.on("chat_member", async (ctx) => {
    const update = ctx.chatMember;
    if (!isGroupChat(update.chat.type)) return;
    const user = update.new_chat_member.user;
    const status = update.new_chat_member.status;
    if (status === "left" || status === "kicked") {
      runtime.markLeft(update.chat.id, user);
      return;
    }
    runtime.rememberUser(update.chat.id, user);
  });

  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    const chat = update.chat;
    if (!isGroupChat(chat.type)) return;
    const present = (status: string) =>
      status === "member" || status === "administrator" || status === "restricted";
    if (!present(update.new_chat_member.status) || present(update.old_chat_member.status)) return;
    const title = "title" in chat ? chat.title : String(chat.id);
    const known = listChatIds().includes(chat.id);
    ensureChat(chat.id, title);
    if (known) return;
    await ctx.telegram.sendMessage(
      chat.id,
      ["DND-бот на месте. Напишите dnd help.", "Дайте боту право закреплять сообщения — опросы пинятся."].join("\n")
    );
  });

  runtime.startTimers();

  await bot.launch({
    allowedUpdates: ["message", "callback_query", "poll_answer", "my_chat_member", "chat_member"],
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
