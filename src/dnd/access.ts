import type { Telegram } from "telegraf";
import { config } from "../config.js";

export function isEnvAdmin(userId: number | undefined): boolean {
  if (!config.telegramAdminId || userId === undefined) return false;
  return String(userId) === String(config.telegramAdminId);
}

export function isGroupChat(type: string | undefined): boolean {
  return type === "group" || type === "supergroup";
}

export async function isChatCreator(
  telegram: Telegram,
  chatId: number,
  userId: number
): Promise<boolean> {
  try {
    const member = await telegram.getChatMember(chatId, userId);
    return member.status === "creator";
  } catch {
    return false;
  }
}

export async function isPrivileged(
  telegram: Telegram,
  chatId: number,
  userId: number | undefined
): Promise<boolean> {
  if (userId === undefined) return false;
  if (isEnvAdmin(userId)) return true;
  return isChatCreator(telegram, chatId, userId);
}
