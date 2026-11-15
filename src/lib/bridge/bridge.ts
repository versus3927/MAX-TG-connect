import type { TgUpdate } from "@/lib/telegram";
import { escapeHtml, tgSendMessage } from "@/lib/telegram";
import {
  countActiveSubscribers,
  getSetting,
  insertEvent,
  listActiveSubscribers,
  setSetting,
  setSubscriberActive,
  updateEvent,
  upsertSubscriber,
} from "@/lib/bridge/store";
import { getMaxAccountToken } from "@/lib/bridge/store";
import type { Subscriber } from "@/lib/bridge/store";

/** Мост включён по умолчанию; выключается настройкой из панели. */
export async function isBridgeEnabled(): Promise<boolean> {
  const v = await getSetting("bridge_enabled");
  return v === null ? true : v === "true";
}

/** Фильтр по конкретной группе MAX: настройка из панели, либо env MAX_CHAT_ID. */
export async function getMaxChatFilter(): Promise<string | null> {
  const fromSettings = await getSetting("max_chat_id");
  if (fromSettings !== null) return fromSettings.trim() || null;
  const fromEnv = process.env.MAX_CHAT_ID;
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : null;
}

export type BroadcastResult = {
  duplicate: boolean;
  delivered: number;
  status: string;
  eventId: number | null;
};

export async function broadcastEvent(input: {
  senderName: string;
  senderUsername: string | null;
  text: string;
  maxChatId: string | null;
  maxChatTitle?: string | null;
  maxMid: string | null;
  kind?: "message" | "system";
  force?: boolean;
}): Promise<BroadcastResult> {
  const event = await insertEvent({
    kind: input.kind ?? "message",
    maxChatId: input.maxChatId,
    maxChatTitle: input.maxChatTitle ?? null,
    senderName: input.senderName,
    senderUsername: input.senderUsername,
    text: input.text,
    maxMid: input.maxMid,
    delivered: 0,
    status: "ok",
  });
  if (!event)
    return { duplicate: true, delivered: 0, status: "duplicate", eventId: null };

  const enabled = await isBridgeEnabled();
  const subs: Subscriber[] = await listActiveSubscribers();

  if (!enabled && !input.force) {
    await updateEvent(event.id, { status: "disabled", delivered: 0 });
    return {
      duplicate: false,
      delivered: 0,
      status: "disabled",
      eventId: event.id,
    };
  }
  if (subs.length === 0) {
    await updateEvent(event.id, { status: "no-subscribers", delivered: 0 });
    return {
      duplicate: false,
      delivered: 0,
      status: "no-subscribers",
      eventId: event.id,
    };
  }

  const lines: string[] = [];
  const name = `<b>${escapeHtml(input.senderName)}</b>`;
  const nick = input.senderUsername
    ? ` <code>@${escapeHtml(input.senderUsername)}</code>`
    : "";
  lines.push(name + nick);
  if (input.maxChatTitle)
    lines.push(`<i>чат: ${escapeHtml(input.maxChatTitle)}</i>`);
  lines.push("");
  lines.push(input.text || "(пустое сообщение)");
  const tgText = lines.join("\n");

  let delivered = 0;
  let hadError = false;
  for (const sub of subs) {
    try {
      await tgSendMessage(sub.chatId, tgText);
      delivered += 1;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 403) {
        // Пользователь заблокировал бота — отписываем.
        await setSubscriberActive(sub.chatId, false);
      } else {
        hadError = true;
        console.error(`[bridge] send to ${sub.chatId} failed:`, err);
      }
    }
  }

  const status = hadError ? "error" : "ok";
  await updateEvent(event.id, { delivered, status });
  return { duplicate: false, delivered, status, eventId: event.id };
}

/* ------------------------ Telegram update handling ---------------------- */

const WELCOME_TEXT = [
  "<b>Мост MAX → Telegram подключён.</b>",
  "",
  "Вы подписаны на ленту сообщений из группы MAX. Каждое новое сообщение будет приходить сюда автоматически — с именем отправителя в MAX.",
  "",
  "Команды:",
  "/status — состояние подписки",
  "/start — подключиться",
].join("\n");

const HELP_TEXT = [
  "<b>Как это работает</b>",
  "",
  "Владелец группы держит свой аккаунт MAX в группе — мост читает её и дублирует сообщения вам в Telegram.",
  "",
  "/start — подписаться на пересылку",
  "/status — проверить состояние",
].join("\n");

export async function handleTgUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  const text = msg?.text?.trim();
  if (!msg || !text) return;

  const chatId = String(msg.chat.id);
  const username = msg.from?.username ?? null;
  const firstName = msg.from?.first_name ?? null;

  // Любое сообщение боту — автоматически (ре)активируем подписчика
  await upsertSubscriber(chatId, username, firstName);

  if (text.startsWith("/start")) {
    await tgSendMessage(chatId, WELCOME_TEXT);
    return;
  }



  if (text.startsWith("/status")) {
    const enabled = await isBridgeEnabled();
    const total = await countActiveSubscribers();
    const filter = await getMaxChatFilter();
    await tgSendMessage(
      chatId,
      [
        "<b>Состояние моста</b>",
        `Пересылка: ${enabled ? "включена" : "выключена администратором"}`,
        `Активных подписчиков: ${total}`,
        `Группа MAX: ${filter ? `<code>${escapeHtml(filter)}</code>` : "все группы, где есть аккаунт"}`,
      ].join("\n"),
    );
    return;
  }

  if (text.startsWith("/help")) {
    await tgSendMessage(chatId, HELP_TEXT);
    return;
  }

  await tgSendMessage(
    chatId,
    "Я только пересылаю сообщения из MAX и не отвечаю в чат. Команды: /start, /status, /help.",
  );
}
