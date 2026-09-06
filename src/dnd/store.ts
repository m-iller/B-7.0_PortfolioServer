import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { HISTORY_LIMIT } from "./constants.js";
import { normalizePlace } from "./places.js";
import {
  mergeRosterPerson,
  mergeSession,
  mergeSettings,
  type ActivePoll,
  type ChatSession,
  type ChatSettings,
  type HistoryEntry,
  type Place,
  type RosterPerson,
} from "./types.js";

const dir = path.join(config.dataDir, "dnd");

type SettingsFile = Record<string, ChatSettings>;
type PlacesFile = Record<string, unknown[]>;
type PollsFile = Record<string, ActivePoll>;
type RosterFile = Record<string, Record<string, RosterPerson>>;
type SessionFile = Record<string, ChatSession>;
type HistoryFile = Record<string, HistoryEntry[]>;

function readJson<T>(file: string, fallback: T): T {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(full, "utf8")) as T;
  } catch (error) {
    console.error(`[dnd] failed to read ${file}`, error);
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, file);
  const tmp = `${full}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try {
    fs.renameSync(tmp, full);
  } catch {
    fs.copyFileSync(tmp, full);
    fs.unlinkSync(tmp);
  }
}

function chatKey(chatId: number | string): string {
  return String(chatId);
}

export function listChatIds(): number[] {
  const ids = new Set<string>([
    ...Object.keys(readJson<SettingsFile>("settings.json", {})),
    ...Object.keys(readJson<PlacesFile>("places.json", {})),
    ...Object.keys(readJson<PollsFile>("polls.json", {})),
    ...Object.keys(readJson<RosterFile>("roster.json", {})),
  ]);
  return [...ids].map(Number).filter((id) => Number.isFinite(id));
}

export function getSettings(chatId: number): ChatSettings {
  const all = readJson<SettingsFile>("settings.json", {});
  const key = chatKey(chatId);
  return mergeSettings(all[key], all[key]?.title || key);
}

export function putSettings(chatId: number, settings: ChatSettings): ChatSettings {
  const all = readJson<SettingsFile>("settings.json", {});
  const merged = mergeSettings(settings, settings.title);
  all[chatKey(chatId)] = merged;
  writeJson("settings.json", all);
  return merged;
}

export function ensureChat(chatId: number, title?: string): ChatSettings {
  const current = getSettings(chatId);
  const nextTitle = title?.trim() || current.title;
  if (nextTitle !== current.title || !readJson<SettingsFile>("settings.json", {})[chatKey(chatId)]) {
    return putSettings(chatId, { ...current, title: nextTitle });
  }
  return current;
}

export function patchSettings(chatId: number, patch: Partial<ChatSettings>): ChatSettings {
  return putSettings(chatId, { ...getSettings(chatId), ...patch });
}

export function getPlaces(chatId: number): Place[] {
  const all = readJson<PlacesFile>("places.json", {});
  const list = all[chatKey(chatId)];
  if (!Array.isArray(list)) return [];
  const unique: Place[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const place = normalizePlace(raw);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    unique.push(place);
  }
  return unique;
}

export function putPlaces(chatId: number, places: Place[]): Place[] {
  const unique: Place[] = [];
  const seen = new Set<string>();
  for (const raw of places) {
    const place = normalizePlace(raw);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    unique.push(place);
  }
  const all = readJson<PlacesFile>("places.json", {});
  all[chatKey(chatId)] = unique;
  writeJson("places.json", all);
  return unique;
}

export function getPoll(chatId: number): ActivePoll | undefined {
  const all = readJson<PollsFile>("polls.json", {});
  const poll = all[chatKey(chatId)];
  if (!poll) return undefined;
  return { ...poll, reminderSent: poll.reminderSent === true, voters: poll.voters ?? {} };
}

export function putPoll(poll: ActivePoll): void {
  const all = readJson<PollsFile>("polls.json", {});
  all[chatKey(poll.chatId)] = poll;
  writeJson("polls.json", all);
}

export function deletePoll(chatId: number): void {
  const all = readJson<PollsFile>("polls.json", {});
  delete all[chatKey(chatId)];
  writeJson("polls.json", all);
}

export function listPolls(): ActivePoll[] {
  return Object.values(readJson<PollsFile>("polls.json", {})).map((poll) => ({
    ...poll,
    reminderSent: poll.reminderSent === true,
    voters: poll.voters ?? {},
  }));
}

export function getRoster(chatId: number): Record<string, RosterPerson> {
  const all = readJson<RosterFile>("roster.json", {});
  const raw = all[chatKey(chatId)] ?? {};
  const next: Record<string, RosterPerson> = {};
  for (const [id, person] of Object.entries(raw)) {
    next[id] = mergeRosterPerson(person);
  }
  return next;
}

export function putRoster(chatId: number, roster: Record<string, RosterPerson>): void {
  const all = readJson<RosterFile>("roster.json", {});
  all[chatKey(chatId)] = roster;
  writeJson("roster.json", all);
}

export function upsertRosterPerson(
  chatId: number,
  userId: number,
  patch: Partial<RosterPerson>
): RosterPerson {
  const roster = getRoster(chatId);
  const key = String(userId);
  const next = mergeRosterPerson({ ...roster[key], ...patch });
  roster[key] = next;
  putRoster(chatId, roster);
  return next;
}

export function findRosterByUsername(chatId: number, username: string): { userId: number; person: RosterPerson } | undefined {
  const needle = username.replace(/^@/, "").toLowerCase();
  if (!needle) return undefined;
  for (const [id, person] of Object.entries(getRoster(chatId))) {
    if (person.username.toLowerCase() === needle) {
      return { userId: Number(id), person };
    }
  }
  return undefined;
}

export function getSession(chatId: number): ChatSession {
  const all = readJson<SessionFile>("session.json", {});
  return mergeSession(all[chatKey(chatId)]);
}

export function putSession(chatId: number, session: ChatSession): ChatSession {
  const all = readJson<SessionFile>("session.json", {});
  const merged = mergeSession(session);
  all[chatKey(chatId)] = merged;
  writeJson("session.json", all);
  return merged;
}

export function patchSession(chatId: number, patch: Partial<ChatSession>): ChatSession {
  return putSession(chatId, { ...getSession(chatId), ...patch });
}

export function getHistory(chatId: number): HistoryEntry[] {
  const all = readJson<HistoryFile>("history.json", {});
  const list = all[chatKey(chatId)];
  return Array.isArray(list) ? list : [];
}

export function pushHistory(chatId: number, entry: HistoryEntry): HistoryEntry[] {
  const all = readJson<HistoryFile>("history.json", {});
  const key = chatKey(chatId);
  const list = [...(Array.isArray(all[key]) ? all[key] : []), entry].slice(-HISTORY_LIMIT);
  all[key] = list;
  writeJson("history.json", all);
  return list;
}
