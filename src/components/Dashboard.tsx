"use client";

import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  CheckCheck,
  Cpu,
  ExternalLink,
  Filter,
  FlaskConical,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  MessagesSquare,
  Radio,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CopyField } from "@/components/CopyField";

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
    knownChats: { chatId: string; title: string; seenAt: string; type?: string }[];
    workerAlive: boolean;
    heartbeat: string | null;
    maxLastSync: string | null;
  };
  bots: {
    telegram: BotInfo | null;
    telegramError: string | null;
  };
  maxAccount: {
    connected: boolean;
    status: string;
    error: string | null;
    hasTokenInEnv: boolean;
    info: { ownUserId?: number | null; chatsCount?: number; at?: string } | null;
    lastSync: string | null;
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

function accountStatusLabel(s: string): string {
  switch (s) {
    case "connected":
      return "в сети";
    case "connecting":
      return "подключение…";
    case "awaiting-code":
      return "ждёт код из SMS";
    case "error":
      return "ошибка";
    default:
      return "не подключён";
  }
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
  };
  const s = map[event.status] ?? map.error;
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

  // connect account (SMS)
  const [phone, setPhone] = useState("+7");
  const [codeSent, setCodeSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectErr, setConnectErr] = useState<string | null>(null);
  const [captchaLink, setCaptchaLink] = useState<string | null>(null);
  const [captchaTokenDraft, setCaptchaTokenDraft] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  const [testName, setTestName] = useState("Максим");
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

  const postJson = useCallback(
    async (
      path: string,
      body: unknown,
    ): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body ?? {}),
      });
      if (res.status === 401) setUnauthorized(true);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok && data.ok === true, status: res.status, data };
    },
    [adminKey],
  );

  async function toggleBridge(enabled: boolean) {
    setBusy("toggle");
    await postJson("/api/admin/toggle", { enabled });
    await load();
    setBusy(null);
  }

  async function saveChatId(value: string) {
    setBusy("filter");
    await postJson("/api/admin/config", { maxChatId: value });
    setChatIdTouched(false);
    await load();
    setBusy(null);
  }

  async function requestCode(e?: React.FormEvent, captchaToken?: string) {
    e?.preventDefault();
    setBusy("sms");
    setConnectErr(null);
    setConnectMsg(null);
    const r = await postJson("/api/admin/max/connect", {
      phone,
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (r.ok) {
      setCodeSent(true);
      setCaptchaLink(null);
      setConnectMsg("Код отправлен (SMS или сообщение в MAX). Введите его ниже.");
    } else if (r.status === 428 || r.data.reason === "captcha") {
      setCaptchaLink(
        typeof r.data.captchaLink === "string" ? r.data.captchaLink : null,
      );
      setConnectErr(String(r.data.error ?? "MAX просит капчу"));
    } else if (r.status !== 401) {
      setConnectErr(String(r.data.error ?? "Не удалось отправить код"));
    }
    await load();
    setBusy(null);
  }

  async function submitCaptcha() {
    let token = captchaTokenDraft.trim();
    if (!token) return;
    // принимаем как голый токен, так и весь URL редиректа с token=...
    try {
      if (token.startsWith("http")) {
        const u = new URL(token);
        token = u.searchParams.get("token") ?? token;
      }
    } catch {
      /* оставляем как есть */
    }
    await requestCode(undefined, token);
    setCaptchaTokenDraft("");
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy("verify");
    setConnectErr(null);
    const r = await postJson("/api/admin/max/verify", { code: smsCode });
    if (r.ok) {
      setConnectMsg("Аккаунт подключается… статус обновится через несколько секунд.");
      setCodeSent(false);
      setSmsCode("");
      setIssuedToken(
        typeof r.data.accessToken === "string" ? r.data.accessToken : null,
      );
    } else if (r.status !== 401) {
      setConnectErr(String(r.data.error ?? "Неверный код или сессия истекла"));
    }
    await load();
    setBusy(null);
  }

  async function disconnectMax() {
    setBusy("disconnect");
    await postJson("/api/admin/max/disconnect", {});
    setCodeSent(false);
    await load();
    setBusy(null);
  }

  async function runTest() {
    setBusy("test");
    setTestResult(null);
    const r = await postJson("/api/admin/test", {
      senderName: testName,
      text: testText,
    });
    if (r.ok) setTestResult(`Отправлено подписчикам: ${r.data.delivered}`);
    else if (r.status === 401) setTestResult("Нужен ключ администратора");
    else setTestResult(String(r.data.error ?? "Ошибка отправки"));
    await load();
    setBusy(null);
  }

  async function removeSub(id: number) {
    setBusy(`sub-${id}`);
    const res = await fetch(`/api/admin/subscribers?id=${id}`, {
      method: "DELETE",
      headers: { "x-admin-key": adminKey },
    });
    if (res.status === 401) setUnauthorized(true);
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
          <p className="font-medium text-violet-200">Мост ещё не настроен</p>
          <p className="mt-1 text-violet-200/70">
            {!data?.configured.telegram
              ? "Задайте на Railway переменную TELEGRAM_BOT_TOKEN (токен бота от @BotFather). "
              : ""}
            {!data?.configured.max
              ? "Подключите аккаунт MAX в карточке ниже — по номеру телефона и коду из SMS."
              : ""}{" "}
            Подробности — в разделе «Запуск» внизу страницы.
          </p>
        </div>
      )}

      {/* status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          icon={<Send size={18} className="text-sky-300" />}
          label="Telegram-бот (рассылка)"
          ok={data?.configured.telegram && !!data?.bots.telegram}
          title={
            data?.bots.telegram?.username
              ? `@${data.bots.telegram.username}`
              : "не подключён"
          }
          sub={data?.bots.telegram?.name ?? data?.bots.telegramError ?? "токен @BotFather в TELEGRAM_BOT_TOKEN"}
          glow="tg"
        />
        <StatusCard
          icon={<UserRound size={18} className="text-violet-300" />}
          label="Аккаунт MAX (чтение группы)"
          ok={Boolean(data?.maxAccount.connected)}
          title={
            data?.maxAccount.connected
              ? accountStatusLabel("connected")
              : accountStatusLabel(data?.maxAccount.status ?? "disconnected")
          }
          sub={
            data?.maxAccount.connected
              ? `${data.maxAccount.info?.chatsCount ?? 0} чатов · ${
                  data.maxAccount.lastSync
                    ? `синк ${fmtTime(data.maxAccount.lastSync)}`
                    : "синхронизация"
                }`
              : (data?.maxAccount.error ?? "войдите по номеру телефона ниже")
          }
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

      {/* connect account + relay settings */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="g-card p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
              <UserRound size={16} />
            </span>
            <h3 className="font-display text-base font-semibold text-white">
              Подключение аккаунта MAX
            </h3>
          </div>

          {data?.maxAccount.connected ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3.5">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                  <StatusDot alive /> Аккаунт в сети
                </p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  Мост читает{" "}
                  {data.bridge.maxChatId
                    ? "выбранную группу"
                    : `${data.maxAccount.info?.chatsCount ?? "…"} чатов`}{" "}
                  от лица вашего аккаунта и пересылает сообщения подписчикам.
                </p>
              </div>

              {issuedToken && (
                <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                    <KeyRound size={13} /> Токен сессии MAX — показывается один раз
                  </p>
                  <CopyField
                    label="Сохраните на Railway как MAX_ACCOUNT_TOKEN"
                    value={issuedToken}
                  />
                  <p className="text-[11px] leading-relaxed text-amber-200/70">
                    Задайте его в Railway → Variables, и вход после рестартов станет
                    автоматическим — SMS больше не понадобится. Сейчас токен живёт
                    только в памяти сервера и потеряется при перезапуске. Не показывайте
                    его никому: это полный доступ к вашему аккаунту MAX.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] leading-snug text-zinc-600">
                  Сессия живёт, пока запущен сервер. После рестарта Railway —
                  подключите снова (или задайте MAX_ACCOUNT_TOKEN для автовхода).
                </p>
                <button
                  onClick={disconnectMax}
                  disabled={busy === "disconnect"}
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-rose-400/40 hover:text-rose-300"
                >
                  {busy === "disconnect" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <LogOut size={14} />
                  )}
                  Отключить
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={codeSent ? verifyCode : requestCode} className="space-y-3">
              <p className="text-[13px] leading-relaxed text-zinc-400">
                Войдите в свой аккаунт по номеру телефона: придёт SMS (или сообщение
                в MAX) с кодом. Токен хранится только в памяти сервера — в базу не пишется.
              </p>
              {!codeSent ? (
                <div className="flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+79XXXXXXXXX"
                    inputMode="tel"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                  />
                  <button
                    type="submit"
                    disabled={busy === "sms"}
                    className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
                  >
                    {busy === "sms" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ArrowRight size={15} />
                    )}
                    Получить код
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="Код из SMS"
                      inputMode="numeric"
                      autoFocus
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                    />
                    <button
                      type="submit"
                      disabled={busy === "verify"}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
                    >
                      {busy === "verify" ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <CheckCheck size={15} />
                      )}
                      Войти
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      setCodeSent(false);
                      requestCode(e as unknown as React.FormEvent);
                    }}
                    className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                  >
                    Отправить код ещё раз на {phone}
                  </button>
                </div>
              )}
              {connectMsg && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCheck size={13} /> {connectMsg}
                </p>
              )}

              {(captchaLink || connectErr?.includes("капч")) && (
                <div className="space-y-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3.5 py-3">
                  <p className="text-xs font-medium text-sky-200">
                    MAX просит пройти VK-капчу (для IP сервера Railway это норма)
                  </p>
                  {captchaLink && (
                    <a
                      href={captchaLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-400"
                    >
                      <ExternalLink size={13} /> Открыть капчу в новой вкладке
                    </a>
                  )}
                  <p className="text-[11px] leading-relaxed text-sky-200/70">
                    После прохождения страница капчи перенаправит на адрес вида{" "}
                    <code className="rounded bg-black/40 px-1 font-mono">
                      …&token=&lt;токен&gt;…
                    </code>{" "}
                    — скопируйте значение token (или весь адрес) и вставьте ниже.
                    Либо просто войдите один раз в web.max.ru с этого телефона и
                    нажмите «Получить код» ещё раз.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={captchaTokenDraft}
                      onChange={(e) => setCaptchaTokenDraft(e.target.value)}
                      placeholder="Токен капчи или весь URL"
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-400/50"
                    />
                    <button
                      type="button"
                      onClick={submitCaptcha}
                      disabled={busy === "sms" || !captchaTokenDraft.trim()}
                      className="shrink-0 rounded-xl bg-sky-500 px-3.5 text-xs font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                    >
                      {busy === "sms" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        "Повторить"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {connectErr && !connectErr.includes("капч") && (
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-rose-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {connectErr}
                </p>
              )}
              {data?.maxAccount.error && !connectErr && (
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-300/90">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  {data.maxAccount.error}
                </p>
              )}
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-amber-200/80">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-300" />
                <span>
                  Это вход в ваш личный аккаунт через приватный протокол MAX
                  (юзербот). Для продакшна удобно один раз получить токен (панель
                  покажет его после SMS-входа) и задать его как MAX_ACCOUNT_TOKEN
                  на Railway — тогда вход после рестартов автоматический.
                </span>
              </div>

              <details className="group rounded-xl border border-white/8 bg-white/[0.02]">
                <summary className="cursor-pointer px-3.5 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:text-white">
                  Альтернатива: как взять токен из браузера вручную ↓
                </summary>
                <div className="space-y-1.5 border-t border-white/8 px-3.5 py-3 text-[11px] leading-relaxed text-zinc-500">
                  <p><span className="font-semibold text-zinc-300">1.</span> Откройте <code className="rounded bg-black/40 px-1 font-mono text-violet-300">web.max.ru</code> и войдите в свой аккаунт</p>
                  <p><span className="font-semibold text-zinc-300">2.</span> Нажмите <code className="rounded bg-black/40 px-1 font-mono text-zinc-300">F12</code> → вкладка <code className="rounded bg-black/40 px-1 font-mono text-zinc-300">Network</code></p>
                  <p><span className="font-semibold text-zinc-300">3.</span> В фильтре выберите <code className="rounded bg-black/40 px-1 font-mono text-zinc-300">WS</code> (WebSocket)</p>
                  <p><span className="font-semibold text-zinc-300">4.</span> Перезагрузите страницу (F5) и кликните на соединение <code className="rounded bg-black/40 px-1 font-mono text-zinc-300">wss://…oneme.ru/websocket</code></p>
                  <p className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-2.5 py-1.5 text-rose-200/90">
                    <span className="font-bold">⚠ Важно:</span> откройте вкладку <span className="font-bold text-white">Messages</span> — <span className="underline">НЕ Headers</span>! На скриншоте заголовков (Accept-Encoding, Origin…) токена нет — это не то место.
                  </p>
                  <p><span className="font-semibold text-zinc-300">5.</span> В Messages найдите сообщение с <code className="rounded bg-black/40 px-1 font-mono text-zinc-300">{'"opcode": 19'}</code> (LOGIN)</p>
                  <p><span className="font-semibold text-zinc-300">6.</span> Внутри payload скопируйте значение поля <code className="rounded bg-black/40 px-1 font-mono text-emerald-300">token</code> — это длинная строка, и есть ваш <code className="rounded bg-black/40 px-1 font-mono text-violet-300">MAX_ACCOUNT_TOKEN</code></p>
                  <p className="mt-1 text-zinc-600">Затем вставьте его на Railway → сервис MAX-TG-connect → Variables → MAX_ACCOUNT_TOKEN</p>
                </div>
              </details>
            </form>
          )}
        </div>

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
              <p className="text-sm font-medium text-zinc-100">Пересылка включена</p>
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
                placeholder="пусто — все группы и каналы"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
              />
              <button
                onClick={() => saveChatId(chatIdValue)}
                disabled={busy === "filter"}
                className="rounded-xl bg-violet-500 px-4 text-sm font-medium text-white transition-colors hover:bg-violet-400 disabled:opacity-50"
              >
                {busy === "filter" ? <Loader2 size={16} className="animate-spin" /> : "Сохранить"}
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
                    title={`chat_id: ${c.chatId}${c.type ? ` · ${c.type}` : ""}`}
                  >
                    {c.title}{" "}
                    <span className="font-mono text-[11px] text-zinc-500">
                      {c.chatId}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              После подключения аккаунта здесь появятся ваши группы и каналы MAX —
              нажмите на нужную, чтобы пересылать сообщения только из неё.
            </p>
          </div>

          <div className="mt-5 border-t border-white/8 pt-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-white/5 text-zinc-400">
                <FlaskConical size={14} />
              </span>
              <h4 className="text-sm font-semibold text-zinc-200">
                Тестовая пересылка
              </h4>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-2">
              <input
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Имя отправителя"
                className="rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
              />
              <div className="flex gap-2">
                <input
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Текст сообщения"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400/50"
                />
                <button
                  onClick={runTest}
                  disabled={busy === "test"}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                >
                  {busy === "test" ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>
            </div>
            {testResult && (
              <p className="mt-2 text-xs text-emerald-300/90">{testResult}</p>
            )}
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
          <div className="scrollbar-thin max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {!data || data.subscribers.length === 0 ? (
              <div className="grid place-items-center rounded-xl border border-dashed border-white/10 py-12 text-center">
                <Users size={20} className="text-zinc-600" />
                <p className="mt-3 px-4 text-[13px] leading-relaxed text-zinc-500">
                  Никто пока не подписан. Откройте вашего Telegram-бота и отправьте{" "}
                  <code className="rounded bg-black/40 px-1 font-mono text-[12px] text-violet-300">
                    /start
                  </code>
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
        Доставленные сообщения хранятся в PostgreSQL на Railway; токен аккаунта MAX — только в памяти сервера.
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
