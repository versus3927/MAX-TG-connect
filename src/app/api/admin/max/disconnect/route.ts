import { adminAllowed } from "@/lib/guard";
import { setMaxAccountToken } from "@/lib/bridge/store";
import { getAuthSession, setAuthSession } from "@/lib/max-auth-session";
import { setJsonSetting, setSetting } from "@/lib/bridge/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  setMaxAccountToken(null);
  getAuthSession()?.client?.close();
  setAuthSession(null);
  await setSetting("max_account_status", "disconnected");
  await setSetting("max_account_error", "");
  await setJsonSetting("max_account_info", null);
  return Response.json({ ok: true });
}
