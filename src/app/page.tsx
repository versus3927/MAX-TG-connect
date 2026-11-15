import {
  ArrowRight,
  AtSign,
  Database,
  MessagesSquare,
  Radio,
  Send,
  Smartphone,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Reveal } from "@/components/Reveal";
import { SetupGuide } from "@/components/SetupGuide";

function NodeCard({
  icon,
  title,
  sub,
  glow,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  glow: "max" | "tg" | "core";
}) {
  const glowCls =
    glow === "max"
      ? "shadow-glow-max border-violet-400/30"
      : glow === "tg"
        ? "shadow-glow-tg border-sky-400/30"
        : "border-fuchsia-400/20";
  return (
    <div
      className={`relative z-10 flex w-44 shrink-0 flex-col items-center gap-2 rounded-2xl border bg-[#0b0b14]/90 px-4 py-5 text-center backdrop-blur ${glowCls}`}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-white/5">
        {icon}
      </span>
      <p className="font-display text-sm font-semibold text-white">{title}</p>
      <p className="text-[11px] leading-snug text-zinc-500">{sub}</p>
    </div>
  );
}

function FlowLine({ reverse = false }: { reverse?: boolean }) {
  return (
    <div className="relative mx-1 hidden h-px min-w-10 flex-1 bg-gradient-to-r from-violet-500/60 via-fuchsia-400/50 to-sky-400/60 sm:block">
      {[0, 0.9, 1.8].map((d) => (
        <span
          key={d}
          className={`absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full ${
            reverse ? "bg-sky-300" : "bg-violet-300"
          } animate-flow shadow-[0_0_10px_2px_rgba(216,180,254,0.6)]`}
          style={{ animationDelay: `${d}s`, animationDirection: reverse ? "reverse" : "normal" }}
        />
      ))}
    </div>
  );
}

function MobileFlow() {
  return (
    <div className="relative my-1 h-10 w-px bg-gradient-to-b from-violet-500/60 via-fuchsia-400/40 to-sky-400/60 sm:hidden">
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300 animate-pulse-soft" />
    </div>
  );
}

const features = [
  {
    icon: Smartphone,
    accent: "text-sky-300",
    title: "Без установки MAX",
    body: "Родственникам, коллегам и друзьям достаточно Telegram: бот сам пришлёт каждое сообщение группы.",
  },
  {
    icon: AtSign,
    accent: "text-violet-300",
    title: "Кто написал — видно сразу",
    body: "Каждое сообщение приходит с именем отправителя в MAX, а не безликой сводкой.",
  },
  {
    icon: Zap,
    accent: "text-fuchsia-300",
    title: "Мгновенно и автоматически",
    body: "Воркер слушает события MAX в реальном времени и держит резервный опрос истории — задержка меньше секунды.",
  },
  {
    icon: Database,
    accent: "text-emerald-300",
    title: "Всё под вашим контролем",
    body: "Лента хранится в вашей PostgreSQL на Railway. Токены — только в переменных окружения.",
  },
];

