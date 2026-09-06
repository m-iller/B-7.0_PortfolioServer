import { mentionOf } from "./logic.js";
import type { Place, RosterPerson } from "./types.js";

export interface TgEntity {
  type: string;
  offset: number;
  length: number;
  user?: {
    id: number;
    is_bot?: boolean;
    username?: string;
    first_name: string;
  };
}

export interface TgUserLite {
  id: number;
  is_bot?: boolean;
  username?: string;
  first_name: string;
}

export function normalizePlace(raw: unknown): Place | null {
  if (typeof raw === "string") {
    const name = raw.trim().slice(0, 100);
    return name ? { name, ownerId: null } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { name?: unknown; ownerId?: unknown };
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 100) : "";
  if (!name) return null;
  const ownerId = typeof row.ownerId === "number" && Number.isFinite(row.ownerId) ? row.ownerId : null;
  return { name, ownerId };
}

export function formatPlace(place: Place, roster: Record<string, RosterPerson>): string {
  if (place.ownerId === null) return place.name;
  const person = roster[String(place.ownerId)];
  const tag = person ? mentionOf(person) : `#${place.ownerId}`;
  return `${place.name} (${tag})`;
}

export function eligiblePlaces(places: Place[], blockedUserIds: Iterable<number>): Place[] {
  const blocked = new Set(blockedUserIds);
  return places.filter((place) => place.ownerId === null || !blocked.has(place.ownerId));
}

export function parsePlaceInput(
  raw: string,
  entities: readonly TgEntity[] | undefined
): { name: string; ownerUsername: string; ownerUser: TgUserLite | null } {
  let ownerUsername = "";
  let ownerUser: TgUserLite | null = null;
  let name = raw;

  const marks = [...(entities ?? [])]
    .filter((entity) => entity.type === "mention" || entity.type === "text_mention")
    .sort((a, b) => a.offset - b.offset);

  if (marks.length > 0) {
    const last = marks[marks.length - 1];
    const slice = raw.slice(last.offset, last.offset + last.length);
    if (last.type === "text_mention" && last.user && !last.user.is_bot) {
      ownerUser = last.user;
    } else if (last.type === "mention") {
      ownerUsername = slice.replace(/^@/, "");
    }
    name = `${raw.slice(0, last.offset)}${raw.slice(last.offset + last.length)}`;
  } else {
    const tagged = /^(.*?)\s+@([A-Za-z0-9_]{4,32})\s*$/.exec(stripPlus(raw));
    if (tagged) {
      name = tagged[1];
      ownerUsername = tagged[2];
    }
  }

  return { name: stripPlus(name).slice(0, 100), ownerUsername, ownerUser };
}

function stripPlus(value: string): string {
  return value.replace(/^\+\s*/, "").replace(/\s+/g, " ").trim();
}
