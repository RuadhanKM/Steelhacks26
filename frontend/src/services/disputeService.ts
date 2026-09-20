import { API_CONFIG } from "@/config/api";
import { authorizedFetch } from "@/services/apiClient";
import type { DisputeCase, DisputeForm } from "@/types/chat";

export interface DisputeSubmission {
  formId: string;
  accountId: string;
  reasonCode: string;
  transactionIds: string[];
  note?: string;
  contactedMerchant?: boolean;
}

/** Request a form directly, without a chat turn (for a "Dispute a charge" button). */
export async function requestDisputeForm(): Promise<DisputeForm> {
  return (await authorizedFetch(API_CONFIG.DISPUTE_FORM_ENDPOINT, {
    method: "POST",
  })) as DisputeForm;
}

/**
 * Open a case from a filled-in form.
 *
 * `confirmed` is the customer pressing Submit on specifics they picked
 * themselves; the backend refuses the write without it. Submitting the same
 * form twice returns the case already opened rather than opening a second one.
 */
export async function submitDispute(submission: DisputeSubmission): Promise<DisputeCase> {
  return (await authorizedFetch(API_CONFIG.DISPUTES_ENDPOINT, {
    method: "POST",
    body: { ...submission, confirmed: true },
  })) as DisputeCase;
}

export async function getDispute(disputeId: string): Promise<DisputeCase> {
  return (await authorizedFetch(`${API_CONFIG.DISPUTES_ENDPOINT}/${disputeId}`)) as DisputeCase;
}
