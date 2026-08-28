import {
  DEFAULT_NEMOGU,
  DEFAULT_RESULT,
  DEFAULT_ZERO_VOTES,
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
  lastAutoDate: string;
}

export interface ActivePoll {
  kind: "schedule" | "place";
  chatId: number;
  messageId: number;
  pollId: string;
  startedAt: string;
  options: string[];
  voters: Record<string, number[]>;
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
    lastAutoDate: moscowParts().dateKey,
  };
}

export function mergeSettings(raw: Partial<ChatSettings> | undefined, title: string): ChatSettings {
  const base = defaultSettings(title || raw?.title || String(title));
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    title: raw.title || base.title,
    autoWeekday: clampInt(raw.autoWeekday, 0, 6, base.autoWeekday),
    autoHour: clampInt(raw.autoHour, 0, 23, base.autoHour),
    autoMinute: clampInt(raw.autoMinute, 0, 59, base.autoMinute),
    zeroVotesMessage: raw.zeroVotesMessage?.trim() || base.zeroVotesMessage,
    resultMessage: raw.resultMessage?.trim() || base.resultMessage,
    nemoguMessage: raw.nemoguMessage?.trim() || base.nemoguMessage,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
