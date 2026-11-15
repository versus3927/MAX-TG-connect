import { adminAllowed } from "@/lib/guard";
import { removeSubscriber } from "@/lib/bridge/store";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return Response.json({ ok: false, error: "bad_id" }, { status: 400 });
  }
  await removeSubscriber(id);
  return Response.json({ ok: true });
}
