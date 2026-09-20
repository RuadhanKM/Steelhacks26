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

  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch {
    throw new ChatRequestError("offline");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(getApiUrl(path), {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutId);
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
