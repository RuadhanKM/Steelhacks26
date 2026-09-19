/**
 * API configuration for the banking chat assistant.
 * Update API_BASE_URL to point to your backend server.
 */

export const API_CONFIG = {
  /**
   * Base URL for the chat API endpoint.
   * Change this to your production/staging server URL.
   *
   * Examples:
   *   - Local dev:    "http://localhost:3000"
   *   - Staging:      "https://staging-api.yourbank.com"
   *   - Production:   "https://api.yourbank.com"
   */
  BASE_URL: "http://localhost:3000",

  /**
   * The specific endpoint path for chat messages.
   */
  CHAT_ENDPOINT: "/api/chat",

  /**
   * Request timeout in milliseconds.
   */
  TIMEOUT_MS: 30000,
} as const;

/**
 * Returns the full chat API URL.
 */
export function getChatUrl(): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.CHAT_ENDPOINT}`;
}
