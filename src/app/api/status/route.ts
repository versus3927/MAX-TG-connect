import { getBridgeStatus } from "@/lib/bridge/status";
import { adminRequired } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getBridgeStatus();
    return Response.json({ ok: true, adminRequired: adminRequired(), ...status });
  } catch (err) {
    console.error("[api/status]", err);
    return Response.json(
      { ok: false, error: "status_unavailable" },
      { status: 500 },
    );
  }
}
