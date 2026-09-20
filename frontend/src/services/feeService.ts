import { authorizedFetch } from "@/services/apiClient";
import type { DisputeCase, FeeWaiverForm } from "@/types/chat";

export interface FeeWaiverSubmission {
  formId: string;
  transactionId: string;
  reasonCode: string;
  note?: string;
}

/** Ask for the fee refund form without a chat turn. */
export async function requestFeeWaiverForm(): Promise<FeeWaiverForm> {
  return (await authorizedFetch("/fees/waiver-form", { method: "POST" })) as FeeWaiverForm;
}

/**
 * Send the request.
 *
 * This opens a case for a banker to decide; nothing is refunded here. The
 * backend refuses without `confirmed` — submitting the form is the confirmation.
 */
export async function submitFeeWaiver(
  submission: FeeWaiverSubmission,
): Promise<DisputeCase> {
  return (await authorizedFetch("/fees/waiver-requests", {
    method: "POST",
    body: {
      ...submission,
      note: submission.note?.trim() || null,
      confirmed: true,
    },
  })) as DisputeCase;
}
