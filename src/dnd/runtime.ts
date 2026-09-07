import type { Telegram } from "telegraf";

interface TgUser {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name: string;
}
import {
  DAYPICK_QUESTION,
  DEFAULT_REMINDER,
  DEFAULT_SUMMARY,
  DEFAULT_SUMMARY_DAY_ONLY,
  MAX_POLL_OPTIONS,
  NEMOGU,
  ONESHOT_NO,
  ONESHOT_QUESTION,
  ONESHOT_YES,
  PLACE_QUESTION,
  POD_VOPROSOM,
  SCHEDULE_OPTIONS,
  SCHEDULE_QUESTION,
} from "./constants.js";
import {
  addVotesToTallies,
  applyTemplate,
  dayOptionIndexes,
  formatDay,
  formatDays,
  joinMentions,
  majorityDays,
  optionIndex,
  placeResult,
  scheduleResult,
  shouldFireAuto,
  talliesFromPoll,
  talliesFromVoters,
  uniqueVoterCount,
  userPicked,
} from "./logic.js";
import { eligiblePlaces } from "./places.js";
import { moscowParts } from "./time.js";
import {
  deletePoll,
  ensureChat,
  getHistory,
  getPlaces,
  getPoll,
  getRoster,
  getSession,
  getSettings,
  listChatIds,
  listPolls,
  patchSession,
  patchSettings,
  pushHistory,
  putPoll,
  upsertRosterPerson,
} from "./store.js";
import type { ActivePoll, ChatSettings, HistoryEntry, RosterPerson } from "./types.js";

type TelegramApi = Telegram;

