interface ChatMessageBase {
  kind: "message";
  id: string;
  content: string;
  timestamp: Date;
}

export interface UserChatMessage extends ChatMessageBase {
  role: "user";
}

export interface ToolTrace {
  id: string;
  name: string;
  timestamp: Date;
}

export interface AgentChatMessage extends ChatMessageBase {
  role: "assistant";
  sourcedFrom: string[];
  toolTraces?: ToolTrace[];
}

export type ChatMessage = UserChatMessage | AgentChatMessage;

export type SystemNoticeSeverity = "info" | "degraded" | "offline";

export interface ChatSystemNotice {
  kind: "system_notice";
  id: string;
  severity: SystemNoticeSeverity;
  content: string;
}

export type ChatEntry = ChatMessage | ChatSystemNotice;

export interface ChatMessageGroup {
  id: string;
  role: ChatMessage["role"];
  messages: ChatMessage[];
  startedAt: Date;
  endedAt: Date;
}

export type ChatTimelineItem =
  | { type: "day"; id: string; label: string }
  | { type: "group"; id: string; group: ChatMessageGroup }
  | { type: "system_notice"; id: string; notice: ChatSystemNotice };

export interface ChatApiRequest {
  message: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface ChatApiResponse {
  message: string;
  sourcedFrom?: string[];
  toolTraces?: Array<{
    id: string;
    name: string;
    timestamp: string;
  }>;
}

export function appendChatEntry(entries: ChatEntry[], entry: ChatEntry): ChatEntry[] {
  if (__DEV__ && entry.kind === "message" && entry.role === "assistant") {
    if (/\$\s?\d/.test(entry.content) && entry.sourcedFrom.length === 0) {
      console.warn(
        `[chat provenance invariant] Unsourced currency figure in message ${entry.id}: ${entry.content}`,
      );
    }
  }

  return [...entries, entry];
}
