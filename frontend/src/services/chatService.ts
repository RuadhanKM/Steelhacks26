import { API_CONFIG } from "@/config/api";
import { authorizedFetch, ChatRequestError } from "@/services/apiClient";
import type {
  ChatApiRequest,
  ChatApiResponse,
  ChatMessage,
  DisputeForm,
  ToolTrace,
  TriageForm,
} from "@/types/chat";

export {
  ApiRequestError,
  AuthenticationError,
  ChatRequestError,
  type ChatFailureSeverity,
} from "@/services/apiClient";

export interface ChatReply {
  message: string;
  sourcedFrom: string[];
  toolTraces: ToolTrace[];
  disputeForm: DisputeForm | null;
  fraudTriage: TriageForm | null;
}

export async function sendMessage(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatReply> {
  const body: ChatApiRequest = {
    message,
    conversationHistory: conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  const data = (await authorizedFetch(API_CONFIG.CHAT_ENDPOINT, {
    method: "POST",
    body,
  })) as ChatApiResponse;

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
    disputeForm: data.disputeForm ?? null,
    fraudTriage: data.fraudTriage ?? null,
  };
}

/**
 * Generates a unique message ID.
 */
let messageSequence = 0;

export function generateMessageId(): string {
  messageSequence += 1;
  return `msg_${Date.now()}_${messageSequence}`;
}
