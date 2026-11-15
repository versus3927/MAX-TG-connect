import { adminAllowed } from "@/lib/guard";
import { setSetting } from "@/lib/bridge/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  const enabled = Boolean(body.enabled);
  await setSetting("bridge_enabled", String(enabled));
  return Response.json({ ok: true, enabled });
}
