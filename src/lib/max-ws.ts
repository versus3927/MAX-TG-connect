/**
 * Клиент приватного WebSocket-протокола MAX (web.max.ru), ver=11, JSON-кадры.
 * Endpoint: wss://ws-api.oneme.ru/websocket, обязателен Origin: https://web.max.ru.
 *
 * Протокол неофициальный (reverse engineered): см. pr0bel1230/max-api-docs.
 * Работает от лица пользовательского аккаунта — это юзербот-функциональность,
 * используйте на свой риск (возможен бан аккаунта за автоматизацию).
 *
 * Основные опкоды:
 *   6   HELLO (инициализация сессии, deviceId + userAgent)
 *   17  VERIFICATION_REQUEST (SMS-код)   18 CODE_ENTER (→ access token)
 *   19  LOGIN (токен → дамп аккаунта: profile, chats)
 *   48  GET_CHATS_BULK      49 GET_HISTORY      53 GET_CHATS (пагинация)
 *   61  GET_CHAT_INFO       32 GET_CONTACTS     75 CHAT_SUBSCRIBE
 *   1   PING (heartbeat, держит сессию ~30–60 с)
 *   cmd=0 — push-уведомления от сервера (защита по эвристике: chatId+message)
 */

import WebSocket from "ws";
import { EventEmitter } from "node:events";

export const MAX_WS_URL =
  process.env.MAX_WS_URL ?? "wss://ws-api.oneme.ru/websocket";

const PROTO_VER = 11;
const OP = {
  PING: 1,
  HELLO: 6,
  CAPTCHA_REQUEST: 224,
  CONTACTS: 32,
  CHATS_BULK: 48,
  HISTORY: 49,
  CHATS: 53,
  CHAT_INFO: 61,
  CHAT_SUBSCRIBE: 75,
  LOGIN: 19,
  SMS_REQUEST: 17,
  SMS_CODE: 18,
} as const;

export type RawPacket = {
  ver?: number;
  cmd?: number;
  seq?: number;
  opcode?: number;
  payload?: unknown;
};

export type MaxChat = {
  id: number | string;
  type?: string; // DIALOG | CHAT | CHANNEL
  title?: string | null;
  lastMessage?: {
    id?: number | string;
    time?: number;
    sender?: number | null;
    text?: string | null;
  } | null;
  participants?: Record<string, number>;
  owner?: number;
};

export type HistoryMessage = {
  id: number | string;
  time?: number;
  type?: string; // USER | CHANNEL
  sender?: number | null;
  text?: string | null;
  elements?: unknown[];
  attaches?: { _type?: string; [k: string]: unknown }[];
  link?: { type?: string; chatName?: string; message?: { text?: string } };
};

export type MaxEvent =
  | {
      kind: "message";
      chatId: number;
      message: HistoryMessage;
      senderNameHint?: string | null;
    }
  | { kind: "auth_ok" }
  | { kind: "closed"; reason: string };

function idToNumber(id: number | string | undefined | null): number | null {
  if (id == null) return null;
  const n = typeof id === "string" ? Number(id) : id;
  return Number.isSafeInteger(n) ? n : null;
}

