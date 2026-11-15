/**
 * Минимальный клиент Telegram Bot API.
 * Используется long polling (getUpdates) — публичный webhook не нужен,
 * что идеально для хостинга на Railway без статического домена.
 */

const TG_API = "https://api.telegram.org";

export type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
};

export type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

async function tgRequest<T>(
  method: string,
  body: Record<string, unknown>,
  timeoutMs = 45000,
): Promise<T> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${TG_API}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as {
      ok: boolean;
      description?: string;
      error_code?: number;
      result: T;
    } | null;
    if (!data?.ok) {
      const err = new Error(
        `Telegram API ${method}: ${data?.description ?? "unknown error"}`,
      ) as Error & { code?: number };
      err.code = data?.error_code;
      throw err;
    }
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function tgGetMe() {
  return tgRequest<{
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  }>("getMe", {}, 15000);
}

/** Сбрасывает webhook, чтобы getUpdates заработал (нельзя использовать оба). */
export async function tgDeleteWebhook() {
  return tgRequest<boolean>("deleteWebhook", { drop_pending_updates: false }, 15000);
}

export async function tgGetUpdates(
  offset: number | null,
  timeoutSec = 25,
): Promise<TgUpdate[]> {
  return tgRequest<TgUpdate[]>(
    "getUpdates",
    {
      offset: offset ?? undefined,
      limit: 100,
      timeout: timeoutSec,
      allowed_updates: ["message"],
    },
    timeoutSec * 1000 + 15000,
  );
}

export async function tgSendMessage(
  chatId: string | number,
  text: string,
  extra?: { disable_notification?: boolean },
): Promise<{ message_id: number }> {
  return tgRequest<{ message_id: number }>(
    "sendMessage",
    {
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: "HTML",
      disable_web_page_preview: false,
      disable_notification: extra?.disable_notification ?? false,
    },
    20000,
  );
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
