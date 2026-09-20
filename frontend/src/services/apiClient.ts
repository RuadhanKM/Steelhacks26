import { API_CONFIG, getApiUrl } from "@/config/api";
import { firebaseAuth } from "@/config/firebase";

export type ChatFailureSeverity = "degraded" | "offline";

export class AuthenticationError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ChatRequestError extends Error {
  readonly severity: ChatFailureSeverity;

  constructor(severity: ChatFailureSeverity, message?: string) {
    super(message ?? "Assistant unavailable. Your accounts and actions still work.");
    this.name = "ChatRequestError";
    this.severity = severity;
  }
}

/**
 * Thrown when the backend refused the request and said why in a way worth
 * showing the customer — a charge that was not on the form, an expired form.
 */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

let latestIdToken: string | null = null;

export function setLatestIdToken(token: string | null) {
  latestIdToken = token;
}

export async function getValidIdToken(user: any): Promise<string> {
  const cachedFallback =
    latestIdToken ||
    user?.stsTokenManager?.accessToken ||
    user?.accessToken ||
    (typeof user?.toJSON === "function" ? (user.toJSON() as any)?.stsTokenManager?.accessToken : null);

  // Race user.getIdToken(false) with a 2-second timeout to prevent React Native hanging indefinitely
  try {
    const tokenPromise = user.getIdToken(false);
    const timeoutPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });
    const token = await Promise.race([tokenPromise, timeoutPromise]);
    if (token) {
      latestIdToken = token;
      return token;
    }
  } catch (err) {
    console.warn("[apiClient] user.getIdToken() error:", err);
  }

  // Fall back to immediate cached token if getIdToken timed out or hung
  if (cachedFallback) {
    return cachedFallback;
  }

  // Last attempt: race force-refresh for 2 seconds
  try {
    const token = await Promise.race([
      user.getIdToken(true),
      new Promise<string | null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (token) {
      latestIdToken = token;
      return token;
    }
  } catch (err) {
    console.warn("[apiClient] forced getIdToken error:", err);
  }

  throw new ChatRequestError("offline", "Could not obtain an authentication token. Please sign in again.");
}

/**
 * Calls the backend with the signed-in user's Firebase ID token.
 *
 * The token is the only identity the backend accepts; it verifies it and looks
 * up the customer itself, so nothing here says whose data to read.
 */
export async function authorizedFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new AuthenticationError();

  const idToken = await getValidIdToken(user);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  let response: Response;
  const fullUrl = getApiUrl(path);

  try {
    response = await fetch(fullUrl, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[apiClient] Network request failed for ${fullUrl}:`, err);
    throw new ChatRequestError("offline");
  }

  clearTimeout(timeoutId);

  if (response.status === 401) throw new AuthenticationError();

  if (!response.ok) {
    // The backend sends a plain-language reason in `detail` for refusals the
    // customer can act on. Anything else is a generic degraded state.
    let detail: string | undefined;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      detail = undefined;
    }
    if (detail && response.status < 500) {
      throw new ApiRequestError(response.status, detail);
    }
    throw new ChatRequestError("degraded", detail);
  }

  try {
    return await response.json();
  } catch {
    throw new ChatRequestError("degraded");
  }
}