/** Упаковываем int64, которые JS теряет: сервер MAX принимает их и как строки. */
function packIds(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if ((k === "chatId" || k === "messageId" || k === "contactIds") && v != null) {
        if (Array.isArray(v)) out[k] = v.map((x) => String(x));
        else out[k] = typeof v === "number" && !Number.isSafeInteger(v) ? String(v) : v;
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return value;
}

export class MaxWsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (p: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private pingTimer: NodeJS.Timeout | null = null;
  private closedByUs = false;
  loggedIn = false;
  /** userId нашего аккаунта (из ответа LOGIN) */
  ownUserId: number | null = null;
  /** Отображаемое имя нашего аккаунта (из профиля LOGIN) */
  ownDisplayName: string | null = null;
  chats: MaxChat[] = [];
  contacts: Record<string, { name?: string }> = {};

  async connectWithToken(token: string): Promise<MaxChat[]> {
    await this.open();
    await this.hello();
    const resp = await this.request(OP.LOGIN, {
      interactive: true,
      token,
      chatsCount: 100,
      chatsSync: 100,
      contactsSync: 100,
      presenceSync: 0,
      draftsSync: 0,
    });
    const payload = (resp ?? {}) as {
      profile?: { contact?: { id?: number | string; names?: { name?: string }[] } };
      chats?: MaxChat[];
      contacts?: { id: number | string; names?: { name?: string }[] }[];
      error?: string;
      localizedMessage?: string;
    };
    if (payload.error) {
      throw new Error(
        `MAX LOGIN error: ${payload.error} ${payload.localizedMessage ?? ""}`.trim(),
      );
    }
    this.ownUserId = idToNumber(payload.profile?.contact?.id ?? null);
    this.ownDisplayName =
      payload.profile?.contact?.names?.[0]?.name ?? null;
    this.chats = (payload.chats ?? []).map(normalizeChat);
    for (const c of payload.contacts ?? []) {
      const id = idToNumber(c.id);
      if (id != null) {
        this.contacts[String(id)] = { name: c.names?.[0]?.name };
      }
    }
    this.loggedIn = true;
    this.startPing();
    return this.chats;
  }

  /**
   * Запрос VK-капчи, которую MAX требует перед SMS при подозрительных IP.
   * Возвращает ссылку для прохождения в браузере (возвращает token капчи).
   */
  async requestCaptchaLink(phone: string): Promise<string> {
    await this.open();
    await this.hello();
    const resp = (await this.request(OP.CAPTCHA_REQUEST, {
      source: "auth",
      identifier: phone,
    })) as { link?: string; error?: string; localizedMessage?: string };
    if (resp?.error) {
      throw new Error(`MAX captcha error: ${resp.error} ${resp.localizedMessage ?? ""}`.trim());
    }
    if (!resp?.link) throw new Error("MAX не вернул ссылку капчи");
    return resp.link;
  }

  /** SMS-флоу: запрос кода. Возвращает токен подтверждения (для verificationToken). */
  async requestSmsCode(
    phone: string,
    captchaToken?: string,
  ): Promise<{ verificationToken: string; codeLength: number; raw: unknown }> {
    await this.open();
    await this.hello();
    const resp = (await this.request(OP.SMS_REQUEST, {
      phone,
      type: "START_AUTH",
      language: "ru",
      ...(captchaToken ? { captchaToken } : {}),
    })) as {
      token?: string;
      codeLength?: number;
      error?: string;
      localizedMessage?: string;
    };
    if (resp?.error) {
      throw new Error(
        `MAX SMS error: ${resp.error} ${resp.localizedMessage ?? ""}`.trim(),
      );
    }
    if (!resp?.token) throw new Error("MAX не вернул verification token");
    return {
      verificationToken: resp.token,
      codeLength: resp.codeLength ?? 6,
      raw: resp,
    };
  }

  /** SMS-флоу: подтверждение кода. Возвращает access token (живёт долго). */
  async submitSmsCode(
    verificationToken: string,
    code: string,
  ): Promise<{ accessToken: string }> {
    const resp = (await this.request(OP.SMS_CODE, {
      token: verificationToken,
      verifyCode: code,
      authTokenType: "CHECK_CODE",
    })) as {
      tokenAttrs?: { LOGIN?: { token?: string } };
      error?: string;
      localizedMessage?: string;
    };
    if (resp?.error) {
      throw new Error(
        `MAX code error: ${resp.error} — ${resp.localizedMessage ?? ""}`.trim(),
      );
    }
    const token = resp?.tokenAttrs?.LOGIN?.token;
    if (!token) throw new Error("MAX не вернул access token");
    return { accessToken: token };
  }

  async refreshChats(): Promise<MaxChat[]> {
    const chats: MaxChat[] = [];
    const seen = new Set<number>();
    let marker = Date.now();
    for (let page = 0; page < 30; page++) {
      const data = (await this.request(OP.CHATS, {
        count: 100,
        marker,
      })) as { chats?: MaxChat[]; marker?: number };
      const list = (data?.chats ?? []).map(normalizeChat);
      for (const c of list) {
        const id = idToNumber(c.id);
        if (id != null && !seen.has(id)) {
          seen.add(id);
          chats.push(c);
        }
      }
      const next = data?.marker;
      if (!list.length || next == null || next >= marker) break;
      marker = next;
    }
    this.chats = mergeChats(this.chats, chats);
    return this.chats;
  }

  async getChatInfo(chatId: number): Promise<MaxChat | null> {
    try {
      const data = (await this.request(OP.CHAT_INFO, {
        chatIds: [String(chatId)],
      })) as { chats?: MaxChat[]; chat?: MaxChat };
      const chat = data?.chat ?? data?.chats?.[0] ?? null;
      if (chat) {
        const normalized = normalizeChat(chat);
        this.chats = mergeChats(this.chats, [normalized]);
        return normalized;
      }
    } catch {
      /* fall through */
    }
    return null;
  }

  async getHistory(
    chatId: number,
    from: number,
    backward = 0,
    forward = 100,
  ): Promise<HistoryMessage[]> {
    const data = (await this.request(OP.HISTORY, {
      chatId,
      from,
      backward,
      forward,
      backwardTime: 0,
      forwardTime: 0,
      getChat: false,
      getMessages: true,
      interactive: false,
    })) as { messages?: HistoryMessage[] };
    return data?.messages ?? [];
  }

  async resolveContacts(
    ids: number[],
  ): Promise<{ id: number; name: string | null }[]> {
    const unknown = ids.filter((id) => !this.contacts[String(id)]);
    if (unknown.length > 0) {
      try {
        const data = (await this.request(OP.CONTACTS, {
          contactIds: unknown.map(String),
        })) as { contacts?: { id: number | string; names?: { name?: string }[] }[] };
        for (const c of data?.contacts ?? []) {
          const id = idToNumber(c.id);
          if (id != null) this.contacts[String(id)] = { name: c.names?.[0]?.name };
        }
      } catch {
        /* резолв не критичен */
      }
    }
    return ids.map((id) => ({ id, name: this.contacts[String(id)]?.name ?? null }));
  }

  async subscribeChat(chatId: number): Promise<void> {
    try {
      await this.request(OP.CHAT_SUBSCRIBE, { chatId, subscribe: true });
    } catch {
      /* подписка опциональна */
    }
  }

  close(): void {
    this.closedByUs = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.loggedIn = false;
  }

  /* ------------------------------ internals ------------------------------ */

  private open(): Promise<void> {
    this.closeStale();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(MAX_WS_URL, {
        headers: {
          Origin: "https://web.max.ru",
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        },
      });
      this.ws = ws;
      const onOpen = () => {
        cleanup();
        this.bindSocket(ws);
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        ws.off("open", onOpen);
        ws.off("error", onError);
      };
      ws.once("open", onOpen);
      ws.once("error", onError);
    });
  }

  private closeStale(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private bindSocket(ws: WebSocket): void {
    ws.on("message", (raw) => {
      let packet: RawPacket;
      try {
        packet = JSON.parse(raw.toString()) as RawPacket;
      } catch {
        return;
      }
      this.handlePacket(packet);
    });
    ws.on("close", (code, reason) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.loggedIn = false;
      this.rejectAll(new Error(`MAX WS closed (${code})`));
      if (!this.closedByUs) {
        this.emit("closed", { kind: "closed", reason: `${code} ${reason}` });
      }
    });
    ws.on("error", () => {
      /* close-handler подхватит */
    });
  }

  private handlePacket(packet: RawPacket): void {
    const { cmd, seq, opcode, payload } = packet;
    if (cmd === 1 || cmd === 3) {
      if (seq != null && this.pending.has(seq)) {
        const entry = this.pending.get(seq)!;
        this.pending.delete(seq);
        clearTimeout(entry.timer);
        if (cmd === 3) {
          const err = (payload ?? {}) as { error?: string; message?: string };
          entry.reject(new Error(err.error ?? err.message ?? "MAX request error"));
        } else {
          entry.resolve(payload);
        }
      }
      return;
    }
    if (cmd === 0) {
      const ev = this.pushToEvent(opcode ?? -1, payload);
      if (ev) this.emit("event", ev);
      else this.emit("push", packet);
    }
  }

  /** Эвристика нового сообщения: MAX документирует только часть пушей. */
  private pushToEvent(opcode: number, payload: unknown): MaxEvent | null {
    if (opcode === OP.LOGIN) return { kind: "auth_ok" };
    if (opcode === 0 || opcode === 1) return null; // ping/pong
    const p = payload as
      | {
          chatId?: number | string;
          message?: HistoryMessage & { sender?: number | null };
          text?: string;
          sender?: number | null;
        }
      | undefined;
    if (!p) return null;
    if ("message" in p && p.message && p.chatId != null) {
      const chatId = idToNumber(p.chatId);
      if (chatId == null) return null;
      const msg = p.message;
      if (msg && (msg.id != null || msg.text != null)) {
        return { kind: "message", chatId, message: msg };
      }
    }
    // формат "расплющенного" пуша: chatId + text + sender на верхнем уровне
    if (p.chatId != null && (p.text != null || p.sender != null)) {
      const chatId = idToNumber(p.chatId);
      if (chatId == null) return null;
      return {
        kind: "message",
        chatId,
        message: { id: `push-${Date.now()}`, text: p.text, sender: p.sender },
      };
    }
    return null;
  }

  private request(opcode: number, payload: unknown, timeoutMs = 20000): Promise<unknown> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("MAX WS not connected"));
    }
    const seq = ++this.seq;
    const packet = JSON.stringify({
      ver: PROTO_VER,
      cmd: 0,
      seq,
      opcode,
      payload: packIds(payload) ?? {},
    });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`MAX request timeout (opcode ${opcode})`));
      }, timeoutMs);
      this.pending.set(seq, { resolve, reject, timer });
      ws.send(packet, (err) => {
        if (err) {
          this.pending.delete(seq);
          clearTimeout(timer);
          reject(err);
        }
      });
    });
  }

  private hello(): Promise<unknown> {
    const deviceId = process.env.MAX_DEVICE_ID?.trim() || randomUuid();
    return this.request(OP.HELLO, {
      userAgent: {
        deviceType: "WEB",
        pushDeviceType: "WEBPUSH",
        locale: "ru",
        deviceLocale: "ru",
        osVersion: "Linux",
        deviceName: "Chrome",
        headerUserAgent:
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        appVersion: "26.8.10",
        screen: "1000x1280 1.0x",
        timezone: "Europe/Moscow",
      },
      deviceId,
    });
  }

  private startPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      this.request(OP.PING, { interactive: true }, 10000).catch(() => {
        /* упавший ping уронит сокет → closed → реконнект */
      });
    }, 25000);
  }

  private rejectAll(err: Error): void {
    for (const [seq, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
      this.pending.delete(seq);
    }
  }
}

function normalizeChat(chat: MaxChat): MaxChat {
  return {
    ...chat,
    lastMessage: chat.lastMessage
      ? { ...chat.lastMessage }
      : chat.lastMessage ?? null,
  };
}

function mergeChats(existing: MaxChat[], incoming: MaxChat[]): MaxChat[] {
  const map = new Map<string, MaxChat>();
  for (const c of [...existing, ...incoming]) {
    map.set(String(c.id), c);
  }
  return [...map.values()];
}

function randomUuid(): string {
  // crypto.randomUUID доступен в Node 19+
  return globalThis.crypto.randomUUID();
}
