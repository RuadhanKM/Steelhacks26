import { API_CONFIG, getChatUrl } from "@/config/api";
import { firebaseAuth } from "@/config/firebase";
import type { ChatApiRequest, ChatApiResponse, ChatMessage, ToolTrace } from "@/types/chat";

export type ChatFailureSeverity = "degraded" | "offline";

export class AuthenticationError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ChatRequestError extends Error {
  readonly severity: ChatFailureSeverity;

  constructor(severity: ChatFailureSeverity) {
    super("Assistant unavailable. Your accounts and actions still work.");
    this.name = "ChatRequestError";
    this.severity = severity;
  }
}

export async function sendMessage(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<{ message: string; sourcedFrom: string[]; toolTraces: ToolTrace[] }> {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new AuthenticationError();

  let idToken: string;
  try {
    idToken = await user.getIdToken();
  } catch {
    throw new ChatRequestError("offline");
  }
  const body: ChatApiRequest = {
    message,
    conversationHistory: conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(getChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeoutId);
    throw new ChatRequestError("offline");
  }

  clearTimeout(timeoutId);

  if (response.status === 401) {
    throw new AuthenticationError();
  }

  if (!response.ok) {
    throw new ChatRequestError("degraded");
  }

  try {
    const data: ChatApiResponse = await response.json();
    if (typeof data.message !== "string") {
      throw new ChatRequestError("degraded");
    }
    return {
      message: data.message,
      sourcedFrom: data.sourcedFrom ?? [],
      toolTraces: (data.toolTraces ?? []).map((trace) => ({
        ...trace,
        timestamp: new Date(trace.timestamp),
      })),
    };
  } catch {
    throw new ChatRequestError("degraded");
  }
}

/**
 * Generates a unique message ID.
 */
let messageSequence = 0;

export function generateMessageId(): string {
  messageSequence += 1;
  return `msg_${Date.now()}_${messageSequence}`;
}
