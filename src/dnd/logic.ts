import { NEMOGU, TOP_N } from "./constants.js";
import type { ChatSettings } from "./types.js";
import { moscowParts } from "./time.js";

export interface OptionTally {
  text: string;
  voterCount: number;
  index: number;
}

export function uniqueVoterCount(voters: Record<string, number[]>): number {
  return Object.values(voters).filter((ids) => ids.length > 0).length;
}

export function talliesFromVoters(options: string[], voters: Record<string, number[]>): OptionTally[] {
  const counts = options.map(() => 0);
  for (const ids of Object.values(voters)) {
    for (const id of ids) {
      if (id >= 0 && id < counts.length) counts[id] += 1;
    }
  }
  return options.map((text, index) => ({ text, voterCount: counts[index] ?? 0, index }));
}

export function talliesFromPoll(options: { text: string; voter_count: number }[]): OptionTally[] {
  return options.map((option, index) => ({
    text: option.text,
    voterCount: option.voter_count,
    index,
  }));
}

export function topNamed(tallies: OptionTally[], exclude: string[] = [], limit = TOP_N): string[] {
  const skip = new Set(exclude);
  return [...tallies]
    .filter((row) => row.voterCount > 0 && !skip.has(row.text))
    .sort((a, b) => b.voterCount - a.voterCount || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.text);
}

export function applyTemplate(template: string, names: string[]): string {
  const joined = names.join(", ");
  return template.replaceAll("{days}", joined).replaceAll("{places}", joined);
}

export function scheduleResult(
  settings: ChatSettings,
  tallies: OptionTally[]
): { text: string; skippedNemogu: boolean; names: string[] } {
  const nemogu = tallies.find((row) => row.text === NEMOGU);
  if (settings.skipIfNemogu && (nemogu?.voterCount ?? 0) > 0) {
    return { text: settings.nemoguMessage, skippedNemogu: true, names: [] };
  }
  const names = topNamed(tallies, [NEMOGU]);
  if (names.length === 0) {
    return { text: settings.zeroVotesMessage, skippedNemogu: false, names };
  }
  return { text: applyTemplate(settings.resultMessage, names), skippedNemogu: false, names };
}

export function placeResult(settings: ChatSettings, tallies: OptionTally[]): { text: string; names: string[] } {
  const names = topNamed(tallies);
  if (names.length === 0) {
    return { text: settings.zeroVotesMessage, names };
  }
  return { text: applyTemplate(settings.resultMessage, names), names };
}

export function shouldFireAuto(settings: ChatSettings, at = new Date()): boolean {
  if (!settings.autoVote) return false;
  const now = moscowParts(at);
  if (now.weekday !== settings.autoWeekday) return false;
  if (settings.lastAutoDate === now.dateKey) return false;
  const nowMinutes = now.hour * 60 + now.minute;
  const dueMinutes = settings.autoHour * 60 + settings.autoMinute;
  return nowMinutes >= dueMinutes;
}

export function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1;
  return ((((value - min) % span) + span) % span) + min;
}
