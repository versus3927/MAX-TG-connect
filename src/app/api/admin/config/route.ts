import { adminAllowed } from "@/lib/guard";
import { setSetting } from "@/lib/bridge/store";

export const dynamic = "force-dynamic";

/** Установка/сброс фильтра по группе MAX (chat_id). Пустая строка = все группы. */
export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { maxChatId?: string };
  const value = (body.maxChatId ?? "").trim();
  await setSetting("max_chat_id", value);
  return Response.json({ ok: true, maxChatId: value || null });
}
