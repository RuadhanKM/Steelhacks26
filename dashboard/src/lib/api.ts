import { auth } from "@/lib/firebase";

/**
 * Calls the FastAPI backend with the signed-in reviewer's Firebase ID token.
 *
 * Dispute review goes through the backend rather than straight to Firestore:
 * the policy gate, the ownership checks, and the reversal-plus-balance
 * transaction all live there, and a direct write would skip every one of them.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, "Sign in to continue.");

  const idToken = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Keep the status-based message.
    }
    throw new ApiError(response.status, detail);
  }

  return (await response.json()) as T;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  email: string | null;
  isStaff: boolean;
  policyConfigVersion: string;
}

export type DisputeStatus =
  | "submitted"
  | "under_review"
  | "resolved"
  | "rejected";

export interface DisputeCase {
  id: string;
  userId: string;
  transactionIds: string[];
  status: DisputeStatus;
  reason?: string | null;
  note?: string | null;
  contactedMerchant?: boolean | null;
  merchant?: string | null;
  claimedAmountCents?: number | null;
  accountId?: string | null;
  policyConfigVersion?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  reversalTransactionId?: string | null;
  reversalAmountCents?: number | null;
}

export const getSessionInfo = () => request<SessionInfo>("/session");

export const getPendingDisputes = () =>
  request<DisputeCase[]>("/staff/disputes/pending");

export const claimDispute = (id: string) =>
  request<DisputeCase>(`/staff/disputes/${id}/claim`, { method: "POST" });

export const approveDispute = (id: string, note?: string) =>
  request<DisputeCase>(`/staff/disputes/${id}/approve`, {
    method: "POST",
    body: { note: note?.trim() || null },
  });

export const rejectDispute = (id: string, note?: string) =>
  request<DisputeCase>(`/staff/disputes/${id}/reject`, {
    method: "POST",
    body: { note: note?.trim() || null },
  });

export function formatAmount(cents?: number | null): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const REASON_LABELS: Record<string, string> = {
  duplicate_charge: "Charged more than once",
  unauthorized: "Not authorised",
  wrong_amount: "Wrong amount",
  goods_not_received: "Goods not received",
};
