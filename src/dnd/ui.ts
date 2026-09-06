import { Markup } from "telegraf";
import { WEEKDAY_SHORT } from "./constants.js";
import { mentionOf } from "./logic.js";
import { formatPlace } from "./places.js";
import { getRoster } from "./store.js";
import { pad2 } from "./time.js";
import type { ChatSettings, Place, RosterPerson } from "./types.js";

export function helpText(): string {
  return [
    "Команды DND:",
    "dnd help — этот список",
    "dnd settings — настройки группы",
    "dnd vote start — опрос дней",
    "dnd place vote start — опрос места",
    "dnd place edit — места, хозяин через тег @user (создатель чата или админ бота)",
    "dnd stop — закрыть текущий опрос (создатель чата или админ бота)",
    "dnd always — я всегда могу (в группе)",
    "dnd always @user — то же для другого (создатель / админ бота)",
    "dnd spectators — зрители, не в кворуме и не в тегах",
    "dnd stats — таблица «Не смогу» и последние сессии",
    "",
    "Настройки и тексты меняет создатель группы или TELEGRAM_ADMIN_ID.",
    "Опросы может запускать кто угодно в группе.",
    "",
    "Для пина опросов боту нужно право закреплять сообщения.",
    "Плейсхолдеры: {day} {days} {place} {places} {tags}",
  ].join("\n");
}

export function settingsText(chatId: number, settings: ChatSettings, canEdit: boolean): string {
  const day = WEEKDAY_SHORT[settings.autoWeekday] ?? "пн";
  const time = `${pad2(settings.autoHour)}:${pad2(settings.autoMinute)}`;
  const remind = settings.reminderHours <= 0 ? "выкл" : `${settings.reminderHours} ч`;
  const lines = [
    `Настройки DND — ${settings.title}`,
    `id: ${chatId}`,
    "",
    `Авто-опрос дней: ${onOff(settings.autoVote)} · ${day} ${time} (GMT+3)`,
    `Авто-опрос места: ${onOff(settings.autoPlaceVote)} (после опроса дней; не если есть «Не смогу»)`,
    `«Не смогу» отменяет большинство: ${onOff(settings.skipIfNemogu)}`,
    `Длительность опроса: ${settings.pollTtlHours} ч`,
    `Напоминание: ${remind}`,
    `Пин: ${onOff(settings.pinPolls)}`,
    `Кворум дней: ${quorumLabel(settings.scheduleQuorumAll, settings.scheduleQuorumCount)}`,
    `Кворум места: ${quorumLabel(settings.placeQuorumAll, settings.placeQuorumCount)}`,
    "",
    "Сообщения:",
    `• пустой: ${settings.zeroVotesMessage}`,
    `• результат: ${settings.resultMessage}`,
    `• не смогу: ${settings.nemoguMessage}`,
    `• под вопросом: ${settings.uncertainMessage}`,
  ];
  if (!canEdit) {
    lines.push("", "Менять может создатель чата или админ бота.");
  }
  return lines.join("\n");
}

export function settingsKeyboard(chatId: number, settings: ChatSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("авто дни", cb("s", "av", chatId)),
      Markup.button.callback("авто место", cb("s", "ap", chatId)),
      Markup.button.callback("не смогу", cb("s", "nm", chatId)),
    ],
    [
      Markup.button.callback("день", cb("s", "wd", chatId)),
      Markup.button.callback("час −", cb("s", "hm", chatId)),
      Markup.button.callback("час +", cb("s", "hp", chatId)),
    ],
    [
      Markup.button.callback("мин −", cb("s", "mm", chatId)),
      Markup.button.callback("мин +", cb("s", "mp", chatId)),
      Markup.button.callback("срок −", cb("s", "tl", chatId)),
      Markup.button.callback("срок +", cb("s", "th", chatId)),
    ],
    [
      Markup.button.callback(`пин ${onOff(settings.pinPolls)}`, cb("s", "pn", chatId)),
      Markup.button.callback(`напом. ${reminderShort(settings.reminderHours)}`, cb("s", "rh", chatId)),
    ],
    [
      Markup.button.callback(
        `дни: ${quorumShort(settings.scheduleQuorumAll, settings.scheduleQuorumCount)}`,
        cb("s", "qa", chatId)
      ),
      Markup.button.callback("дни −", cb("s", "qm", chatId)),
      Markup.button.callback("дни +", cb("s", "qp", chatId)),
    ],
    [
      Markup.button.callback(
        `место: ${quorumShort(settings.placeQuorumAll, settings.placeQuorumCount)}`,
        cb("s", "ra", chatId)
      ),
      Markup.button.callback("место −", cb("s", "rm", chatId)),
      Markup.button.callback("место +", cb("s", "rp", chatId)),
    ],
    [
      Markup.button.callback("текст: пустой", cb("s", "tz", chatId)),
      Markup.button.callback("текст: результат", cb("s", "tr", chatId)),
    ],
    [
      Markup.button.callback("текст: не смогу", cb("s", "tn", chatId)),
      Markup.button.callback("текст: под вопросом", cb("s", "tu", chatId)),
    ],
  ]);
}

