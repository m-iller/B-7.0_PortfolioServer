export interface MoscowParts {
  weekday: number;
  hour: number;
  minute: number;
  dateKey: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function moscowParts(at = new Date()): MoscowParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Moscow",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((part) => [part.type, part.value]));
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ""] ?? 1;
  const year = parts.year ?? "1970";
  const month = parts.month ?? "01";
  const day = parts.day ?? "01";
  return {
    weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateKey: `${year}-${month}-${day}`,
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
