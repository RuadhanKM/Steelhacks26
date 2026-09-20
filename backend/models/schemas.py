"""Request and response shapes for the API layer."""
from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversationHistory: list[ChatTurn] | None = None


class DuplicateCharge(BaseModel):
    id: str
    accountId: str | None = None
    merchant: str | None = None
    amountCents: int
    createdAt: str | None = None
    status: str | None = None


class DuplicateCandidate(BaseModel):
    """A pair of charges that look alike. Not a confirmed error."""

    transactionIds: list[str]
    merchant: str | None = None
    amountCents: int
    accountId: str | None = None
    minutesApart: int
    reason: str
    status: str = "candidate"
    charges: list[DuplicateCharge] = Field(default_factory=list)


class PendingConfirmation(BaseModel):
    """The exact action the customer is being asked to confirm, in specifics."""

    action: str
    transactionIds: list[str]
    merchant: str | None = None
    amountCents: int
    detail: str


class FormOption(BaseModel):
    value: str
    label: str
    # Charge options carry their own facts so the app can render them richly.
    accountId: str | None = None
    merchant: str | None = None
    amountCents: int | None = None
    createdAt: str | None = None
    isDuplicateCandidate: bool | None = None
    chargesRequired: int | None = None
    # Triage options: whether this answer opens a claim, and what it means.
    opensClaim: bool | None = None
    outcome: str | None = None
    status: str | None = None


class FormField(BaseModel):
    name: str
    label: str
    type: str  # select | multiselect | boolean | textarea
    required: bool = False
    helpText: str | None = None
    prefill: object | None = None
    # e.g. {"recognition": "not_recognised"} — only show this field for that answer.
    showWhen: dict | None = None
    options: list[FormOption] = Field(default_factory=list)


class DisputeForm(BaseModel):
    """A server-built intake form. Every option comes from the customer's own data."""

    formId: str
    title: str
    description: str
    expiresAt: str
    policyConfigVersion: str
    fields: list[FormField]


class TriageForm(BaseModel):
    """"Did you make this?" — asked before any card is blocked or claim opened."""

    formId: str
    title: str
    description: str
    investigationNotice: str
    expiresAt: str
    policyConfigVersion: str
    fields: list[FormField]


class ToolTraceOut(BaseModel):
    """One tool call the app can show the customer, so the answer is traceable."""

    id: str
    name: str
    timestamp: str


class ChatResponse(BaseModel):
    # `message` keeps the existing frontend contract; the rest is additive.
    message: str
    sessionId: str
    duplicateCandidates: list[DuplicateCandidate] = Field(default_factory=list)
    # When present, the app renders this form; submitting it opens the case.
    disputeForm: DisputeForm | None = None
    # "Did you make this?" — asked before a card is blocked or a claim opened.
    fraudTriage: TriageForm | None = None
    pendingConfirmation: PendingConfirmation | None = None
    toolsUsed: list[str] = Field(default_factory=list)
    sourcedFrom: list[str] = Field(default_factory=list)
    toolTraces: list[ToolTraceOut] = Field(default_factory=list)
    policyConfigVersion: str


class CardResponse(BaseModel):
    id: str
    userId: str
    accountId: str | None = None
    network: str | None = None
    type: str | None = None
    last4: str | None = None
    status: str
    replacementOrdered: bool | None = None
    lockedAt: str | None = None
    cancelledAt: str | None = None
    lockReason: str | None = None


class CardActionRequest(BaseModel):
    confirmed: bool = False
    reason: str | None = None


class TriageRequest(BaseModel):
    transactionId: str
    recognition: str  # i_made_it | household | not_recognised
    cardAction: str = "none"  # none | lock | replace
    cardId: str | None = None
    note: str | None = None
    confirmed: bool = False


class TriageResult(BaseModel):
    recognition: str
    outcome: str  # no_claim | claim_opened | claim_already_open
    message: str
    claim: dict | None = None
    card: CardResponse | None = None


class CreateDisputeRequest(BaseModel):
    transactionIds: list[str]
    confirmed: bool = False
    # Set when the submission comes from an issued form (the normal path).
    formId: str | None = None
    accountId: str | None = None
    reasonCode: str = "duplicate_charge"
    note: str | None = None
    contactedMerchant: bool | None = None


class DisputeResponse(BaseModel):
    id: str
    userId: str
    transactionIds: list[str]
    status: str
    reason: str | None = None
    note: str | None = None
    contactedMerchant: bool | None = None
    formId: str | None = None
    merchant: str | None = None
    claimedAmountCents: int | None = None
    accountId: str | None = None
    policyConfigVersion: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    reviewedBy: str | None = None
    reviewedAt: str | None = None
    reviewNote: str | None = None
    reversalTransactionId: str | None = None
    reversalAmountCents: int | None = None
    claimType: str | None = None
    recognition: str | None = None
    cardId: str | None = None
    cardAction: str | None = None
    provisionalCreditCents: int | None = None
    provisionalCreditTransactionId: str | None = None
    provisionalCreditPermanent: bool | None = None
    provisionalCreditReversedTransactionId: str | None = None


class ReviewRequest(BaseModel):
    note: str | None = None
