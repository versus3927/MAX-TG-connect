"use client";

import {
  Bot,
  KeyRound,
  Smartphone,
  TrainFront,
  UserPlus,
  Variable,
} from "lucide-react";
import { CopyField } from "@/components/CopyField";

const steps = [
  {
    icon: Bot,
    accent: "text-sky-300",
    chip: "Шаг 1",
    title: "Создайте Telegram-бота",
    body: "Откройте @BotFather в Telegram, отправьте /newbot, придумайте имя и получите токен. Именно этот бот будет присылать сообщения людям без MAX.",
    keys: [{ label: "Переменная на Railway", value: "TELEGRAM_BOT_TOKEN=1234567890:AA...(токен от @BotFather)" }],
  },
  {
    icon: Smartphone,
    accent: "text-violet-300",
    chip: "Шаг 2",
    title: "Подключите свой аккаунт MAX",
    body: "Бот для MAX не нужен — мост работает от вашего аккаунта. Ваш аккаунт должен состоять в группе, которую вы пересылаете. Есть два способа подключить:",
    keys: [
      {
        label: "Способ 1 — SMS через панель этого приложения",
        value: "Откройте домен Railway → введите номер → код из SMS → панель покажет токен",
      },
      {
        label: "Способ 2 — взять токен из браузера вручную",
        value: "web.max.ru → F12 → Network → WS → Messages (не Headers!) → opcode:19 → payload.token",
      },
      {
        label: "Затем (чтобы вход пережил рестарт Railway)",
        value: "MAX_ACCOUNT_TOKEN=скопированный_токен → Railway → Variables",
      },
    ],
  },
  {
    icon: TrainFront,
    accent: "text-fuchsia-300",
    chip: "Шаг 3",
    title: "Задеплойте на Railway",
    body: "Railway → New Project → Deploy from GitHub. Добавьте сервис PostgreSQL и задайте переменные. Таблицы в БД создаются автоматически при старте (railway.toml уже в репозитории).",
    keys: [
      { label: "База данных", value: "DATABASE_URL=${{Postgres.DATABASE_URL}}" },
      { label: "Защита панели (настоятельно рекомендую)", value: "ADMIN_SECRET=любой-длинный-секрет" },
      { label: "Фильтр группы (опционально)", value: "MAX_CHAT_ID=chat_id конкретной группы" },
    ],
  },
  {
    icon: UserPlus,
    accent: "text-emerald-300",
    chip: "Шаг 4",
    title: "Напишите /start",
    body: "Каждый, кто хочет получать сообщения, открывает Telegram-бота и отправляет /start. Всё — новые сообщения группы MAX приходят ему в личку с именем и ником отправителя. /stop отключает пересылку.",
    keys: [{ label: "Команды бота", value: "/start — подписаться · /stop — отписаться · /status — состояние" }],
  },
];

export function SetupGuide() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Запуск за четыре шага
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Мост — сервис на Railway с вашим аккаунтом MAX внутри: он читает группу
          и пересылает каждое сообщение всем подписчикам Telegram-бота.
          Вебхуки и публичный домен не нужны — работает long polling.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((s, i) => (
          <div key={s.title} className="g-card group relative overflow-hidden p-6">
            <span className="pointer-events-none absolute -right-4 -top-6 font-display text-[92px] font-bold leading-none text-white/[0.04] transition-colors duration-500 group-hover:text-white/[0.07]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                <s.icon size={18} className={s.accent} />
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                {s.chip}
              </span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-white">
              {s.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
              {s.body}
            </p>
            <div className="mt-4 space-y-2">
              {s.keys.map((k) => (
                <CopyField key={k.label} label={k.label} value={k.value} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="g-card p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-300">
            <Variable size={16} />
          </span>
          <h3 className="font-display text-base font-semibold text-white">
            Откуда взять каждую переменную
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {varSources.map((v) => (
            <div
              key={v.name}
              className="grid gap-1.5 py-3.5 sm:grid-cols-[220px_1fr] sm:gap-4"
            >
              <div className="flex items-center gap-2">
                <code
                  className={`font-mono text-[12px] ${v.required ? "text-violet-300" : "text-zinc-400"}`}
                >
                  {v.name}
                </code>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                    v.required
                      ? "bg-violet-400/15 text-violet-300"
                      : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {v.required ? "нужна" : "опц."}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-zinc-500">
                {v.source}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-[11px] text-zinc-600">
          <KeyRound size={13} className="text-emerald-500" />
          Все значения задаются в Railway → ваш сервис → Variables. В коде и в базе секреты не хранятся.
        </p>
      </div>
    </div>
  );
}

const varSources = [
  {
    name: "TELEGRAM_BOT_TOKEN",
    required: true,
    source:
      "Telegram → @BotFather → /newbot → придумайте имя и ник бота → он выдаст токен вида 123456:AA… (для существующего бота: /mybots → бот → API Token).",
  },
  {
    name: "DATABASE_URL",
    required: true,
    source:
      "Railway → Add → Database → PostgreSQL. Затем в сервисе приложения: Variables → New Variable → значение ${{Postgres.DATABASE_URL}} (Railway подставит строку подключения сам).",
  },
  {
    name: "ADMIN_SECRET",
    required: true,
    source:
      "Придумываете сами: любая длинная случайная строка (например, результат команды openssl rand -hex 24 или пароль из менеджера паролей). Это ключ от панели — без него посторонний сможет войти в ваш MAX.",
  },
  {
    name: "MAX_ACCOUNT_TOKEN",
    required: false,
    source:
      "Способ 1 (простой): после деплоя откройте веб-панель этого приложения (домен Railway), войдите по SMS — панель один раз покажет токен, скопируйте его в Variables. " +
      "Способ 2 (из браузера): откройте web.max.ru → F12 → Network → фильтр WS → кликните соединение wss://…oneme.ru → вкладка Messages (НЕ Headers!) → найдите сообщение с opcode: 19 (LOGIN) → скопируйте значение payload → token. Это длинная строка — именно она и есть токен.",
  },
  {
    name: "MAX_DEVICE_ID",
    required: false,
    source:
      "Любой UUID (генератор: uuidgenerator.net или crypto.randomUUID() в консоли браузера). Пусто — сервис сгенерирует сам.",
  },
  {
    name: "MAX_CHAT_ID",
    required: false,
    source:
      "Самый простой путь — панель: после подключения аккаунта в «Группа MAX» появятся ваши чаты с их chat_id — кликните нужную группу. Пусто — пересылаются все группы и каналы.",
  },
  {
    name: "MAX_WS_URL",
    required: false,
    source:
      "Не трогайте: по умолчанию уже стоит официальный wss://ws-api.oneme.ru/websocket. Менять нужно, только если MAX сменит эндпоинт.",
  },
];
