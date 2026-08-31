import {
  DEFAULT_NEMOGU,
  DEFAULT_NEMOGU_OLD,
  DEFAULT_POLL_TTL_HOURS,
  DEFAULT_REMINDER_HOURS,
  DEFAULT_RESULT,
  DEFAULT_UNCERTAIN,
  DEFAULT_ZERO_VOTES,
  MAX_POLL_TTL_HOURS,
  MAX_QUORUM_COUNT,
  MAX_REMINDER_HOURS,
  MIN_POLL_TTL_HOURS,
  MIN_QUORUM_COUNT,
} from "./constants.js";
import { moscowParts } from "./time.js";

export interface ChatSettings {
  title: string;
  autoVote: boolean;
  autoWeekday: number;
  autoHour: number;
  autoMinute: number;
  skipIfNemogu: boolean;
  autoPlaceVote: boolean;
  zeroVotesMessage: string;
  resultMessage: string;
  nemoguMessage: string;
  uncertainMessage: string;
  lastAutoDate: string;
  pollTtlHours: number;
  scheduleQuorumAll: boolean;
  scheduleQuorumCount: number;
  placeQuorumAll: boolean;
  placeQuorumCount: number;
  reminderHours: number;
  pinPolls: boolean;
}

export interface ActivePoll {
  kind: "schedule" | "place";
  chatId: number;
  messageId: number;
  pollId: string;
  startedAt: string;
  options: string[];
  voters: Record<string, number[]>;
  reminderSent: boolean;
}

export interface RosterPerson {
  username: string;
  firstName: string;
  spectator: boolean;
  alwaysCan: boolean;
  nemoguCount: number;
  left: boolean;
}

export interface ChatSession {
  lastDays: string[];
  lastPlace: string;
  oneshotOpen: boolean;
  oneshotDays: string[];
  oneshotMessageId: number;
  summaryMessageId: number;
}

export interface HistoryEntry {
  at: string;
  kind: "schedule" | "place";
  names: string[];
  nemogu: boolean;
}

export function defaultSettings(title: string): ChatSettings {
  return {
    title,
    autoVote: true,
    autoWeekday: 1,
    autoHour: 0,
    autoMinute: 0,
    skipIfNemogu: true,
    autoPlaceVote: true,
    zeroVotesMessage: DEFAULT_ZERO_VOTES,
    resultMessage: DEFAULT_RESULT,
    nemoguMessage: DEFAULT_NEMOGU,
    uncertainMessage: DEFAULT_UNCERTAIN,
    lastAutoDate: moscowParts().dateKey,
    pollTtlHours: DEFAULT_POLL_TTL_HOURS,
    scheduleQuorumAll: true,
    scheduleQuorumCount: MIN_QUORUM_COUNT,
    placeQuorumAll: true,
    placeQuorumCount: MIN_QUORUM_COUNT,
    reminderHours: DEFAULT_REMINDER_HOURS,
    pinPolls: true,
  };
}

export function defaultSession(): ChatSession {
  return {
    lastDays: [],
    lastPlace: "",
    oneshotOpen: false,
    oneshotDays: [],
    oneshotMessageId: 0,
    summaryMessageId: 0,
  };
}

export function mergeSettings(raw: Partial<ChatSettings> | undefined, title: string): ChatSettings {
  const base = defaultSettings(title || raw?.title || String(title));
  if (!raw) return base;
  const rawNemogu = raw.nemoguMessage?.trim() || "";
  const nemoguMessage =
    !rawNemogu || rawNemogu === DEFAULT_NEMOGU_OLD ? base.nemoguMessage : rawNemogu;
  return {
    ...base,
    ...raw,
    title: raw.title || base.title,
    autoWeekday: clampInt(raw.autoWeekday, 0, 6, base.autoWeekday),
    autoHour: clampInt(raw.autoHour, 0, 23, base.autoHour),
    autoMinute: clampInt(raw.autoMinute, 0, 59, base.autoMinute),
    pollTtlHours: clampInt(raw.pollTtlHours, MIN_POLL_TTL_HOURS, MAX_POLL_TTL_HOURS, base.pollTtlHours),
    scheduleQuorumCount: clampInt(
      raw.scheduleQuorumCount,
      MIN_QUORUM_COUNT,
      MAX_QUORUM_COUNT,
      base.scheduleQuorumCount
    ),
    placeQuorumCount: clampInt(raw.placeQuorumCount, MIN_QUORUM_COUNT, MAX_QUORUM_COUNT, base.placeQuorumCount),
    scheduleQuorumAll: raw.scheduleQuorumAll !== false,
    placeQuorumAll: raw.placeQuorumAll !== false,
    reminderHours: clampInt(raw.reminderHours, 0, MAX_REMINDER_HOURS, base.reminderHours),
    pinPolls: raw.pinPolls !== false,
    zeroVotesMessage: raw.zeroVotesMessage?.trim() || base.zeroVotesMessage,
    resultMessage: raw.resultMessage?.trim() || base.resultMessage,
    nemoguMessage,
    uncertainMessage: raw.uncertainMessage?.trim() || base.uncertainMessage,
  };
}

export function mergeSession(raw: Partial<ChatSession> | undefined): ChatSession {
  const base = defaultSession();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    lastDays: Array.isArray(raw.lastDays) ? raw.lastDays.filter((item) => typeof item === "string") : base.lastDays,
    lastPlace: typeof raw.lastPlace === "string" ? raw.lastPlace : base.lastPlace,
    oneshotDays: Array.isArray(raw.oneshotDays)
      ? raw.oneshotDays.filter((item) => typeof item === "string")
      : base.oneshotDays,
    oneshotMessageId: clampInt(raw.oneshotMessageId, 0, Number.MAX_SAFE_INTEGER, 0),
    summaryMessageId: clampInt(raw.summaryMessageId, 0, Number.MAX_SAFE_INTEGER, 0),
    oneshotOpen: raw.oneshotOpen === true,
  };
}

export function mergeRosterPerson(raw: Partial<RosterPerson> | undefined): RosterPerson {
  return {
    username: typeof raw?.username === "string" ? raw.username.replace(/^@/, "") : "",
    firstName: typeof raw?.firstName === "string" && raw.firstName.trim() ? raw.firstName.trim() : "игрок",
    spectator: raw?.spectator === true,
    alwaysCan: raw?.alwaysCan === true,
    nemoguCount: clampInt(raw?.nemoguCount, 0, 10_000, 0),
    left: raw?.left === true,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
