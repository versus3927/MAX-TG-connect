import { MaxWsClient, type HistoryMessage, type MaxChat } from "@/lib/max-ws";
import { tgDeleteWebhook, tgGetMe, tgGetUpdates } from "@/lib/telegram";
import { broadcastEvent, handleTgUpdate } from "@/lib/bridge/bridge";
import { takeMaxAccountTokenNonce } from "@/lib/max-auth-session";
import {
  getJsonSetting,
  getMaxAccountToken,
  getSetting,
  listKnownChats,
  rememberKnownChat,
  setJsonSetting,
  setSetting,
} from "@/lib/bridge/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

declare global {
  // eslint-disable-next-line no-var
  var __maxTgBridgeStarted: boolean | undefined;
}

/* ------------------------------ helpers ------------------------------ */

function asNum(id: number | string | null | undefined): number | null {
  if (id == null) return null;
  const n = typeof id === "string" ? Number(id) : id;
  return Number.isSafeInteger(n) ? n : null;
}

function describeAttaches(
  attaches: { _type?: string }[] | undefined | null,
): string[] {
  if (!attaches?.length) return [];
  const map: Record<string, string> = {
    PHOTO: "Фото",
    VIDEO: "Видео",
    AUDIO: "Аудио",
    VOICE: "Голосовое сообщение",
    FILE: "Файл",
    STICKER: "Стикер",
    SHARE: "Репост",
    CONTROL: "Системное событие",
    CALL: "Звонок",
    CONTACT: "Контакт",
    UNSUPPORTED: "Вложение",
  };
  return attaches
    .map((a) => map[a._type ?? ""] ?? null)
    .filter((x): x is string => Boolean(x))
    .map((label) => `[${label}]`);
}

function messageToText(msg: HistoryMessage): string {
  const parts: string[] = [];
  if (msg.text?.trim()) parts.push(msg.text.trim());
  if (msg.link?.type === "FORWARD" && msg.link.chatName) {
    parts.push(`[Переслано из «${msg.link.chatName}»]`);
    if (msg.link.message?.text?.trim()) parts.push(msg.link.message.text.trim());
  }
  parts.push(...describeAttaches(msg.attaches));
  return parts.join("\n") || "(сообщение без текста)";
}

/* --------------------------- tg bot info card -------------------------- */

async function refreshTgBotInfo() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    const me = await tgGetMe();
    await setJsonSetting("tg_bot_info", {
      username: me.username,
      name: me.first_name,
      id: me.id,
      at: new Date().toISOString(),
    });
    await setSetting("tg_bot_error", "");
  } catch (err) {
    console.error("[bridge] telegram getMe failed:", err);
    await setSetting("tg_bot_error", String(err).slice(0, 300));
  }
}

/* ------------------------------ tg loop -------------------------------- */

async function tgLoop() {
  let offset: number | null = null;
  try {
    await tgDeleteWebhook(); // getUpdates не работает с активным webhook
  } catch (err) {
    console.error("[bridge] telegram deleteWebhook failed:", err);
  }
  for (;;) {
    try {
      const updates = await tgGetUpdates(offset, 25);
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          await handleTgUpdate(u);
        } catch (err) {
          console.error("[bridge] tg update handling failed:", err);
        }
      }
    } catch (err) {
      console.error("[bridge] tg polling failed:", err);
      await sleep(5000);
    }
  }
}

/* ------------------------------ max loop ------------------------------- */

