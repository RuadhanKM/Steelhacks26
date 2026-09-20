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

/** One selectable option on a server-built form. */
export interface DisputeFormOption {
  value: string;
  label: string;
  /** Triage answers: whether this answer opens a claim, and what it means. */
  opensClaim?: boolean | null;
  outcome?: string | null;
  status?: string | null;
  accountId?: string | null;
  merchant?: string | null;
  amountCents?: number | null;
  createdAt?: string | null;
  isDuplicateCandidate?: boolean | null;
  chargesRequired?: number | null;
}

export interface DisputeFormField {
  name: string;
  label: string;
  type: "select" | "multiselect" | "boolean" | "textarea";
  required: boolean;
  helpText?: string | null;
  prefill?: unknown;
  /** e.g. {"recognition": "not_recognised"} — only show this field for that answer. */
  showWhen?: Record<string, string> | null;
  options: DisputeFormOption[];
}

/**
 * A dispute intake form. Every option comes from the customer's own accounts
 * and transactions, built server-side — the assistant does not choose them.
 */
export interface DisputeForm {
  formId: string;
  title: string;
  description: string;
  expiresAt: string;
  policyConfigVersion: string;
  fields: DisputeFormField[];
}

/**
 * The "did you make this?" form. An unfamiliar merchant name is not proof of
 * theft, so this is asked before any card is blocked or claim opened.
 */
export interface TriageForm {
  formId: string;
  title: string;
  description: string;
  investigationNotice: string;
  expiresAt: string;
  policyConfigVersion: string;
  fields: DisputeFormField[];
}

/**
 * Asking the bank to refund its own fee. A request a banker decides on — the
 * wording of that promise lives on the server, in `decisionNotice`.
 */
export interface FeeWaiverForm {
  formId: string;
  title: string;
  description: string;
  decisionNotice: string;
  waiversGrantedLastYear: number;
  courtesyPerYear: number;
  expiresAt: string;
  policyConfigVersion: string;
  fields: DisputeFormField[];
}

export type CardStatus = "active" | "locked" | "cancelled";

export interface Card {
  id: string;
  accountId?: string | null;
  network?: string | null;
  type?: string | null;
  last4?: string | null;
  status: CardStatus;
  replacementOrdered?: boolean | null;
}

export interface TriageResult {
  recognition: string;
  /** no_claim | claim_opened | claim_already_open */
  outcome: string;
  message: string;
  claim?: DisputeCase | null;
  card?: Card | null;
}

export type DisputeStatus = "submitted" | "under_review" | "resolved" | "rejected";

export interface DisputeCase {
  id: string;
  status: DisputeStatus;
  reason?: string | null;
  merchant?: string | null;
  claimedAmountCents?: number | null;
  transactionIds: string[];
  note?: string | null;
  reviewNote?: string | null;
  reversalAmountCents?: number | null;
  createdAt?: string | null;
  /** Fee waivers carry why it was asked for, and the courtesy context. */
  feeWaiverReason?: string | null;
  waiversGrantedLastYear?: number | null;
  withinCourtesyPolicy?: boolean | null;
  /** Fraud claims carry what happened to the card and any temporary credit. */
  claimType?: string | null;
  cardAction?: string | null;
  provisionalCreditCents?: number | null;
  provisionalCreditPermanent?: boolean | null;
  provisionalCreditReversedTransactionId?: string | null;
}

/** The form rendered inside the conversation, and the case it opens. */
export interface ChatDisputeForm {
  kind: "dispute_form";
  id: string;
  form: DisputeForm;
  submittedCaseId?: string;
}

export interface ChatDisputeCase {
  kind: "dispute_case";
  id: string;
  case: DisputeCase;
}

/** A tap option offered when the assistant could not act on the message. */
export interface ChatSuggestion {
  label: string;
  prompt: string;
}

export interface ChatSuggestions {
  kind: "suggestions";
  id: string;
  suggestions: ChatSuggestion[];
}

export interface ChatFeeWaiverForm {
  kind: "fee_waiver_form";
  id: string;
  form: FeeWaiverForm;
  submittedCaseId?: string;
}

export interface ChatTriageForm {
  kind: "triage_form";
  id: string;
  form: TriageForm;
  result?: TriageResult;
}

export type ChatEntry =
  | ChatMessage
  | ChatSystemNotice
  | ChatDisputeForm
  | ChatDisputeCase
  | ChatTriageForm
  | ChatFeeWaiverForm
  | ChatSuggestions;

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
  | { type: "system_notice"; id: string; notice: ChatSystemNotice }
  | { type: "dispute_form"; id: string; entry: ChatDisputeForm }
  | { type: "dispute_case"; id: string; entry: ChatDisputeCase }
  | { type: "triage_form"; id: string; entry: ChatTriageForm }
  | { type: "suggestions"; id: string; entry: ChatSuggestions }
  | { type: "fee_waiver_form"; id: string; entry: ChatFeeWaiverForm };

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
  /** Present when the assistant handed back an intake form for the customer to fill in. */
  disputeForm?: DisputeForm | null;
  /** Present when the assistant opened the unfamiliar-charge check. */
  fraudTriage?: TriageForm | null;
  /** Present when the assistant opened the fee refund request. */
  feeWaiver?: FeeWaiverForm | null;
  /** Offered when the message was off-topic or unclear. */
  suggestions?: ChatSuggestion[];
  routedAs?: string | null;
  routedBy?: string | null;
  policyConfigVersion?: string;
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
