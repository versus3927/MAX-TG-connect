import { adminAllowed } from "@/lib/guard";
import { MaxWsClient } from "@/lib/max-ws";
import { getAuthSession, setAuthSession } from "@/lib/max-auth-session";
import { setJsonSetting, setSetting } from "@/lib/bridge/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Шаг 1: ввод номера телефона → сервер запрашивает SMS-код в MAX (учитывая капчу). */
export async function POST(req: Request) {
  if (!adminAllowed(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    phone?: string;
    captchaToken?: string;
  };
  const phone = (body.phone ?? "").trim();
  if (!/^\+?\d{10,15}$/.test(phone)) {
    return Response.json(
      { ok: false, error: "Введите номер в формате +79XXXXXXXXX" },
      { status: 400 },
    );
  }
  const normalized = phone.startsWith("+") ? phone : `+${phone}`;
  const captchaToken = (body.captchaToken ?? "").trim() || null;

  // закрываем предыдущую попытку, если была
  const prev = getAuthSession();
  prev?.client?.close();
  // токен капчи берём из запроса либо переиспользуем сохранённый
  const effectiveCaptcha = captchaToken ?? prev?.captchaToken ?? null;

  const client = new MaxWsClient();
  try {
    const { verificationToken, codeLength } = await client.requestSmsCode(
      normalized,
      effectiveCaptcha ?? undefined,
    );
    setAuthSession({
      client,
      verificationToken,
      phone: normalized,
      captchaToken: effectiveCaptcha,
      createdAt: Date.now(),
    });
    await setSetting("max_account_status", "awaiting-code");
    await setJsonSetting("max_pending_phone", {
      phone: normalized.replace(/^(\+\d{3})\d+(\d{2})$/, "$1•••$2"),
    });
    return Response.json({ ok: true, codeLength });
  } catch (err) {
    const message = String(err);
    client.close();

    if (message.includes("captcha")) {
      // сервер MAX требует VK-капчу: берём ссылку для прохождения в браузере
      try {
        const captchaClient = new MaxWsClient();
        const link = await captchaClient.requestCaptchaLink(normalized);
        captchaClient.close();
        return Response.json(
          {
            ok: false,
            reason: "captcha",
            captchaLink: link,
            error:
              "MAX просит VK-капчу (IP сервера Railway). Откройте ссылку, пройдите проверку и вставьте токен капчи — или войдите раз в web.max.ru и повторите.",
          },
          { status: 428 },
        );
      } catch (inner) {
        console.error("[api/max/connect] captcha link failed:", inner);
        return Response.json(
          {
            ok: false,
            reason: "captcha",
            error: `${message} — не удалось получить ссылку капчи`,
          },
          { status: 428 },
        );
      }
    }

    console.error("[api/max/connect]", err);
    return Response.json(
      { ok: false, error: message.slice(0, 200) },
      { status: 502 },
    );
  }
}
