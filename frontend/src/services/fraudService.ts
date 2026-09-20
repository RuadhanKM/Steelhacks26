import { authorizedFetch } from "@/services/apiClient";
import type { Card, TriageForm, TriageResult } from "@/types/chat";

export interface TriageAnswer {
  transactionId: string;
  recognition: string;
  cardAction?: string;
  cardId?: string | null;
  note?: string;
}

/** Ask for the unfamiliar-charge form without a chat turn. */
export async function requestTriageForm(transactionId?: string): Promise<TriageForm> {
  const query = transactionId ? `?transaction_id=${encodeURIComponent(transactionId)}` : "";
  return (await authorizedFetch(`/fraud/triage${query}`, { method: "POST" })) as TriageForm;
}

/**
 * Answer the form.
 *
 * Recognising the charge ends the flow with an explanation. Only "I do not
 * recognise this" secures the card and opens a claim, and the backend refuses
 * that without `confirmed` — the customer pressing submit is the confirmation.
 */
export async function answerTriage(
  formId: string,
  answer: TriageAnswer,
): Promise<TriageResult> {
  const opensClaim = answer.recognition === "not_recognised";
  return (await authorizedFetch(`/fraud/triage/${formId}`, {
    method: "POST",
    body: {
      transactionId: answer.transactionId,
      recognition: answer.recognition,
      cardAction: answer.cardAction ?? "none",
      cardId: answer.cardId ?? null,
      note: answer.note?.trim() || null,
      confirmed: opensClaim,
    },
  })) as TriageResult;
}

export async function getCards(): Promise<Card[]> {
  return (await authorizedFetch("/cards")) as Card[];
}
