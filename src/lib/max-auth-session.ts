/**
 * Серверная сессия SMS-входа MAX в памяти процесса.
 * Хранит WS-клиент + verificationToken, пока пользователь вводит код в панели.
 * Секреты в БД/файлы не пишутся.
 */

import { MaxWsClient } from "@/lib/max-ws";
import { setMaxAccountToken } from "@/lib/bridge/store";

declare global {
  // eslint-disable-next-line no-var
  var __maxAuthSession:
    | {
        client: MaxWsClient | null;
        verificationToken: string;
        phone: string;
        captchaToken: string | null;
        createdAt: number;
      }
    | undefined;
}

export type AuthSession = {
  client: MaxWsClient | null;
  verificationToken: string;
  phone: string;
  captchaToken: string | null;
  createdAt: number;
};

export function getAuthSession(): AuthSession | null {
  return globalThis.__maxAuthSession ?? null;
}

export function setAuthSession(s: AuthSession | null): void {
  globalThis.__maxAuthSession = s ?? undefined;
}

declare global {
  // eslint-disable-next-line no-var
  var __maxAccountTokenNonce: number | undefined;
}

/** Меняет токен и будит воркер. non-null → 1 (подключиться), null → -1 (отключиться). */
export function saveMaxAccountToken(token: string | null): void {
  setMaxAccountToken(token);
  globalThis.__maxAccountTokenNonce = token ? 1 : -1;
}

export function takeMaxAccountTokenNonce(): number {
  const n = globalThis.__maxAccountTokenNonce ?? 0;
  globalThis.__maxAccountTokenNonce = 0;
  return n;
}