export function placesText(chatId: number, title: string, places: Place[]): string {
  const roster = getRoster(chatId);
  const list =
    places.length === 0
      ? "(пусто — нужно минимум 2 для опроса)"
      : places.map((place, index) => `${index + 1}. ${formatPlace(place, roster)}`).join("\n");
  return [
    `Места — ${title}`,
    `id: ${chatId}`,
    "",
    list,
    "",
    "Добавить: «+ Название» или «+ Название @хозяин». Без тега — без хозяина (кафе).",
    "Удалить: кнопка или «- 1». стоп — выход.",
  ].join("\n");
}

export function placesKeyboard(chatId: number, places: Place[]) {
  const rows = [];
  if (places.length < 10) {
    rows.push([Markup.button.callback("добавить", cb("p", "a", chatId))]);
  }
  const delRow = places.map((_, index) =>
    Markup.button.callback(`удалить ${index + 1}`, cb("p", "d", chatId, index))
  );
  for (let i = 0; i < delRow.length; i += 3) {
    rows.push(delRow.slice(i, i + 3));
  }
  rows.push([Markup.button.callback("готово", cb("p", "x", chatId))]);
  return Markup.inlineKeyboard(rows);
}

export function spectatorsText(chatId: number, title: string, people: { userId: number; person: RosterPerson }[]): string {
  const list =
    people.length === 0
      ? "(нет — все участники из списка бота считаются игроками)"
      : people.map((row, index) => `${index + 1}. ${mentionOf(row.person)}`).join("\n");
  return [
    `Зрители — ${title}`,
    `id: ${chatId}`,
    "",
    list,
    "",
    "Зритель не в кворуме и не в тегах. «+ @user» или «- 1». стоп — выход.",
    "Человек должен хотя бы раз написать в чат или проголосовать, иначе бот его не видит.",
  ].join("\n");
}

export function spectatorsKeyboard(chatId: number, people: { userId: number; person: RosterPerson }[]) {
  const rows = [];
  const delRow = people.map((_, index) =>
    Markup.button.callback(`убрать ${index + 1}`, cb("v", "d", chatId, index))
  );
  for (let i = 0; i < delRow.length; i += 3) {
    rows.push(delRow.slice(i, i + 3));
  }
  rows.push([Markup.button.callback("готово", cb("v", "x", chatId))]);
  return Markup.inlineKeyboard(rows);
}

export function groupPickKeyboard(
  groups: { chatId: number; title: string }[],
  kind: "s" | "p" | "v"
) {
  return Markup.inlineKeyboard(
    groups.map((group) => [Markup.button.callback(clip(group.title), cb("g", kind, group.chatId))])
  );
}

export function parseCallback(data: string): { scope: string; action: string; chatId: number; extra?: number } | undefined {
  const match = /^(g|s|p|o|v):([a-z]+):(-?\d+)(?::(\d+))?$/.exec(data);
  if (!match) return undefined;
  return {
    scope: match[1],
    action: match[2],
    chatId: Number(match[3]),
    extra: match[4] === undefined ? undefined : Number(match[4]),
  };
}

export function onOff(value: boolean): string {
  return value ? "вкл" : "выкл";
}

function quorumLabel(all: boolean, count: number): string {
  return all ? "все в группе" : `${count} чел.`;
}

function quorumShort(all: boolean, count: number): string {
  return all ? "все" : String(count);
}

function reminderShort(hours: number): string {
  return hours <= 0 ? "выкл" : `${hours}ч`;
}

function cb(scope: string, action: string, chatId: number, extra?: number): string {
  return extra === undefined ? `${scope}:${action}:${chatId}` : `${scope}:${action}:${chatId}:${extra}`;
}

function clip(text: string): string {
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}
