import { DAYS_RU, NEMOGU, TOP_N } from "./constants.js";
import type { ChatSettings, RosterPerson } from "./types.js";
import { moscowParts } from "./time.js";

export interface OptionTally {
  text: string;
  voterCount: number;
  index: number;
}

const DAY_SET = new Set<string>(DAYS_RU);

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

export function addVotesToTallies(tallies: OptionTally[], optionIndexes: number[]): OptionTally[] {
  return tallies.map((row) =>
    optionIndexes.includes(row.index) ? { ...row, voterCount: row.voterCount + 1 } : row
  );
}

export function topNamed(tallies: OptionTally[], exclude: string[] = [], limit = TOP_N): string[] {
  const skip = new Set(exclude);
  return [...tallies]
    .filter((row) => row.voterCount > 0 && !skip.has(row.text))
    .sort((a, b) => b.voterCount - a.voterCount || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.text);
}

export function majorityDays(tallies: OptionTally[]): string[] {
  const days = tallies.filter((row) => DAY_SET.has(row.text) && row.voterCount > 0);
  if (days.length === 0) return [];
  const max = Math.max(...days.map((row) => row.voterCount));
  return days.filter((row) => row.voterCount === max).map((row) => row.text);
}

export function formatDay(names: string[]): string {
  return names.map((name) => name.toLowerCase()).join(" или ");
}

export function formatDays(names: string[]): string {
  return names.join(", ");
}

export function mentionOf(person: RosterPerson): string {
  if (person.username) return `@${person.username}`;
  return person.firstName;
}

export function joinMentions(people: RosterPerson[]): string {
  return people.map(mentionOf).join(" ");
}

export function applyTemplate(
  template: string,
  parts: { day?: string; days?: string; place?: string; places?: string; tags?: string }
): string {
  return template
    .replaceAll("{day}", parts.day ?? "")
    .replaceAll("{days}", parts.days ?? "")
    .replaceAll("{place}", parts.place ?? "")
    .replaceAll("{places}", parts.places ?? "")
    .replaceAll("{tags}", parts.tags ?? "");
}

export function scheduleResult(
  settings: ChatSettings,
  tallies: OptionTally[]
): { text: string; skippedNemogu: boolean; names: string[] } {
  const nemogu = tallies.find((row) => row.text === NEMOGU);
  if (settings.skipIfNemogu && (nemogu?.voterCount ?? 0) > 0) {
    return { text: settings.nemoguMessage, skippedNemogu: true, names: majorityDays(tallies) };
  }
  const names = majorityDays(tallies);
  if (names.length === 0) {
    return { text: settings.zeroVotesMessage, skippedNemogu: false, names };
  }
  return {
    text: applyTemplate(settings.resultMessage, { days: formatDays(names), day: formatDay(names) }),
    skippedNemogu: false,
    names,
  };
}

export function placeResult(settings: ChatSettings, tallies: OptionTally[]): { text: string; names: string[] } {
  const names = topNamed(tallies);
  if (names.length === 0) {
    return { text: settings.zeroVotesMessage, names };
  }
  return {
    text: applyTemplate(settings.resultMessage, { places: formatDays(names), place: names[0] ?? "" }),
    names,
  };
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

export function optionIndex(options: string[], name: string): number {
  return options.indexOf(name);
}

export function userPicked(options: string[], optionIds: number[], name: string): boolean {
  const index = optionIndex(options, name);
  return index >= 0 && optionIds.includes(index);
}

export function dayOptionIndexes(options: string[]): number[] {
  return options.map((text, index) => (DAY_SET.has(text) ? index : -1)).filter((index) => index >= 0);
}

export function summaryText(days: string[], place: string): string {
  const day = formatDay(days);
  if (!day) return "";
  if (!place) return applyTemplate("Сессия: {day}", { day });
  return applyTemplate("Сессия: {day} · {place}", { day, place });
}
