import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { mergeSettings, type ActivePoll, type ChatSettings } from "./types.js";

const dir = path.join(config.dataDir, "dnd");

type SettingsFile = Record<string, ChatSettings>;
type PlacesFile = Record<string, string[]>;
type PollsFile = Record<string, ActivePoll>;

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

export function getPlaces(chatId: number): string[] {
  const all = readJson<PlacesFile>("places.json", {});
  const list = all[chatKey(chatId)];
  return Array.isArray(list) ? list.filter((name) => typeof name === "string" && name.trim()) : [];
}

export function putPlaces(chatId: number, places: string[]): string[] {
  const all = readJson<PlacesFile>("places.json", {});
  const unique: string[] = [];
  for (const name of places.map((item) => item.trim().slice(0, 100)).filter(Boolean)) {
    if (!unique.includes(name)) unique.push(name);
  }
  all[chatKey(chatId)] = unique;
  writeJson("places.json", all);
  return unique;
}

export function getPoll(chatId: number): ActivePoll | undefined {
  const all = readJson<PollsFile>("polls.json", {});
  return all[chatKey(chatId)];
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
  return Object.values(readJson<PollsFile>("polls.json", {}));
}
