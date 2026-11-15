"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  Bot,
  CheckCheck,
  Cpu,
  Filter,
  FlaskConical,
  Info,
  KeyRound,
  Loader2,
  MessagesSquare,
  Radio,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

/* ------------------------------- types ------------------------------- */

type BotInfo = { username?: string; name?: string; id?: number; at?: string };

type EventItem = {
  id: number;
  kind: string;
  senderName: string | null;
  senderUsername: string | null;
  text: string | null;
  maxChatTitle: string | null;
  delivered: number;
  status: string;
  createdAt: string;
};

type SubscriberItem = {
  id: number;
  chatId: string;
  username: string | null;
  firstName: string | null;
  active: boolean;
  createdAt: string;
};

export type StatusPayload = {
  ok: boolean;
  adminRequired: boolean;
  configured: { telegram: boolean; max: boolean; db: boolean };
  bridge: {
    enabled: boolean;
    maxChatId: string | null;
    knownChats: { chatId: string; title: string; seenAt: string }[];
    workerAlive: boolean;
    heartbeat: string | null;
    maxLastPoll: string | null;
  };
  bots: {
    telegram: BotInfo | null;
    max: BotInfo | null;
    telegramError: string | null;
    maxError: string | null;
  };
  stats: {
    activeSubscribers: number;
    totalSubscribers: number;
    eventsTotal: number;
  };
  subscribers: SubscriberItem[];
  events: EventItem[];
};

/* ------------------------------ helpers ------------------------------ */

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusDot({ alive }: { alive: boolean }) {
  return (
    <span className="relative inline-flex size-2.5">
      {alive ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      ) : null}
      <span
        className={`relative inline-flex size-2.5 rounded-full ${alive ? "bg-emerald-400" : "bg-zinc-600"}`}
      />
    </span>
  );
}

