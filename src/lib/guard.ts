/**
 * Защита админских API. Если переменная окружения ADMIN_SECRET задана,
 * все мутации требуют заголовок `x-admin-key` с этим значением.
 * Если не задана — панель открыта (удобно для локальной разработки).
 */
export function adminAllowed(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return true;
  return req.headers.get("x-admin-key") === secret;
}

export function adminRequired(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}
