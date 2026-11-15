import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Telegram-подписчики: пользователи, которые написали боту /start
 * и получают копии сообщений из группы MAX.
 */
export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Журнал событий моста: каждое сообщение, перехваченное в группе MAX,
 * и служебные события (бот добавлен в чат, ошибки и т.д.).
 */
export const bridgeEvents = pgTable("bridge_events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("message"), // message | system
  maxChatId: text("max_chat_id"),
  maxChatTitle: text("max_chat_title"),
  senderName: text("sender_name"),
  senderUsername: text("sender_username"),
  text: text("text"),
  maxMid: text("max_mid").unique(),
  delivered: integer("delivered").notNull().default(0),
  status: text("status").notNull().default("ok"), // ok | duplicate | no-subscribers | disabled | error
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Настройки рантайма: enable-флаг, фильтр чата, маркер long-polling, heartbeat. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});
