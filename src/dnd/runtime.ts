import type { Telegram } from "telegraf";
import {
  MAX_POLL_OPTIONS,
  PLACE_QUESTION,
  POLL_TTL_MS,
  SCHEDULE_OPTIONS,
  SCHEDULE_QUESTION,
} from "./constants.js";
import {
  placeResult,
  scheduleResult,
  shouldFireAuto,
  talliesFromPoll,
  talliesFromVoters,
  uniqueVoterCount,
} from "./logic.js";
import { moscowParts } from "./time.js";
import {
  deletePoll,
  ensureChat,
  getPlaces,
  getPoll,
  getSettings,
  listChatIds,
  listPolls,
  patchSettings,
  putPoll,
} from "./store.js";
import type { ActivePoll, ChatSettings } from "./types.js";

type TelegramApi = Telegram;

const tails = new Map<number, Promise<void>>();

async function serial<T>(chatId: number, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(chatId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(
    chatId,
    prev.then(() => gate).catch(() => gate)
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export class DndRuntime {
  constructor(
    private readonly telegram: TelegramApi,
    private readonly botId: number
  ) {}

  startTimers(): void {
    setInterval(() => {
      this.tick().catch((error) => console.error("[dnd] tick", error));
    }, 15_000);
    void this.tick();
  }

  async tick(): Promise<void> {
    await this.checkExpiries();
    await this.checkAutos();
  }

  async startSchedulePoll(chatId: number, reason: "manual" | "auto"): Promise<string> {
    return serial(chatId, () => this.startScheduleUnlocked(chatId, reason));
  }

  async startPlacePoll(chatId: number, reason: "manual" | "auto"): Promise<string> {
    return serial(chatId, () => this.startPlaceUnlocked(chatId, reason));
  }

  async onPollAnswer(pollId: string, userId: number, optionIds: number[]): Promise<void> {
    const poll = listPolls().find((row) => row.pollId === pollId);
    if (!poll) return;
    await serial(poll.chatId, async () => {
      const current = getPoll(poll.chatId);
      if (!current || current.pollId !== pollId) return;
      if (optionIds.length === 0) {
        delete current.voters[String(userId)];
      } else {
        current.voters[String(userId)] = optionIds;
      }
      putPoll(current);
      if (await this.everyoneVoted(current)) {
        await this.finishUnlocked(current.chatId, false);
      }
    });
  }

  async chatTitle(chatId: number): Promise<string> {
    try {
      const chat = await this.telegram.getChat(chatId);
      if ("title" in chat && chat.title) return chat.title;
    } catch {
      /* keep stored title */
    }
    return getSettings(chatId).title || String(chatId);
  }

  private async startScheduleUnlocked(chatId: number, reason: "manual" | "auto"): Promise<string> {
    ensureChat(chatId, await this.chatTitle(chatId));
    await this.stopUnlocked(chatId, true);
    return this.sendPoll(chatId, "schedule", SCHEDULE_QUESTION, [...SCHEDULE_OPTIONS], reason);
  }

  private async startPlaceUnlocked(chatId: number, reason: "manual" | "auto"): Promise<string> {
    ensureChat(chatId, await this.chatTitle(chatId));
    const places = getPlaces(chatId).slice(0, MAX_POLL_OPTIONS);
    if (places.length === 1) {
      await this.stopUnlocked(chatId, true);
      const text = `Место: ${places[0]}`;
      await this.telegram.sendMessage(chatId, text);
      return "";
    }
    if (places.length < 2) {
      if (reason === "manual") return "Мест меньше двух. Добавьте через dnd place edit.";
      return "";
    }
    await this.stopUnlocked(chatId, true);
    return this.sendPoll(chatId, "place", PLACE_QUESTION, places, reason);
  }

  private async sendPoll(
    chatId: number,
    kind: ActivePoll["kind"],
    question: string,
    options: string[],
    reason: "manual" | "auto"
  ): Promise<string> {
    const message = await this.telegram.sendPoll(chatId, question, options, {
      is_anonymous: false,
      allows_multiple_answers: true,
    });
    const pollId = message.poll?.id;
    if (!pollId) {
      throw new Error("Telegram did not return poll id");
    }
    putPoll({
      kind,
      chatId,
      messageId: message.message_id,
      pollId,
      startedAt: new Date().toISOString(),
      options,
      voters: {},
    });
    if (reason === "auto" && kind === "schedule") {
      patchSettings(chatId, { lastAutoDate: moscowParts().dateKey });
    }
    return `Опрос «${question}» запущен.`;
  }

  private async checkExpiries(): Promise<void> {
    for (const poll of listPolls()) {
      if (!elapsedPastTtl(poll)) continue;
      await serial(poll.chatId, () => this.finishUnlocked(poll.chatId, false)).catch((error) =>
        console.error("[dnd] expire", poll.chatId, error)
      );
    }
  }

  private async checkAutos(): Promise<void> {
    for (const chatId of listChatIds()) {
      const settings = getSettings(chatId);
      if (!shouldFireAuto(settings)) continue;
      await this.startSchedulePoll(chatId, "auto").catch((error) => {
        console.error("[dnd] auto vote", chatId, error);
        const text = String(error);
        if (/403|kicked|chat not found|bot was blocked/i.test(text)) {
          patchSettings(chatId, { lastAutoDate: moscowParts().dateKey });
        }
      });
    }
  }

  private async finishUnlocked(chatId: number, silent: boolean): Promise<void> {
    const poll = getPoll(chatId);
    if (!poll) return;
    deletePoll(chatId);

    let tallies = talliesFromVoters(poll.options, poll.voters);
    try {
      const stopped = await this.telegram.stopPoll(chatId, poll.messageId);
      tallies = talliesFromPoll(stopped.options);
    } catch (error) {
      if (!silent) console.error("[dnd] stopPoll", chatId, error);
    }

    if (silent) return;

    const settings = getSettings(chatId);
    const outcome = resultFor(poll, settings, tallies);
    try {
      await this.telegram.sendMessage(chatId, outcome.text, {
        reply_parameters: { message_id: poll.messageId, allow_sending_without_reply: true },
      });
    } catch {
      await this.telegram.sendMessage(chatId, outcome.text);
    }

    if (poll.kind === "schedule" && settings.autoPlaceVote && !outcome.skippedNemogu && outcome.names.length > 0) {
      await this.startPlaceUnlocked(chatId, "auto");
    }
  }

  private async stopUnlocked(chatId: number, silent: boolean): Promise<void> {
    if (!getPoll(chatId)) return;
    await this.finishUnlocked(chatId, silent);
  }

  private async everyoneVoted(poll: ActivePoll): Promise<boolean> {
    const voters = uniqueVoterCount(poll.voters);
    if (voters === 0) return false;
    try {
      const memberCount = await this.telegram.getChatMembersCount(poll.chatId);
      const admins = await this.telegram.getChatAdministrators(poll.chatId);
      const botIds = new Set(admins.filter((admin) => admin.user.is_bot).map((admin) => admin.user.id));
      botIds.add(this.botId);
      const humans = memberCount - botIds.size;
      return humans > 0 && voters >= humans;
    } catch (error) {
      console.error("[dnd] member count", poll.chatId, error);
      return false;
    }
  }
}

function resultFor(
  poll: ActivePoll,
  settings: ChatSettings,
  tallies: ReturnType<typeof talliesFromPoll>
): { text: string; skippedNemogu: boolean; names: string[] } {
  if (poll.kind === "place") {
    const result = placeResult(settings, tallies);
    return { ...result, skippedNemogu: false };
  }
  return scheduleResult(settings, tallies);
}

function elapsedPastTtl(poll: ActivePoll): boolean {
  const started = Date.parse(poll.startedAt);
  if (!Number.isFinite(started)) return true;
  return Date.now() - started >= POLL_TTL_MS;
}