/** Доставить одно сообщение чата всем подписчикам, с резолвом имени. */
async function relayMessage(
  client: MaxWsClient,
  chatId: number,
  msg: HistoryMessage,
): Promise<void> {
  // Пересылаем ВСЕ сообщения, включая свои
  const filter = (await getSetting("max_chat_id"))?.trim() || process.env.MAX_CHAT_ID?.trim() || null;
  if (filter && String(chatId) !== filter) return;

  const senderId = asNum(msg.sender);
  let senderName: string | null = null;

  // Если это сообщение от владельца аккаунта — берём имя из профиля
  if (senderId != null && senderId === client.ownUserId) {
    senderName = client.ownDisplayName ?? null;
  }

  if (!senderName && senderId != null) {
    const [resolved] = await client.resolveContacts([senderId]);
    senderName = resolved?.name ?? null;
  }
  if (!senderName) {
    senderName = (msg as unknown as { senderName?: string }).senderName ?? null;
  }
  senderName ??= senderId != null ? `id${senderId}` : "Участники MAX";

  const known = (await listKnownChats()).find((c) => c.chatId === String(chatId));
  const chatTitle =
    known?.title ??
    client.chats.find((c) => String(c.id) === String(chatId))?.title ??
    null;

  await broadcastEvent({
    senderName,
    senderUsername: null,
    text: messageToText(msg),
    maxChatId: String(chatId),
    maxChatTitle: chatTitle,
    maxMid: msg.id != null ? String(msg.id) : null,
  });
}

function rememberChatsFrom(chats: MaxChat[]) {
  return Promise.all(
    chats
      .filter((c) => c.type && c.type !== "DIALOG" && c.title)
      .slice(0, 30)
      .map((c) => rememberKnownChat(String(c.id), c.title ?? "Чат MAX", c.type)),
  );
}

async function maxLoop() {
  for (;;) {
    const token = getMaxAccountToken();
    if (!token) {
      await setSetting("max_account_status", "disconnected");
      await setSetting(
        "max_account_error",
        "Аккаунт не подключён. Войдите по номеру телефона в панели (или задайте MAX_ACCOUNT_TOKEN).",
      );
      // ждём, когда из панели сохранят токен (nonce), либо проверяем раз в 5 с
      while (!getMaxAccountToken() && takeMaxAccountTokenNonce() <= 0) {
        await sleep(5000);
      }
      continue;
    }
    // если был явный disconnect прямо перед этим — уважаем его
    if (takeMaxAccountTokenNonce() < 0) continue;

    const client = new MaxWsClient();
    let pollTimer: NodeJS.Timeout | null = null;

    try {
      await setSetting("max_account_status", "connecting");
      const chats = await client.connectWithToken(token);
      await setSetting("max_account_status", "connected");
      await setSetting("max_account_error", "");
      await setJsonSetting("max_account_info", {
        ownUserId: client.ownUserId,
        chatsCount: chats.length,
        at: new Date().toISOString(),
      });
      await setSetting("max_last_sync", new Date().toISOString());
      await rememberChatsFrom(chats);

      // Подписываемся на живые пуши по группам/каналам
      const filter =
        (await getSetting("max_chat_id"))?.trim() || process.env.MAX_CHAT_ID?.trim();
      const targets = filter
        ? chats.filter((c) => String(c.id) === filter)
        : chats.filter((c) => c.type !== "DIALOG");
      for (const c of targets.slice(0, 50)) {
        const id = asNum(c.id);
        if (id != null) {
          client.subscribeChat(id).catch(() => {});
        }
      }

      // Инициализируем watermark последнего сообщения
      const initialMarks: Record<string, number> = {};
      for (const c of chats) {
        const t = c.lastMessage?.time;
        if (t) initialMarks[String(c.id)] = t;
      }
      const savedMarks =
        (await getJsonSetting<Record<string, number>>("max_last_ts")) ?? {};
      await setJsonSetting("max_last_ts", { ...savedMarks, ...initialMarks });

      client.on("event", async (ev) => {
        if (ev.kind !== "message") return;
        try {
          const mark =
            (await getJsonSetting<Record<string, number>>("max_last_ts")) ?? {};
          const key = String(ev.chatId);
          if (ev.message.time) {
            mark[key] = Math.max(mark[key] ?? 0, ev.message.time);
            await setJsonSetting("max_last_ts", mark);
          }
          await setSetting("max_last_sync", new Date().toISOString());
          await relayMessage(client, ev.chatId, ev.message);
        } catch (err) {
          console.error("[bridge] live relay failed:", err);
        }
      });

      const reconnect = new Promise<never>((_, reject) => {
        client.once("closed", (e) => reject(new Error(`WS closed: ${e.reason}`)));
        const disconnectCheck = setInterval(() => {
          if (takeMaxAccountTokenNonce() < 0 || !getMaxAccountToken()) {
            clearInterval(disconnectCheck);
            reject(new Error("Аккаунт отключён администратором"));
          }
        }, 3000);
        client.once("closed", () => clearInterval(disconnectCheck));
      });

      // Резерв: периодический опрос истории от watermark (если пуш не дойдёт)
      pollTimer = setInterval(() => {
        void (async () => {
          try {
            const marks =
              (await getJsonSetting<Record<string, number>>("max_last_ts")) ?? {};
            const chatsNow = client.chats.filter((c) => c.type !== "DIALOG");
            const filter2 =
              (await getSetting("max_chat_id"))?.trim() ||
              process.env.MAX_CHAT_ID?.trim();
            for (const chat of chatsNow) {
              const id = asNum(chat.id);
              if (id == null) continue;
              if (filter2 && String(id) !== filter2) continue;
              const last = marks[String(id)] ?? Date.now();
              const fresh = await client.getHistory(id, last, 0, 100);
              const newestFirst = [...fresh].sort(
                (a, b) => (b.time ?? 0) - (a.time ?? 0),
              );
              for (const msg of newestFirst.reverse()) {
                if (!msg.time || msg.time <= last) continue;
                marks[String(id)] = Math.max(marks[String(id)] ?? 0, msg.time);
                await relayMessage(client, id, msg);
              }
            }
            await setJsonSetting("max_last_ts", marks);
            await setSetting("max_last_sync", new Date().toISOString());
            await refreshChatsTitleCache(client);
          } catch (err) {
            console.error("[bridge] history poll failed:", err);
          }
        })();
      }, 5000);

      await reconnect;
    } catch (err) {
      console.error("[bridge] max loop iteration failed:", err);
      const manual = !getMaxAccountToken();
      await setSetting(
        "max_account_status",
        manual ? "disconnected" : "error",
      );
      await setSetting("max_account_error", String(err).slice(0, 300));
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      client.close();
    }

    await sleep(8000); // пауза перед реконнектом
  }
}