export default function Home() {
  return (
    <div className="noise relative min-h-screen overflow-hidden">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="dot-grid absolute inset-0" />
        <div className="animate-drift absolute -top-40 left-[8%] size-[34rem] rounded-full bg-violet-600/25 blur-[130px]" />
        <div className="animate-drift-2 absolute top-[30%] right-[-10%] size-[30rem] rounded-full bg-sky-500/20 blur-[130px]" />
        <div className="absolute bottom-[-20%] left-[30%] size-[26rem] rounded-full bg-fuchsia-600/15 blur-[120px]" />
      </div>

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-7">
        <a href="#" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 shadow-glow-max">
            <MessagesSquare size={17} className="text-white" />
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">
            MAX<span className="mx-1 text-zinc-500">→</span>TG Bridge
          </span>
        </a>
        <nav className="flex items-center gap-1 text-[13px]">
          <a
            href="#panel"
            className="rounded-full px-3.5 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Пульт
          </a>
          <a
            href="#setup"
            className="rounded-full px-3.5 py-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            Запуск
          </a>
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">
              <Radio size={12} className="text-fuchsia-300" />
              Мост сообщений MAX ⇄ Telegram
            </span>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="mt-6 font-display text-[clamp(2rem,5.6vw,3.9rem)] font-semibold leading-[1.06] tracking-tight text-white">
              Группа пишет в <span className="text-gradient">MAX</span> — вы читаете в{" "}
              <span className="text-sky-300">Telegram</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-zinc-400">
              Для всех, у кого нет MAX. Ваш аккаунт MAX читает выбранную группу,
              а мост мгновенно пересылает каждое сообщение в Telegram —
              с именем и ником отправителя. От пользователя нужна лишь команда{" "}
              <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-violet-300">
                /start
              </code>
              .
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#panel"
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-glow-max transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Открыть пульт
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              <a
                href="#setup"
                className="rounded-full border border-white/12 bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.07]"
              >
                Как поднять на Railway
              </a>
            </div>
          </Reveal>
        </div>

        {/* bridge visual */}
        <Reveal delay={0.3} className="mt-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center sm:flex-row sm:justify-center">
            <NodeCard
              icon={<Smartphone size={20} className="text-violet-300" />}
              title="Группа MAX"
              sub="ваш аккаунт читает каждое сообщение"
              glow="max"
            />
            <FlowLine />
            <MobileFlow />
            <NodeCard
              icon={<Radio size={20} className="text-fuchsia-300" />}
              title="Мост на Railway"
              sub="воркер + PostgreSQL, работает 24/7"
              glow="core"
            />
            <FlowLine reverse />
            <MobileFlow />
            <NodeCard
              icon={<Send size={20} className="text-sky-300" />}
              title="Ваш Telegram"
              sub="личные сообщения от бота, /start — и готово"
              glow="tg"
            />
          </div>
        </Reveal>
      </section>

      {/* marquee divider */}
      <div className="relative z-10 border-y border-white/5 bg-white/[0.015] py-3">
        <div className="flex overflow-hidden">
          <div className="animate-marquee flex shrink-0 items-center gap-10 pr-10">
            {Array.from({ length: 2 }).flatMap((_, k) =>
              [
                "сообщения без MAX",
                "имя и ник отправителя",
                "/start и готово",
                "аккаунт MAX вместо бота",
                "PostgreSQL на Railway",
                "пересылка меньше секунды",
              ].map((t) => (
                <span
                  key={`${k}-${t}`}
                  className="flex items-center gap-10 whitespace-nowrap text-[12px] font-medium uppercase tracking-[0.22em] text-zinc-600"
                >
                  {t}
                  <span className="size-1 rounded-full bg-gradient-to-r from-violet-400 to-sky-400" />
                </span>
              )),
            )}
          </div>
        </div>
      </div>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="g-card-soft h-full p-5 transition-colors hover:bg-white/[0.05]">
                <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <f.icon size={18} className={f.accent} />
                </span>
                <h3 className="mt-4 font-display text-[15px] font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* panel */}
      <section id="panel" className="relative z-10 mx-auto max-w-6xl scroll-mt-8 px-6 pb-20">
        <Reveal>
          <Dashboard />
        </Reveal>
      </section>

      {/* setup */}
      <section id="setup" className="relative z-10 mx-auto max-w-6xl scroll-mt-8 px-6 pb-24">
        <Reveal>
          <SetupGuide />
        </Reveal>
      </section>

      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-[12px] text-zinc-600">
          <p className="flex items-center gap-2">
            <MessagesSquare size={13} className="text-zinc-500" />
            MAX→TG Bridge — мост сообщений для тех, у кого нет MAX
          </p>
          <p className="font-mono text-[11px]">
            Next.js · Drizzle · PostgreSQL · Railway
          </p>
        </div>
      </footer>
    </div>
  );
}