export class NoActivePollError extends Error {
  constructor() {
    super("Нет активного опроса.");
    this.name = "NoActivePollError";
  }
}

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
    await this.checkReminders();
    await this.checkExpiries();
    await this.checkAutos();
  }

  async startSchedulePoll(chatId: number, reason: "manual" | "auto"): Promise<string> {
    return serial(chatId, () => this.startScheduleUnlocked(chatId, reason));
  }

  async startPlacePoll(chatId: number, reason: "manual" | "auto"): Promise<string> {
    return serial(chatId, () => this.startPlaceUnlocked(chatId, reason));
  }

  async stopPollEarly(chatId: number): Promise<void> {
    return serial(chatId, async () => {
      if (!getPoll(chatId)) {
        throw new NoActivePollError();
      }
      await this.finishUnlocked(chatId, false);
    });
  }

  rememberUser(chatId: number, user: TgUser, extra?: Partial<RosterPerson>): void {
    if (user.is_bot) return;
    const current = getRoster(chatId)[String(user.id)];
    upsertRosterPerson(chatId, user.id, {
      username: user.username ?? current?.username ?? "",
      firstName: user.first_name || current?.firstName || "игрок",
      left: false,
      ...extra,
    });
  }

  markLeft(chatId: number, user: TgUser): void {
    if (user.is_bot) return;
    upsertRosterPerson(chatId, user.id, {
      username: user.username ?? "",
      firstName: user.first_name || "игрок",
      left: true,
    });
  }

  async seedAdmins(chatId: number): Promise<void> {
    try {
      const admins = await this.telegram.getChatAdministrators(chatId);
      for (const admin of admins) {
        this.rememberUser(chatId, admin.user);
      }
    } catch {
      /* ignore */
    }
  }

  async onPollAnswer(pollId: string, user: TgUser, optionIds: number[]): Promise<void> {
    const poll = listPolls().find((row) => row.pollId === pollId);
    if (!poll || user.is_bot) return;
    await serial(poll.chatId, async () => {
      const current = getPoll(poll.chatId);
      if (!current || current.pollId !== pollId) return;
      this.rememberUser(poll.chatId, user);
      if (optionIds.length === 0) {
        delete current.voters[String(user.id)];
      } else {
        current.voters[String(user.id)] = optionIds;
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
    await this.seedAdmins(chatId);
    await this.stopUnlocked(chatId, true);
    patchSession(chatId, {
      oneshotOpen: false,
      lastDays: [],
      lastPlace: "",
      oneshotDays: [],
      oneshotMessageId: 0,
      nemoguUserIds: [],
      oneshotNoUserIds: [],
    });
    return this.sendPoll(chatId, "schedule", SCHEDULE_QUESTION, [...SCHEDULE_OPTIONS], reason);
  }

  private async startPlaceUnlocked(chatId: number, reason: "manual" | "auto"): Promise<string> {
    ensureChat(chatId, await this.chatTitle(chatId));
    const session = getSession(chatId);
    const all = getPlaces(chatId);
    const places = eligiblePlaces(all, [...session.nemoguUserIds, ...session.oneshotNoUserIds]).slice(
      0,
      MAX_POLL_OPTIONS
    );
    const names = places.map((place) => place.name);
    const days = [...new Set(session.lastDays.length ? session.lastDays : session.oneshotDays)];
    if (places.length >= 2 && days.length > 1) {
      await this.stopUnlocked(chatId, true);
      return this.sendPoll(chatId, "daypick", DAYPICK_QUESTION, days, reason);
    }
    if (all.length === 0) {
      if (reason === "manual") return "Мест нет. Добавьте через dnd place edit.";
      await this.maybePinSummary(chatId, days, "");
      return "";
    }
    if (places.length === 0) {
      const text = "Нет доступных мест для опроса (хозяева отметили «Не смогу» или «Нет»).";
      if (reason === "manual") return text;
      await this.telegram.sendMessage(chatId, text);
      await this.maybePinSummary(chatId, days, "");
      return "";
    }
    if (places.length === 1) {
      await this.stopUnlocked(chatId, true);
      await this.telegram.sendMessage(chatId, `Место: ${names[0]}`);
      patchSession(chatId, { lastPlace: names[0], oneshotOpen: false });
      await this.maybePinSummary(chatId, days, names[0]);
      return "";
    }
    await this.stopUnlocked(chatId, true);
    return this.sendPoll(chatId, "place", PLACE_QUESTION, names, reason);
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
      allows_multiple_answers: kind === "schedule" || kind === "place",
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
      reminderSent: false,
    });
    await this.pinUnlocked(chatId, message.message_id);
    if (reason === "auto" && kind === "schedule") {
      patchSettings(chatId, { lastAutoDate: moscowParts().dateKey });
    }
    return `Опрос «${question}» запущен.`;
  }

  private async checkExpiries(): Promise<void> {
    for (const poll of listPolls()) {
      if (!elapsedPastTtl(poll, getSettings(poll.chatId))) continue;
      await serial(poll.chatId, () => this.finishUnlocked(poll.chatId, false)).catch((error) =>
        console.error("[dnd] expire", poll.chatId, error)
      );
    }
  }

  private async checkReminders(): Promise<void> {
    for (const poll of listPolls()) {
      const settings = getSettings(poll.chatId);
      if (poll.reminderSent || settings.reminderHours <= 0) continue;
      if (!reminderDue(poll, settings)) continue;
      await serial(poll.chatId, () => this.remindUnlocked(poll.chatId)).catch((error) =>
        console.error("[dnd] remind", poll.chatId, error)
      );
    }
  }

  private async remindUnlocked(chatId: number): Promise<void> {
    const poll = getPoll(chatId);
    if (!poll || poll.reminderSent) return;
    poll.reminderSent = true;
    putPoll(poll);
    await this.refreshRosterUsernames(chatId);
    const tags = this.missingVoters(poll)
      .map((row) => row.person)
      .filter((person) => !person.left && !person.spectator);
    if (tags.length === 0) return;
    await this.telegram.sendMessage(chatId, applyTemplate(DEFAULT_REMINDER, { tags: joinMentions(tags) }), {
      reply_parameters: { message_id: poll.messageId, allow_sending_without_reply: true },
    });
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
    await this.unpinUnlocked(chatId, poll.messageId);

    if (poll.kind === "schedule") {
      tallies = this.applyAlwaysCan(chatId, poll, tallies);
    }

    if (silent) return;

    const settings = getSettings(chatId);
    await this.refreshRosterUsernames(chatId);

    if (poll.kind === "schedule") {
      await this.finishSchedule(chatId, poll, settings, tallies);
      return;
    }
    if (poll.kind === "oneshot") {
      await this.finishOneshot(chatId, poll, tallies);
      return;
    }
    if (poll.kind === "daypick") {
      await this.finishDaypick(chatId, poll, settings, tallies);
      return;
    }
    await this.finishPlace(chatId, poll, settings, tallies);
  }

  private async finishSchedule(
    chatId: number,
    poll: ActivePoll,
    settings: ChatSettings,
    tallies: ReturnType<typeof talliesFromPoll>
  ): Promise<void> {
    tallies = this.applyMissingAsNemogu(poll, tallies);
    this.bumpNemoguCounts(chatId, poll);
    const outcome = scheduleResult(settings, tallies);
    const majority = majorityDays(tallies);
    const day = formatDay(majority);
    const nemoguUserIds = this.voterIdsWhoPicked(poll, NEMOGU);
    patchSession(chatId, {
      lastDays: majority,
      lastPlace: "",
      oneshotOpen: false,
      nemoguUserIds,
      oneshotNoUserIds: [],
    });

    const uncertain = this.votersWhoPicked(chatId, poll, POD_VOPROSOM);
    if (uncertain.length > 0) {
      await this.sendChat(
        chatId,
        poll.messageId,
        applyTemplate(settings.uncertainMessage, { tags: joinMentions(uncertain), day, days: formatDays(outcome.names) })
      );
    }

    const someoneNemogu = (tallies.find((row) => row.text === NEMOGU)?.voterCount ?? 0) > 0;
    if (settings.skipIfNemogu && someoneNemogu) {
      const ready = await this.peopleNotNemogu(chatId, poll);
      const text = applyTemplate(settings.nemoguMessage, {
        tags: joinMentions(ready),
        day,
        days: formatDays(outcome.names),
      });
      await this.sendChat(chatId, poll.messageId, text);
      if (majority.length > 0) {
        await this.sendPoll(chatId, "oneshot", ONESHOT_QUESTION, [ONESHOT_YES, ONESHOT_NO], "auto");
        const oneshot = getPoll(chatId);
        patchSession(chatId, {
          oneshotOpen: true,
          oneshotDays: majority,
          oneshotMessageId: oneshot?.messageId ?? 0,
        });
      }
      pushHistory(chatId, historyEntry("schedule", majority, true));
      return;
    }

    await this.sendChat(chatId, poll.messageId, outcome.text);
    pushHistory(chatId, historyEntry("schedule", outcome.names, false));

    if (settings.autoPlaceVote && outcome.names.length > 0 && !someoneNemogu) {
      await this.startPlaceUnlocked(chatId, "auto");
      return;
    }
    await this.maybePinSummary(chatId, majority, "");
  }

  private async finishPlace(
    chatId: number,
    poll: ActivePoll,
    settings: ChatSettings,
    tallies: ReturnType<typeof talliesFromPoll>
  ): Promise<void> {
    const outcome = placeResult(settings, tallies);
    await this.sendChat(chatId, poll.messageId, outcome.text);
    const place = outcome.names[0] ?? "";
    patchSession(chatId, { lastPlace: place, oneshotOpen: false });
    pushHistory(chatId, historyEntry("place", outcome.names, false));
    const session = getSession(chatId);
    await this.maybePinSummary(chatId, session.lastDays, place);
  }

  private async finishOneshot(
    chatId: number,
    poll: ActivePoll,
    tallies: ReturnType<typeof talliesFromPoll>
  ): Promise<void> {
    const yes = tallies.find((row) => row.text === ONESHOT_YES)?.voterCount ?? 0;
    const no = tallies.find((row) => row.text === ONESHOT_NO)?.voterCount ?? 0;
    const oneshotNoUserIds = this.voterIdsWhoPicked(poll, ONESHOT_NO);
    const session = getSession(chatId);
    const days = session.oneshotDays.length ? session.oneshotDays : session.lastDays;
    patchSession(chatId, { oneshotOpen: false, oneshotNoUserIds, lastDays: days });

    if (yes > no) {
      await this.sendChat(chatId, poll.messageId, "Большинство за «Да» — опрос места.");
      await this.startPlaceUnlocked(chatId, "auto");
      return;
    }

    await this.sendChat(chatId, poll.messageId, "Большинство не за запуск опроса места.");
    await this.maybePinSummary(chatId, days, "");
  }

  private async finishDaypick(
    chatId: number,
    poll: ActivePoll,
    settings: ChatSettings,
    tallies: ReturnType<typeof talliesFromPoll>
  ): Promise<void> {
    const winners = majorityDays(tallies);
    if (winners.length === 1) {
      patchSession(chatId, { lastDays: winners, oneshotDays: winners, oneshotOpen: false });
      await this.sendChat(chatId, poll.messageId, `День: ${formatDay(winners)}`);
      await this.startPlaceUnlocked(chatId, "auto");
      return;
    }
    if (winners.length === 0) {
      await this.sendChat(chatId, poll.messageId, settings.zeroVotesMessage);
      const session = getSession(chatId);
      await this.maybePinSummary(chatId, session.lastDays, "");
      return;
    }
    patchSession(chatId, { lastDays: winners, oneshotDays: winners, oneshotOpen: false });
    await this.sendChat(chatId, poll.messageId, `Ничья: ${formatDays(winners)}. Ещё один опрос дня.`);
    await this.startPlaceUnlocked(chatId, "auto");
  }

  private applyMissingAsNemogu(
    poll: ActivePoll,
    tallies: ReturnType<typeof talliesFromPoll>
  ): ReturnType<typeof talliesFromPoll> {
    const index = optionIndex(poll.options, NEMOGU);
    if (index < 0) return tallies;
    let next = tallies;
    for (const { id } of this.missingVoters(poll)) {
      poll.voters[id] = [index];
      next = addVotesToTallies(next, [index]);
    }
    return next;
  }

  private applyAlwaysCan(
    chatId: number,
    poll: ActivePoll,
    tallies: ReturnType<typeof talliesFromPoll>
  ): ReturnType<typeof talliesFromPoll> {
    const days = dayOptionIndexes(poll.options);
    if (days.length === 0) return tallies;
    let next = tallies;
    for (const [id, person] of Object.entries(getRoster(chatId))) {
      if (!person.alwaysCan || person.left || person.spectator) continue;
      const votes = poll.voters[id];
      if (votes && votes.length > 0) continue;
      next = addVotesToTallies(next, days);
    }
    return next;
  }

  private bumpNemoguCounts(chatId: number, poll: ActivePoll): void {
    for (const [id, optionIds] of Object.entries(poll.voters)) {
      if (!userPicked(poll.options, optionIds, NEMOGU)) continue;
      const person = getRoster(chatId)[id];
      upsertRosterPerson(chatId, Number(id), { nemoguCount: (person?.nemoguCount ?? 0) + 1 });
    }
  }

  private voterIdsWhoPicked(poll: ActivePoll, name: string): number[] {
    const ids: number[] = [];
    for (const [id, optionIds] of Object.entries(poll.voters)) {
      if (!userPicked(poll.options, optionIds, name)) continue;
      const userId = Number(id);
      if (Number.isFinite(userId)) ids.push(userId);
    }
    return ids;
  }

  private votersWhoPicked(chatId: number, poll: ActivePoll, name: string): RosterPerson[] {
    const roster = getRoster(chatId);
    const people: RosterPerson[] = [];
    for (const [id, optionIds] of Object.entries(poll.voters)) {
      if (!userPicked(poll.options, optionIds, name)) continue;
      const person = roster[id];
      if (person && !person.left) people.push(person);
    }
    return people;
  }

  private async peopleNotNemogu(chatId: number, poll: ActivePoll): Promise<RosterPerson[]> {
    const roster = getRoster(chatId);
    const people: RosterPerson[] = [];
    for (const [id, person] of Object.entries(roster)) {
      if (person.left || person.spectator) continue;
      const votes = poll.voters[id];
      if (votes && userPicked(poll.options, votes, NEMOGU)) continue;
      people.push(person);
    }
    return people;
  }

  private missingVoters(poll: ActivePoll): { id: string; person: RosterPerson }[] {
    const roster = getRoster(poll.chatId);
    const missing = [];
    for (const [id, person] of Object.entries(roster)) {
      if (person.left || person.spectator) continue;
      if (person.alwaysCan && poll.kind === "schedule") continue;
      const votes = poll.voters[id];
      if (votes && votes.length > 0) continue;
      missing.push({ id, person });
    }
    return missing;
  }

  private async everyoneVoted(poll: ActivePoll): Promise<boolean> {
    const roster = getRoster(poll.chatId);
    const voted = new Set(
      Object.entries(poll.voters)
        .filter(([, ids]) => ids.length > 0)
        .map(([id]) => id)
    );
    if (poll.kind === "schedule") {
      for (const [id, person] of Object.entries(roster)) {
        if (person.alwaysCan && !person.left && !person.spectator) voted.add(id);
      }
    }
    const voterCount = [...voted].filter((id) => !roster[id]?.spectator).length;
    if (voterCount === 0 && uniqueVoterCount(poll.voters) === 0) return false;

    const settings = getSettings(poll.chatId);
    const all = poll.kind === "place" ? settings.placeQuorumAll : settings.scheduleQuorumAll;
    const count = poll.kind === "place" ? settings.placeQuorumCount : settings.scheduleQuorumCount;
    if (!all) {
      return voterCount >= count;
    }
    try {
      const humans = await this.humanMemberCount(poll.chatId);
      const spectators = Object.values(roster).filter((person) => person.spectator && !person.left).length;
      const needed = Math.max(0, humans - spectators);
      return needed > 0 && voterCount >= needed;
    } catch (error) {
      console.error("[dnd] member count", poll.chatId, error);
      return false;
    }
  }

  private async humanMemberCount(chatId: number): Promise<number> {
    const memberCount = await this.telegram.getChatMembersCount(chatId);
    const admins = await this.telegram.getChatAdministrators(chatId);
    const botIds = new Set(admins.filter((admin) => admin.user.is_bot).map((admin) => admin.user.id));
    botIds.add(this.botId);
    return memberCount - botIds.size;
  }

  private async refreshRosterUsernames(chatId: number): Promise<void> {
    const roster = getRoster(chatId);
    for (const [id, person] of Object.entries(roster)) {
      if (person.left) continue;
      try {
        const member = await this.telegram.getChatMember(chatId, Number(id));
        this.rememberUser(chatId, member.user, { left: false });
      } catch {
        upsertRosterPerson(chatId, Number(id), { left: true });
      }
    }
  }

  private async sendChat(
    chatId: number,
    replyTo: number,
    text: string,
    extra?: object
  ): Promise<number> {
    try {
      const sent = await this.telegram.sendMessage(chatId, text, {
        ...extra,
        reply_parameters: { message_id: replyTo, allow_sending_without_reply: true },
      });
      return sent.message_id;
    } catch {
      const sent = await this.telegram.sendMessage(chatId, text, extra);
      return sent.message_id;
    }
  }

  private async maybePinSummary(chatId: number, days: string[], place: string): Promise<void> {
    const day = formatDay(days);
    if (!day) return;
    const text = place
      ? applyTemplate(DEFAULT_SUMMARY, { day, place })
      : applyTemplate(DEFAULT_SUMMARY_DAY_ONLY, { day });
    const sent = await this.telegram.sendMessage(chatId, text);
    const prev = getSession(chatId).summaryMessageId;
    if (prev) await this.unpinUnlocked(chatId, prev);
    patchSession(chatId, { summaryMessageId: sent.message_id, lastDays: days, lastPlace: place });
    await this.pinUnlocked(chatId, sent.message_id);
  }

  private async stopUnlocked(chatId: number, silent: boolean): Promise<void> {
    if (!getPoll(chatId)) return;
    await this.finishUnlocked(chatId, silent);
  }

  private async pinUnlocked(chatId: number, messageId: number): Promise<void> {
    if (!getSettings(chatId).pinPolls) return;
    try {
      await this.telegram.pinChatMessage(chatId, messageId, { disable_notification: true });
    } catch (error) {
      console.error("[dnd] pin", chatId, error);
    }
  }

  private async unpinUnlocked(chatId: number, messageId: number): Promise<void> {
    try {
      await this.telegram.unpinChatMessage(chatId, messageId);
    } catch {
      /* already unpinned or no rights */
    }
  }
}

