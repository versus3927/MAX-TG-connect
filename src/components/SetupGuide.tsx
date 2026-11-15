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
    body: "Бот для MAX не нужен — мост работает от вашего аккаунта. После деплоя откройте веб-панель, введите номер телефона и код из SMS. Ваш аккаунт должен состоять в группе, которую вы пересылаете.",
    keys: [
      { label: "Способ по умолчанию", value: "Вход по номеру телефона прямо в веб-панели" },
      { label: "Альтернатива (автовход после рестарта)", value: "MAX_ACCOUNT_TOKEN=токен сессии аккаунта" },
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

      <div className="g-card-soft flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-[12px] text-zinc-500">
        <span className="flex items-center gap-2">
          <Variable size={14} className="text-zinc-400" />
          Переменные окружения:
        </span>
        {["TELEGRAM_BOT_TOKEN", "DATABASE_URL", "MAX_CHAT_ID", "ADMIN_SECRET", "MAX_ACCOUNT_TOKEN", "MAX_DEVICE_ID", "MAX_WS_URL"].map(
          (v) => (
            <code key={v} className="font-mono text-zinc-300">
              {v}
            </code>
          ),
        )}
        <span className="flex items-center gap-2">
          <KeyRound size={13} className="text-zinc-400" />
          Токен аккаунта MAX хранится только в памяти сервера, не в базе.
        </span>
      </div>
    </div>
  );
}
