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
export const POD_VOPROSOM = "Под вопросом";

export const SCHEDULE_OPTIONS: string[] = [...DAYS_RU, NEMOGU, POD_VOPROSOM];

export const WEEKDAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export const SCHEDULE_QUESTION = "Когда свободны?";
export const PLACE_QUESTION = "Где?";
export const DAYPICK_QUESTION = "Какой день?";
export const ONESHOT_QUESTION = "Запустить голосование по месту?";
export const ONESHOT_YES = "Да";
export const ONESHOT_NO = "Нет";

export const DEFAULT_POLL_TTL_HOURS = 12;
export const DEFAULT_DAYPICK_TTL_HOURS = 6;
export const MIN_POLL_TTL_HOURS = 1;
export const MAX_POLL_TTL_HOURS = 48;
export const MIN_QUORUM_COUNT = 1;
export const MAX_QUORUM_COUNT = 99;
export const POLL_TTL_MS = DEFAULT_POLL_TTL_HOURS * 60 * 60 * 1000;
export const MAX_POLL_OPTIONS = 10;
export const TOP_N = 3;
export const HISTORY_LIMIT = 10;
export const DEFAULT_REMINDER_HOURS = 2;
export const MAX_REMINDER_HOURS = 2;

export const DEFAULT_ZERO_VOTES = "Никто ни за что не проголосовал.";
export const DEFAULT_RESULT = "Большинство выбрало {days}";
export const DEFAULT_NEMOGU_OLD =
  "Кто-то выбрал «Не смогу» — большинство не считается.";
export const DEFAULT_NEMOGU =
  "{tags} готовы собраться. Большинство за {day} для ваншота, запустить голосование по месту?";
export const DEFAULT_UNCERTAIN = "{tags} ещё не уверены. Можете или нет?";
export const DEFAULT_REMINDER = "{tags} опрос ещё идёт, проголосуйте.";
export const DEFAULT_SUMMARY = "Сессия: {day} · {place}";
export const DEFAULT_SUMMARY_DAY_ONLY = "Сессия: {day}";
