import type { MaxUpdate } from "@/lib/max";
import type { TgUpdate } from "@/lib/telegram";
import { escapeHtml, tgSendMessage } from "@/lib/telegram";
import {
  countActiveSubscribers,
  getJsonSetting,
  getSetting,
  insertEvent,
  knownChatTitle,
  listActiveSubscribers,
  rememberKnownChat,
  setSubscriberActive,
  updateEvent,
  upsertSubscriber,
} from "@/lib/bridge/store";
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

const ATTACHMENT_LABELS: Record<string, string> = {
  image: "Фото",
  video: "Видео",
  audio: "Аудио",
  file: "Файл",
  sticker: "Стикер",
  voice: "Голосовое сообщение",
  contact: "Контакт",
  location: "Геопозиция",
  inline_keyboard: "Кнопки",
  share: "Репост",
  photo: "Фото",
};

function describeAttachments(
  attachments: { type?: string; payload?: { url?: string } }[],
): string[] {
  return attachments.map((a) => {
    const label = ATTACHMENT_LABELS[a.type ?? ""] ?? "Вложение";
    const url = a.payload?.url;
    return url ? `[${label}] ${url}` : `[${label}]`;
  });
}

export async function buildTelegramText(opts: {
  senderName: string;
  senderUsername: string | null;
  text: string;
  chatTitle: string | null;
}): Promise<string> {
  const lines: string[] = [];
  const name = `<b>${escapeHtml(opts.senderName)}</b>`;
  const nick = opts.senderUsername
    ? ` <code>@${escapeHtml(opts.senderUsername)}</code>`
    : "";
  lines.push(name + nick);
  if (opts.chatTitle) lines.push(`<i>чат: ${escapeHtml(opts.chatTitle)}</i>`);
  lines.push("");
  lines.push(opts.text);
  return lines.join("\n");
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
  if (!event) return { duplicate: true, delivered: 0, status: "duplicate", eventId: null };

  const enabled = await isBridgeEnabled();
  const subs: Subscriber[] = await listActiveSubscribers();

  if (!enabled && !input.force) {
    await updateEvent(event.id, { status: "disabled", delivered: 0 });
    return { duplicate: false, delivered: 0, status: "disabled", eventId: event.id };
  }
  if (subs.length === 0) {
    await updateEvent(event.id, { status: "no-subscribers", delivered: 0 });
    return { duplicate: false, delivered: 0, status: "no-subscribers", eventId: event.id };
  }

  const tgText = await buildTelegramText({
    senderName: input.senderName,
    senderUsername: input.senderUsername,
    text: input.text || "(пустое сообщение)",
    chatTitle: input.maxChatTitle ?? null,
  });

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

/* ------------------------- MAX update handling ------------------------- */

export async function handleMaxUpdate(update: MaxUpdate): Promise<void> {
  switch (update.update_type) {
    case "message_created": {
      const msg = update.message;
      if (!msg?.body) return;
      if (msg.sender?.is_bot) return;

      const chatId = msg.recipient?.chat_id != null ? String(msg.recipient.chat_id) : null;
      const filter = await getMaxChatFilter();
      if (filter && chatId !== filter) return;

      const textParts: string[] = [];
      if (msg.body.text?.trim()) textParts.push(msg.body.text.trim());
      if (msg.body.attachments?.length) {
        textParts.push(...describeAttachments(msg.body.attachments));
      }
      const text = textParts.join("\n") || "(сообщение без текста)";

      const chatTitle = chatId ? await knownChatTitle(chatId) : null;

      await broadcastEvent({
        senderName: msg.sender?.name ?? "Участник MAX",
        senderUsername: msg.sender?.username ?? null,
        text,
        maxChatId: chatId,
        maxChatTitle: chatTitle,
        maxMid: msg.body.mid ?? null,
      });
      return;
    }
    case "bot_added_to_chat": {
      const chatId = update.chat_id != null ? String(update.chat_id) : null;
      const title = update.chat?.title ?? "Группа MAX";
      if (chatId) await rememberKnownChat(chatId, title);
      await insertEvent({
        kind: "system",
        maxChatId: chatId,
        maxChatTitle: title,
        senderName: "MAX",
        senderUsername: null,
        text: `Бот добавлен в группу «${title}»${chatId ? ` (chat_id: ${chatId})` : ""}`,
        maxMid: null,
        delivered: 0,
        status: "ok",
      });
      return;
    }
    case "chat_title_changed": {
      const chatId = update.chat_id != null ? String(update.chat_id) : null;
      const title = update.chat?.title ?? null;
      if (chatId && title) await rememberKnownChat(chatId, title);
      return;
    }
    default:
      return;
  }
}

/* ------------------------ Telegram update handling ---------------------- */

const WELCOME_TEXT = [
  "<b>Мост MAX → Telegram подключён.</b>",
  "",
  "Вы подписаны на ленту сообщений из группы MAX. Каждое новое сообщение будет приходить сюда автоматически — с именем и ником отправителя в MAX.",
  "",
  "Команды:",
  "/status — состояние подписки",
  "/stop — выключить пересылку",
  "/start — включить обратно",
].join("\n");

const HELP_TEXT = [
  "<b>Как это работает</b>",
  "",
  "Бот-приёмник состоит в группе MAX и читает её сообщения. Этот Telegram-бот дублирует их вам в личку.",
  "",
  "/start — подписаться на пересылку",
  "/stop — отписаться",
  "/status — проверить состояние",
].join("\n");

export async function handleTgUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  const text = msg?.text?.trim();
  if (!msg || !text) return;

  const chatId = String(msg.chat.id);
  const username = msg.from?.username ?? null;
  const firstName = msg.from?.first_name ?? null;

  if (text.startsWith("/start")) {
    await upsertSubscriber(chatId, username, firstName);
    await tgSendMessage(chatId, WELCOME_TEXT);
    return;
  }

  if (text.startsWith("/stop")) {
    await setSubscriberActive(chatId, false);
    await tgSendMessage(
      chatId,
      "Пересылка выключена. Напишите /start, чтобы включить её снова.",
    );
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
        `Группа MAX: ${filter ? `<code>${escapeHtml(filter)}</code>` : "все группы, где есть бот"}`,
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
    "Я только пересылаю сообщения из MAX и не отвечаю в чат. Команды: /start, /stop, /status, /help.",
  );
}

export async function getKnownChats() {
  return ((await getJsonSetting("max_known_chats")) ?? []) as {
    chatId: string;
    title: string;
    seenAt: string;
  }[];
}
