import { db } from "@/db";
import { bridgeEvents, settings, subscribers } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

/* ------------------------------ settings ------------------------------ */

export async function getSetting(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getJsonSetting<T>(key: string): Promise<T | null> {
  const raw = await getSetting(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJsonSetting(key: string, value: unknown) {
  await setSetting(key, JSON.stringify(value));
}

/* ---------------------------- subscribers ----------------------------- */

export type Subscriber = typeof subscribers.$inferSelect;

export async function upsertSubscriber(
  chatId: string,
  username: string | null,
  firstName: string | null,
): Promise<void> {
  await db
    .insert(subscribers)
    .values({ chatId, username, firstName, active: true })
    .onConflictDoUpdate({
      target: subscribers.chatId,
      set: { active: true, username, firstName },
    });
}

export async function setSubscriberActive(
  chatId: string,
  active: boolean,
): Promise<void> {
  await db
    .update(subscribers)
    .set({ active })
    .where(eq(subscribers.chatId, chatId));
}

export async function listActiveSubscribers(): Promise<Subscriber[]> {
  return db.select().from(subscribers).where(eq(subscribers.active, true));
}

export async function listAllSubscribers(): Promise<Subscriber[]> {
  return db.select().from(subscribers).orderBy(desc(subscribers.createdAt));
}

export async function countActiveSubscribers(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(eq(subscribers.active, true));
  return rows[0]?.count ?? 0;
}

export async function removeSubscriber(id: number): Promise<void> {
  await db.delete(subscribers).where(eq(subscribers.id, id));
}

/* ------------------------------- events ------------------------------- */

export type BridgeEvent = typeof bridgeEvents.$inferSelect;
export type NewBridgeEvent = typeof bridgeEvents.$inferInsert;

/** Вставляет событие. Возвращает null, если это дубликат (по maxMid). */
export async function insertEvent(
  ev: NewBridgeEvent,
): Promise<BridgeEvent | null> {
  const rows = await db
    .insert(bridgeEvents)
    .values(ev)
    .onConflictDoNothing({ target: bridgeEvents.maxMid })
    .returning();
  return rows[0] ?? null;
}

export async function updateEvent(
  id: number,
  patch: Partial<NewBridgeEvent>,
): Promise<void> {
  await db.update(bridgeEvents).set(patch).where(eq(bridgeEvents.id, id));
}

export async function listRecentEvents(limit = 40): Promise<BridgeEvent[]> {
  return db
    .select()
    .from(bridgeEvents)
    .orderBy(desc(bridgeEvents.id))
    .limit(limit);
}

export async function countEvents(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bridgeEvents);
  return rows[0]?.count ?? 0;
}

/* ---------------------------- known chats ----------------------------- */

export type KnownChat = { chatId: string; title: string; seenAt: string };

export async function rememberKnownChat(
  chatId: string,
  title: string,
): Promise<void> {
  const chats = (await getJsonSetting<KnownChat[]>("max_known_chats")) ?? [];
  const idx = chats.findIndex((c) => c.chatId === chatId);
  const entry: KnownChat = { chatId, title, seenAt: new Date().toISOString() };
  if (idx >= 0) chats[idx] = entry;
  else chats.unshift(entry);
  await setJsonSetting("max_known_chats", chats.slice(0, 20));
}

export async function knownChatTitle(
  chatId: string,
): Promise<string | null> {
  const chats = (await getJsonSetting<KnownChat[]>("max_known_chats")) ?? [];
  return chats.find((c) => c.chatId === chatId)?.title ?? null;
}
