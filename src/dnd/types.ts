import {
  DEFAULT_NEMOGU,
  DEFAULT_POLL_TTL_HOURS,
  DEFAULT_RESULT,
  DEFAULT_ZERO_VOTES,
  MAX_POLL_TTL_HOURS,
  MAX_QUORUM_COUNT,
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
  lastAutoDate: string;
  pollTtlHours: number;
  scheduleQuorumAll: boolean;
  scheduleQuorumCount: number;
  placeQuorumAll: boolean;
  placeQuorumCount: number;
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
    pollTtlHours: DEFAULT_POLL_TTL_HOURS,
    scheduleQuorumAll: true,
    scheduleQuorumCount: MIN_QUORUM_COUNT,
    placeQuorumAll: true,
    placeQuorumCount: MIN_QUORUM_COUNT,
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
