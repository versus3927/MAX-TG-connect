import { adminAllowed } from "@/lib/guard";
import { getAuthSession, saveMaxAccountToken, setAuthSession } from "@/lib/max-auth-session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Шаг 2: ввод SMS-кода → получаем токен аккаунта, держим в памяти воркера. */
export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const session = getAuthSession();
  if (!session || !session.client) {
    return Response.json(
      { ok: false, error: "Сначала запросите код (шаг 1)" },
      { status: 400 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim();
  if (!/^\d{4,8}$/.test(code)) {
    return Response.json(
      { ok: false, error: "Введите цифровой код из SMS" },
      { status: 400 },
    );
  }

  try {
    const { accessToken } = await session.client.submitSmsCode(
      session.verificationToken,
      code,
    );
    saveMaxAccountToken(accessToken); // только в памяти процесса
    session.client.close();
    setAuthSession(null);
    // воркер заметит токен из RAM и подключится сам (цикл maxLoop).
    // Токен возвращаем панели один раз — чтобы владелец мог сохранить его
    // как MAX_ACCOUNT_TOKEN на Railway и вход стал автоматическим.
    return Response.json({ ok: true, accessToken });
  } catch (err) {
    console.error("[api/max/verify]", err);
    return Response.json(
      { ok: false, error: String(err).slice(0, 200) },
      { status: 502 },
    );
  }
}
