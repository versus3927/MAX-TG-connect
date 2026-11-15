import { maxGetMe, maxGetUpdates } from "@/lib/max";
import { tgDeleteWebhook, tgGetMe, tgGetUpdates } from "@/lib/telegram";
import { handleMaxUpdate, handleTgUpdate } from "@/lib/bridge/bridge";
import { setJsonSetting, setSetting } from "@/lib/bridge/store";
import { getSetting } from "@/lib/bridge/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

declare global {
  // eslint-disable-next-line no-var
  var __maxTgBridgeStarted: boolean | undefined;
}

async function refreshBotsInfo() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const me = await tgGetMe();
      await setJsonSetting("tg_bot_info", {
        username: me.username,
        name: me.first_name,
        id: me.id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[bridge] telegram getMe failed:", err);
      await setSetting("tg_bot_error", String(err).slice(0, 300));
    }
  }
  if (process.env.MAX_BOT_TOKEN) {
    try {
      const me = await maxGetMe();
      await setJsonSetting("max_bot_info", {
        username: me.username,
        name: me.name,
        id: me.user_id,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[bridge] max getMe failed:", err);
      await setSetting("max_bot_error", String(err).slice(0, 300));
    }
  }
}

async function tgLoop() {
  let offset: number | null = null;
  // getUpdates не работает, пока стоит webhook — снимаем его.
  try {
    await tgDeleteWebhook();
  } catch (err) {
    console.error("[bridge] telegram deleteWebhook failed:", err);
  }
  for (;;) {
    try {
      const updates = await tgGetUpdates(offset, 25);
      for (const u of updates) {
        offset = u.update_id + 1;
        try {
          await handleTgUpdate(u);
        } catch (err) {
          console.error("[bridge] tg update handling failed:", err);
        }
      }
    } catch (err) {
      console.error("[bridge] tg polling failed:", err);
      await sleep(5000);
    }
  }
}

async function maxLoop() {
  for (;;) {
    try {
      const rawMarker = await getSetting("max_marker");
      const marker = rawMarker ? Number(rawMarker) : null;
      const { updates, marker: nextMarker } = await maxGetUpdates(
        Number.isFinite(marker) ? marker : null,
        30,
      );
      if (nextMarker != null) {
        await setSetting("max_marker", String(nextMarker));
      }
      for (const u of updates) {
        try {
          await handleMaxUpdate(u);
        } catch (err) {
          console.error("[bridge] max update handling failed:", err);
        }
      }
      await setSetting("max_last_poll", new Date().toISOString());
    } catch (err) {
      console.error("[bridge] max polling failed:", err);
      await sleep(5000);
    }
  }
}

async function heartbeatLoop() {
  let tick = 0;
  for (;;) {
    try {
      await setSetting("worker_heartbeat", new Date().toISOString());
      if (tick % 15 === 0) {
        await refreshBotsInfo(); // обновляем карточки ботов примерно раз в 5 минут
      }
    } catch (err) {
      console.error("[bridge] heartbeat failed:", err);
    }
    tick += 1;
    await sleep(20000);
  }
}

/**
 * Запускает фоновый мост MAX → Telegram.
 * Вызывается один раз при старте сервера (см. src/instrumentation.ts).
 * Работает на Railway как обычный Node-процесс рядом с Next.js.
 */
export function startBridge(): void {
  if (globalThis.__maxTgBridgeStarted) return;
  globalThis.__maxTgBridgeStarted = true;

  const hasTg = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const hasMax = Boolean(process.env.MAX_BOT_TOKEN);
  const hasDb = Boolean(process.env.DATABASE_URL);

  console.log(
    `[bridge] starting. telegram=${hasTg ? "configured" : "missing"} max=${
      hasMax ? "configured" : "missing"
    } db=${hasDb ? "configured" : "missing"}`,
  );

  if (!hasDb || (!hasTg && !hasMax)) {
    console.log(
      "[bridge] tokens are not configured — worker is idle. Set TELEGRAM_BOT_TOKEN and MAX_BOT_TOKEN.",
    );
    return;
  }

  void heartbeatLoop();
  if (hasTg) void tgLoop();
  if (hasMax) void maxLoop();
}