function historyEntry(kind: HistoryEntry["kind"], names: string[], nemogu: boolean): HistoryEntry {
  return { at: new Date().toISOString(), kind, names, nemogu };
}

function pollTtlHoursOf(poll: ActivePoll, settings: ChatSettings): number {
  return poll.kind === "daypick" ? settings.dayPickTtlHours : settings.pollTtlHours;
}

function elapsedPastTtl(poll: ActivePoll, settings: ChatSettings): boolean {
  const started = Date.parse(poll.startedAt);
  if (!Number.isFinite(started)) return true;
  return Date.now() - started >= pollTtlHoursOf(poll, settings) * 60 * 60 * 1000;
}

function reminderDue(poll: ActivePoll, settings: ChatSettings): boolean {
  const started = Date.parse(poll.startedAt);
  if (!Number.isFinite(started)) return false;
  const ttlMs = pollTtlHoursOf(poll, settings) * 60 * 60 * 1000;
  const remindMs = settings.reminderHours * 60 * 60 * 1000;
  if (remindMs <= 0 || remindMs >= ttlMs) return false;
  const elapsed = Date.now() - started;
  return elapsed >= ttlMs - remindMs && elapsed < ttlMs;
}

export function statsText(chatId: number): string {
  const roster = getRoster(chatId);
  const board = Object.values(roster)
    .filter((person) => person.nemoguCount > 0)
    .sort((a, b) => b.nemoguCount - a.nemoguCount || a.firstName.localeCompare(b.firstName, "ru"));
  const lines = ["Не смогу (всего):"];
  if (board.length === 0) {
    lines.push("(пока никого)");
  } else {
    board.forEach((person, index) => {
      const name = person.username ? `@${person.username}` : person.firstName;
      lines.push(`${index + 1}. ${name} — ${person.nemoguCount}`);
    });
  }
  const history = getHistory(chatId);
  lines.push("", "Последние сессии:");
  if (history.length === 0) {
    lines.push("(пусто)");
  } else {
    for (const row of [...history].reverse()) {
      const when = row.at.slice(0, 10);
      const names = row.names.join(", ") || "—";
      const tag = row.kind === "schedule" ? "дни" : "место";
      const extra = row.nemogu ? " · не смогу" : "";
      lines.push(`• ${when} ${tag}: ${names}${extra}`);
    }
  }
  return lines.join("\n");
}
