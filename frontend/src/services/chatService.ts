import { getChatUrl, API_CONFIG } from "@/config/api";
import type { ChatApiRequest, ChatApiResponse, ChatMessage } from "@/types/chat";

/**
 * Sends a message to the chat API and returns the assistant's response.
 * Falls back to a simulated response if the backend is unreachable.
 */
export async function sendMessage(
  message: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const body: ChatApiRequest = {
    message,
    conversationHistory: conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(getChatUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: ChatApiResponse = await response.json();
    return data.message;
  } catch (error) {
    clearTimeout(timeoutId);

    // Fallback: simulate a response when backend is not available
    console.warn("Chat API unreachable, using simulated response:", error);
    return getSimulatedResponse(message);
  }
}

/**
 * Provides simulated banking assistant responses for demo/dev purposes.
 */
function getSimulatedResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("balance") || lower.includes("account")) {
    return "Your checking account ending in ••4582 has a balance of $3,247.89. Your savings account ending in ••7291 has a balance of $12,580.43. Would you like to see recent transactions or transfer funds between accounts?";
  }

  if (lower.includes("transfer") || lower.includes("send") || lower.includes("move money")) {
    return "I can help you transfer funds. Which accounts would you like to transfer between, and how much would you like to move? For security, transfers over $5,000 may require additional verification.";
  }

  if (lower.includes("transaction") || lower.includes("history") || lower.includes("spent")) {
    return "Here are your recent transactions:\n\n• Starbucks — $5.75 (Today)\n• Amazon — $42.99 (Yesterday)\n• Whole Foods — $87.23 (Sep 17)\n• Electric Company — $124.50 (Sep 15)\n• Direct Deposit — +$2,850.00 (Sep 14)\n\nWould you like to see more transactions or filter by category?";
  }

  if (lower.includes("bill") || lower.includes("pay")) {
    return "You have 2 upcoming bills:\n\n• Rent — $1,200.00 (Due Sep 30)\n• Internet — $79.99 (Due Oct 3)\n\nWould you like to schedule a payment or set up autopay for any of these?";
  }

  if (lower.includes("lost") || lower.includes("stolen") || lower.includes("card")) {
    return "I'm sorry to hear that. I can help you lock your card immediately to prevent unauthorized charges. Would you like me to:\n\n1. Temporarily lock your card\n2. Report it as lost/stolen and order a replacement\n3. Review recent charges for suspicious activity\n\nWhich would you prefer?";
  }

  if (lower.includes("help") || lower.includes("what can you")) {
    return "I'm your personal banking assistant. Here's what I can help you with:\n\n• Check account balances\n• View recent transactions\n• Transfer money between accounts\n• Pay bills & schedule payments\n• Lock or replace your card\n• Find nearby ATMs & branches\n• Set up alerts & notifications\n\nJust ask me anything!";
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return "Hello! 👋 Welcome back. How can I help you with your banking today?";
  }

  return "I'd be happy to help with that. Could you give me a bit more detail about what you need? I can assist with account balances, transfers, bill payments, card services, and more.";
}

/**
 * Generates a unique message ID.
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