async function refreshChatsTitleCache(client: MaxWsClient) {
  try {
    const chats = await client.refreshChats();
    await rememberChatsFrom(chats);
  } catch {
    /* список чатов не критичен */
  }
}

/* ----------------------------- heartbeat ------------------------------- */

async function heartbeatLoop() {
  let tick = 0;
  for (;;) {
    try {
      await setSetting("worker_heartbeat", new Date().toISOString());
      if (tick % 30 === 0) await refreshTgBotInfo();
    } catch (err) {
      console.error("[bridge] heartbeat failed:", err);
    }
    tick += 1;
    await sleep(20000);
  }
}

/* ------------------------------- start ---------------------------------- */

/**
 * Запускает фоновый мост MAX(аккаунт) → Telegram(бот).
 * Вызывается один раз при старте сервера (см. src/instrumentation.ts).
 * Работает на Railway как обычный Node-процесс рядом с Next.js.
 */
export function startBridge(): void {
  if (globalThis.__maxTgBridgeStarted) return;
  globalThis.__maxTgBridgeStarted = true;

  const hasTg = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasDb = Boolean(process.env.DATABASE_URL);

  console.log(
    `[bridge] starting. telegramBot=${hasTg ? "configured" : "missing"} maxAccount=${
      getMaxAccountToken() ? "token-in-env" : "needs SMS login via panel"
    } db=${hasDb ? "configured" : "missing"}`,
  );

  if (!hasDb || !hasTg) {
    console.log(
      "[bridge] TELEGRAM_BOT_TOKEN/DATABASE_URL не заданы — воркер моста в режиме ожидания (панель подскажет, что настроить).",
    );
    return;
  }

  void heartbeatLoop();
  void tgLoop();
  void maxLoop();
}
