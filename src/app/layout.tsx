import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const body = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MAX Bridge — сообщения из MAX в ваш Telegram",
  description:
    "Мост для тех, у кого нет MAX: сообщения выбранной группы MAX автоматически приходят в Telegram-бота — с именем и ником отправителя. Хостинг на Railway.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="scroll-smooth">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} bg-[#050508] text-zinc-100 antialiased selection:bg-violet-500/30`}
      >
        {children}
      </body>
    </html>
  );
}
