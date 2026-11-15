import {
  countActiveSubscribers,
  countEvents,
  getJsonSetting,
  getSetting,
  listAllSubscribers,
  listRecentEvents,
} from "@/lib/bridge/store";
import { getMaxChatFilter, isBridgeEnabled } from "@/lib/bridge/bridge";

export type BotInfo = {
  username?: string;
  name?: string;
  id?: number;
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
    maxLastPoll,
    tgBotInfo,
    maxBotInfo,
    tgBotError,
    maxBotError,
    subs,
    events,
    eventsTotal,
  ] = await Promise.all([
    isBridgeEnabled(),
    getMaxChatFilter(),
    getJsonSetting<{ chatId: string; title: string; seenAt: string }[]>(
      "max_known_chats",
    ),
    getSetting("worker_heartbeat"),
    getSetting("max_last_poll"),
    getJsonSetting<BotInfo>("tg_bot_info"),
    getJsonSetting<BotInfo>("max_bot_info"),
    getSetting("tg_bot_error"),
    getSetting("max_bot_error"),
    listAllSubscribers(),
    listRecentEvents(40),
    countEvents(),
  ]);

  const heartbeatMs = heartbeat ? Date.parse(heartbeat) : 0;
  const workerAlive =
    heartbeatMs > 0 && Date.now() - heartbeatMs < 60_000;

  return {
    configured: {
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      max: Boolean(process.env.MAX_BOT_TOKEN),
      db: Boolean(process.env.DATABASE_URL),
    },
    bridge: {
      enabled,
      maxChatId,
      knownChats: knownChats ?? [],
      workerAlive,
      heartbeat,
      maxLastPoll,
    },
    bots: {
      telegram: tgBotInfo,
      max: maxBotInfo,
      telegramError: tgBotError,
      maxError: maxBotError,
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
