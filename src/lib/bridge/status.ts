import {
  countActiveSubscribers,
  countEvents,
  getJsonSetting,
  getMaxAccountToken,
  getSetting,
  listAllSubscribers,
  listKnownChats,
  listRecentEvents,
} from "@/lib/bridge/store";
import { getMaxChatFilter, isBridgeEnabled } from "@/lib/bridge/bridge";

export type BotInfo = {
  username?: string;
  name?: string;
  id?: number;
  at?: string;
};

export type MaxAccountInfo = {
  ownUserId?: number | null;
  chatsCount?: number;
  at?: string;
};

function maskChatId(chatId: string): string {
  if (chatId.length <= 5) return "***";
  return `${chatId.slice(0, 3)}•••${chatId.slice(-2)}`;
}

export async function getBridgeStatus() {
  const [
    enabled,
    maxChatId,
    knownChats,
    heartbeat,
    maxLastSync,
    tgBotInfo,
    maxAccountInfo,
    maxAccountStatus,
    maxAccountError,
    tgBotError,
    subs,
    events,
    eventsTotal,
  ] = await Promise.all([
    isBridgeEnabled(),
    getMaxChatFilter(),
    listKnownChats(),
    getSetting("worker_heartbeat"),
    getSetting("max_last_sync"),
    getJsonSetting<BotInfo>("tg_bot_info"),
    getJsonSetting<MaxAccountInfo>("max_account_info"),
    getSetting("max_account_status"),
    getSetting("max_account_error"),
    getSetting("tg_bot_error"),
    listAllSubscribers(),
    listRecentEvents(40),
    countEvents(),
  ]);

  const heartbeatMs = heartbeat ? Date.parse(heartbeat) : 0;
  const workerAlive = heartbeatMs > 0 && Date.now() - heartbeatMs < 60_000;

  const accountConnected =
    (maxAccountStatus ?? "") === "connected" ||
    (maxLastSync != null && Date.now() - Date.parse(maxLastSync) < 60_000);

  return {
    configured: {
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      // у аккаунта нет env как источника истины: считаем настроенным, если
      // сессия подключена или уже сейчас живёт в воркере
      max: accountConnected || Boolean(getMaxAccountToken()),
      db: Boolean(process.env.DATABASE_URL),
    },
    bridge: {
      enabled,
      maxChatId,
      knownChats,
      workerAlive,
      heartbeat,
      maxLastSync,
    },
    bots: {
      telegram: tgBotInfo,
      telegramError: tgBotError || null,
    },
    maxAccount: {
      connected: accountConnected,
      status: maxAccountStatus ?? "disconnected",
      error: maxAccountError || null,
      hasTokenInEnv: Boolean(process.env.MAX_ACCOUNT_TOKEN),
      info: maxAccountInfo,
      lastSync: maxLastSync,
    },
    stats: {
      activeSubscribers: await countActiveSubscribers(),
      totalSubscribers: subs.length,
      eventsTotal,
    },
    subscribers: subs.map((s) => ({
      id: s.id,
      chatId: maskChatId(s.chatId),
      username: s.username,
      firstName: s.firstName,
      active: s.active,
      createdAt: s.createdAt,
    })),
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      senderName: e.senderName,
      senderUsername: e.senderUsername,
      text: e.text,
      maxChatTitle: e.maxChatTitle,
      delivered: e.delivered,
      status: e.status,
      createdAt: e.createdAt,
    })),
  };
}
