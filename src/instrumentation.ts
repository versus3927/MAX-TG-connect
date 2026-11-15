/**
 * Next.js instrumentation hook: вызывается один раз при старте сервера
 * (next start / next dev). Здесь поднимаем фоновый воркер моста.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBridge } = await import("./lib/bridge/worker");
    startBridge();
  }
}
