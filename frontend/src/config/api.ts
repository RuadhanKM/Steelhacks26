/**
 * API configuration for the banking chat assistant.
 *
 * Point this at the FastAPI backend in `backend/`. Set EXPO_PUBLIC_API_URL in
 * frontend/.env to override it — required when testing on a phone, where
 * "localhost" means the phone itself, not your computer (use your machine's LAN
 * address, e.g. http://192.168.1.20:8000).
 */

const DEFAULT_BASE_URL = "http://localhost:8000";

export const API_CONFIG = {
  /** Base URL of the FastAPI backend. `fastapi dev main.py` serves port 8000. */
  BASE_URL: process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL,

  /** Chat turns. */
  CHAT_ENDPOINT: "/api/chat",

  /** Dispute intake form, issued by the server from the customer's own data. */
  DISPUTE_FORM_ENDPOINT: "/disputes/form",

  /** Dispute cases: POST to open one, GET /disputes/{id} for status. */
  DISPUTES_ENDPOINT: "/disputes",

  /** Request timeout in milliseconds. */
  TIMEOUT_MS: 30000,
} as const;

export function getApiUrl(path: string): string {
  return `${API_CONFIG.BASE_URL}${path}`;
}

export function getChatUrl(): string {
  return getApiUrl(API_CONFIG.CHAT_ENDPOINT);
}
