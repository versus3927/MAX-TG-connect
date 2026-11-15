/**
 * Минимальный клиент Bot API мессенджера MAX.
 * Документация: https://dev.max.ru/docs-api
 * Авторизация: заголовок `Authorization: <access_token>`.
 */

export const MAX_API_BASE =
  process.env.MAX_API_BASE ?? "https://platform-api2.max.ru";

export type MaxBotInfo = {
  user_id: number;
  name: string;
  username: string;
  is_bot: boolean;
  last_activity_time?: number;
};

export type MaxAttachment = {
  type?: string;
  payload?: { url?: string; token?: string; title?: string };
};

export type MaxMessage = {
  sender?: {
    user_id?: number;
    name?: string;
    username?: string;
    is_bot?: boolean;
  };
  recipient?: {
    chat_id?: number;
    chat_type?: string;
    user_id?: number;
  };
  body?: {
    mid?: string;
    seq?: number;
    text?: string | null;
    attachments?: MaxAttachment[];
  };
};

export type MaxUpdate = {
  update_type: string;
  timestamp?: number;
  message?: MaxMessage;
  chat_id?: number;
  chat?: { chat_id?: number; title?: string; type?: string };
  user?: { user_id?: number; name?: string; username?: string };
};

type ApiErrorShape = { success?: boolean; code?: string; message?: string };

async function maxRequest<T>(
  method: string,
  path: string,
  timeoutMs = 45000,
): Promise<T> {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) throw new Error("MAX_BOT_TOKEN is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MAX_API_BASE}${path}`, {
      method,
      headers: { Authorization: token },
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as (T &
      ApiErrorShape) | null;
    if (!res.ok) {
      const msg =
        data && typeof data === "object" && data.message ? data.message : "";
      throw new Error(`MAX API ${method} ${path}: HTTP ${res.status} ${msg}`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function maxGetMe(): Promise<MaxBotInfo> {
  return maxRequest<MaxBotInfo>("GET", "/me", 15000);
}

export async function maxGetUpdates(
  marker: number | null,
  timeoutSec = 30,
): Promise<{ updates: MaxUpdate[]; marker: number | null }> {
  const params = new URLSearchParams({
    limit: "100",
    timeout: String(timeoutSec),
  });
  if (marker != null) params.set("marker", String(marker));
  return maxRequest<{ updates: MaxUpdate[]; marker: number | null }>(
    "GET",
    `/updates?${params.toString()}`,
    timeoutSec * 1000 + 15000,
  );
}
