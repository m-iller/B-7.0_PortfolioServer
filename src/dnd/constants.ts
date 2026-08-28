export const DAYS_RU = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

export const NEMOGU = "Не смогу";

export const SCHEDULE_OPTIONS: string[] = [...DAYS_RU, NEMOGU];

export const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export const SCHEDULE_QUESTION = "Когда свободны?";
export const PLACE_QUESTION = "Где?";

export const POLL_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_POLL_OPTIONS = 10;
export const TOP_N = 3;

export const DEFAULT_ZERO_VOTES = "Никто ни за что не проголосовал.";
export const DEFAULT_RESULT = "Большинство выбрало {days}";
export const DEFAULT_NEMOGU =
  "Кто-то выбрал «Не смогу» — большинство не считается.";