function StatusBadge({ event }: { event: EventItem }) {
  const map: Record<string, { cls: string; label: string }> = {
    ok: {
      cls: "text-emerald-300 border-emerald-400/20 bg-emerald-400/10",
      label: `доставлено ${event.delivered}`,
    },
    "no-subscribers": {
      cls: "text-amber-300 border-amber-400/20 bg-amber-400/10",
      label: "нет подписчиков",
    },
    disabled: {
      cls: "text-zinc-400 border-white/10 bg-white/5",
      label: "мост выключен",
    },
    error: {
      cls: "text-rose-300 border-rose-400/20 bg-rose-400/10",
      label: `частично: ${event.delivered}`,
    },
    duplicate: {
      cls: "text-zinc-400 border-white/10 bg-white/5",
      label: "дубликат",
    },
  };
  const s = map[event.status] ?? map.ok;
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

/* ----------------------------- main panel ---------------------------- */

export function Dashboard() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [chatIdDraft, setChatIdDraft] = useState("");
  const [chatIdTouched, setChatIdTouched] = useState(false);

  const [testName, setTestName] = useState("Максим");
  const [testNick, setTestNick] = useState("maksim_max");
  const [testText, setTestText] = useState(
    "Напоминаю: завтра в 10:00 созвон по проекту, не опаздывайте.",
  );
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as StatusPayload;
      setData(json);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("bridge_admin_key") ?? "";
    setAdminKey(saved);
    setKeyDraft(saved);
    void load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const authed = useCallback(
    async (path: string, init?: RequestInit): Promise<boolean> => {
      const res = await fetch(path, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
          ...(init?.headers ?? {}),
        },
      });
      if (res.status === 401) setUnauthorized(true);
      return res.ok;
    },
    [adminKey],
  );

  async function toggleBridge(enabled: boolean) {
    setBusy("toggle");
    await authed("/api/admin/toggle", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    await load();
    setBusy(null);
  }

  async function saveChatId(value: string) {
    setBusy("filter");
    await authed("/api/admin/config", {
      method: "POST",
      body: JSON.stringify({ maxChatId: value }),
    });
    setChatIdTouched(false);
    await load();
    setBusy(null);
  }

  async function runTest() {
    setBusy("test");
    setTestResult(null);
    const res = await fetch("/api/admin/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({
        senderName: testName,
        senderUsername: testNick,
        text: testText,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      setTestResult(`Отправлено подписчикам: ${json.delivered}`);
    } else if (res.status === 401) {
      setUnauthorized(true);
      setTestResult("Нужен ключ администратора");
    } else {
      setTestResult("Ошибка отправки");
    }
    await load();
    setBusy(null);
  }

  async function removeSub(id: number) {
    setBusy(`sub-${id}`);
    await authed(`/api/admin/subscribers?id=${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  function saveKey() {
    window.localStorage.setItem("bridge_admin_key", keyDraft.trim());
    setAdminKey(keyDraft.trim());
    setUnauthorized(false);
  }

  const cfgMissing =
    data && (!data.configured.telegram || !data.configured.max);

  const chatIdValue = chatIdTouched
    ? chatIdDraft
    : (data?.bridge.maxChatId ?? "");

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Пульт моста
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Состояние обновляется автоматически каждые 3 секунды
          </p>
        </div>
        <div className="g-card-soft flex items-center gap-3 px-4 py-2.5">
          <StatusDot alive={Boolean(data?.bridge.workerAlive)} />
          <div className="text-xs">
            <p className="font-medium text-zinc-200">
              {data?.bridge.workerAlive ? "Воркер активен" : "Воркер не отвечает"}
            </p>
            <p className="text-zinc-500">
              {data?.bridge.heartbeat
                ? `пульс: ${fmtTime(data.bridge.heartbeat)}`
                : "ожидание запуска"}
            </p>
          </div>
          <Radio
            size={16}
            className={data?.bridge.workerAlive ? "text-emerald-300" : "text-zinc-600"}
          />
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle size={16} />
          Панель не может получить статус сервера. Проверьте, что приложение запущено и база данных доступна.
        </div>
      )}

      {cfgMissing && (
        <div className="rounded-xl border border-violet-400/25 bg-violet-400/[0.08] px-4 py-4 text-sm">
          <p className="font-medium text-violet-200">
            Мост ещё не настроен
          </p>
          <p className="mt-1 text-violet-200/70">
            Задайте переменные окружения{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-violet-100">TELEGRAM_BOT_TOKEN</code>{" "}
            и{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[12px] text-violet-100">MAX_BOT_TOKEN</code>
            {!data?.configured.telegram && !data?.configured.max
              ? " — сейчас не заданы оба токена."
              : !data?.configured.telegram
                ? " — не задан токен Telegram."
                : " — не задан токен MAX."}{" "}
            Инструкция — ниже, в разделе «Запуск».
          </p>
        </div>
      )}

      {/* status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          icon={<Send size={18} className="text-sky-300" />}
          label="Telegram-бот"
          ok={data?.configured.telegram && !!data?.bots.telegram}
          title={
            data?.bots.telegram?.username
              ? `@${data.bots.telegram.username}`
              : "не подключён"
          }
          sub={data?.bots.telegram?.name ?? data?.bots.telegramError ?? "ожидание токена"}
          glow="tg"
        />
        <StatusCard
          icon={<Bot size={18} className="text-violet-300" />}
          label="Бот-приёмник MAX"
          ok={data?.configured.max && !!data?.bots.max}
          title={
            data?.bots.max?.username
              ? `@${data.bots.max.username}`
              : "не подключён"
          }
          sub={data?.bots.max?.name ?? data?.bots.maxError ?? "ожидание токена"}
          glow="max"
        />
        <StatusCard
          icon={<Users size={18} className="text-fuchsia-300" />}
          label="Подписчики в Telegram"
          ok
          title={String(data?.stats.activeSubscribers ?? 0)}
          sub={`всего: ${data?.stats.totalSubscribers ?? 0}`}
        />
        <StatusCard
          icon={<MessagesSquare size={18} className="text-emerald-300" />}
          label="Событий в ленте"
          ok
          title={String(data?.stats.eventsTotal ?? 0)}
          sub="сообщений и событий"
        />
      </div>

      {/* controls */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="g-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
              <Cpu size={16} />
            </span>
            <h3 className="font-display text-base font-semibold text-white">
              Управление пересылкой
            </h3>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Пересылка включена
              </p>
              <p className="text-xs text-zinc-500">
                Сообщения из MAX летят подписчикам в Telegram
              </p>
            </div>
            <button
              onClick={() => toggleBridge(!(data?.bridge.enabled ?? true))}
              disabled={busy === "toggle" || !data}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                data?.bridge.enabled ? "bg-emerald-500/80" : "bg-zinc-700"
              }`}
              aria-label="Переключить мост"
            >
              <span
                className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${
                  data?.bridge.enabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              <Filter size={12} /> Группа MAX (chat_id)
            </div>
            <div className="flex gap-2">
              <input
                value={chatIdValue}
                onChange={(e) => {
                  setChatIdDraft(e.target.value);
                  setChatIdTouched(true);
                }}
                placeholder="пусто — все группы"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
              />
              <button
                onClick={() => saveChatId(chatIdValue)}
                disabled={busy === "filter"}
                className="rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
              >
                {busy === "filter" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Сохранить"
                )}
              </button>
            </div>
            {(data?.bridge.knownChats.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data!.bridge.knownChats.map((c) => (
                  <button
                    key={c.chatId}
                    onClick={() => {
                      setChatIdDraft(c.chatId);
                      setChatIdTouched(true);
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-violet-400/40 hover:text-white"
                    title={`chat_id: ${c.chatId}`}
                  >
                    {c.title} · <span className="font-mono text-[11px] text-zinc-500">{c.chatId}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              Бот запоминает группы, в которые его добавили, — они появятся выше.
              Нажмите на группу, чтобы пересылать сообщения только из неё.
            </p>
          </div>
        </div>

        <div className="g-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
              <FlaskConical size={16} />
            </span>
            <h3 className="font-display text-base font-semibold text-white">
              Тестовая пересылка
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Имя (как в MAX)"
              className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            />
            <input
              value={testNick}
              onChange={(e) => setTestNick(e.target.value)}
              placeholder="Ник в MAX"
              className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            />
          </div>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
            placeholder="Текст сообщения"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-emerald-300/90">{testResult}</p>
            <button
              onClick={runTest}
              disabled={busy === "test"}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
            >
              {busy === "test" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              Отправить в Telegram
            </button>
          </div>
        </div>
      </div>

      {/* feed + subscribers */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="g-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
                <ArrowDownLeft size={16} />
              </span>
              <h3 className="font-display text-base font-semibold text-white">
                Лента из MAX
              </h3>
            </div>
            <span className="text-xs text-zinc-500">
              {data?.events.length ?? 0} последних
            </span>
          </div>

          <div className="scrollbar-thin max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {!data || data.events.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-14 text-center">
                <MessagesSquare size={22} className="text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-500">
                  Пока пусто. Сообщения из группы MAX появятся здесь сразу, как только их кто-то напишет.
                </p>
              </div>
            ) : (
              data.events.map((e) =>
                e.kind === "system" ? (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
                  >
                    <Info size={14} className="shrink-0 text-zinc-500" />
                    <p className="min-w-0 flex-1 truncate text-[13px] text-zinc-400">
                      {e.text}
                    </p>
                    <span className="shrink-0 text-[11px] text-zinc-600">
                      {fmtTime(e.createdAt)}
                    </span>
                  </div>
                ) : (
                  <div
                    key={e.id}
                    className="rounded-2xl rounded-tl-md border border-white/8 bg-gradient-to-br from-violet-500/[0.08] to-sky-500/[0.05] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13px] font-semibold text-white">
                        {e.senderName}
                      </span>
                      {e.senderUsername && (
                        <span className="font-mono text-[11px] text-violet-300">
                          @{e.senderUsername}
                        </span>
                      )}
                      {e.maxChatTitle && (
                        <span className="text-[11px] text-zinc-500">
                          · {e.maxChatTitle}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        <StatusBadge event={e} />
                        <span className="text-[11px] text-zinc-600">
                          {fmtTime(e.createdAt)}
                        </span>
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                      {e.text}
                    </p>
                  </div>
                ),
              )
            )}
          </div>
        </div>

        <div className="g-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
              <Users size={16} />
            </span>
            <h3 className="font-display text-base font-semibold text-white">
              Подписчики
            </h3>
          </div>
          <div className="scrollbar-thin max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {!data || data.subscribers.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-12 text-center">
                <Users size={20} className="text-zinc-600" />
                <p className="mt-3 px-4 text-[13px] leading-relaxed text-zinc-500">
                  Никто пока не подписан. Откройте вашего Telegram-бота и отправьте{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-[12px] text-violet-300">/start</code>
                </p>
              </div>
            ) : (
              data.subscribers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3"
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                      s.active
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-zinc-700/40 text-zinc-500"
                    }`}
                  >
                    {(s.firstName ?? s.username ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-200">
                      {s.firstName ?? "Без имени"}
                      {s.username && (
                        <span className="ml-1.5 font-mono text-[11px] text-sky-300">
                          @{s.username}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {s.chatId} · {s.active ? "активен" : "отписан"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSub(s.id)}
                    disabled={busy === `sub-${s.id}`}
                    className="text-zinc-600 transition-colors hover:text-rose-400 disabled:opacity-40"
                    aria-label="Удалить подписчика"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          {data?.adminRequired && (
            <div className="mt-4 border-t border-white/8 pt-4">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                <KeyRound size={12} /> Ключ администратора
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="ADMIN_SECRET"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2 font-mono text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                />
                <button
                  onClick={saveKey}
                  className="rounded-xl bg-white/10 px-3.5 text-[13px] font-medium text-zinc-100 transition-colors hover:bg-white/15"
                >
                  ОК
                </button>
              </div>
              {unauthorized && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-rose-300">
                  <AlertTriangle size={12} /> Ключ не подошёл — проверьте ADMIN_SECRET на Railway
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-600">
        <CheckCheck size={13} className="text-emerald-500" />
        Доставленные сообщения хранятся в PostgreSQL на Railway и доступны только вам в этой панели.
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  title,
  sub,
  ok,
  glow,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  sub: string;
  ok?: boolean;
  glow?: "max" | "tg";
}) {
  return (
    <div
      className={`g-card p-4 ${glow === "max" && ok ? "shadow-glow-max" : ""} ${
        glow === "tg" && ok ? "shadow-glow-tg" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-white/5">
          {icon}
        </span>
        <StatusDot alive={Boolean(ok)} />
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-semibold text-white">
        {title}
      </p>
      <p className="truncate text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
