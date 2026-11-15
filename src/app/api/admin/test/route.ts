import { adminAllowed } from "@/lib/guard";
import { broadcastEvent } from "@/lib/bridge/bridge";

export const dynamic = "force-dynamic";

/**
 * Тестовая пересылка: создаёт событие в журнале и рассылает его
 * активным подписчикам — как будто сообщение пришло из MAX.
 */
export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    senderName?: string;
    senderUsername?: string;
    text?: string;
  };
  const senderName = (body.senderName ?? "").trim() || "Тест MAX";
  const senderUsername = (body.senderUsername ?? "").trim() || "max_test";
  const text = (body.text ?? "").trim() || "Тестовое сообщение из группы MAX";

  const result = await broadcastEvent({
    senderName,
    senderUsername: senderUsername.replace(/^@/, ""),
    text,
    maxChatId: null,
    maxChatTitle: "Тестовая группа",
    maxMid: `test-${Date.now()}`,
    force: true,
  });

  return Response.json({ ok: true, ...result });
}
