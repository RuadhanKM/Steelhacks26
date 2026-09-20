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


class FormField(BaseModel):
    name: str
    label: str
    type: str  # select | multiselect | boolean | textarea
    required: bool = False
    helpText: str | None = None
    prefill: object | None = None
    options: list[FormOption] = Field(default_factory=list)


class DisputeForm(BaseModel):
    """A server-built intake form. Every option comes from the customer's own data."""

    formId: str
    title: str
    description: str
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
    pendingConfirmation: PendingConfirmation | None = None
    toolsUsed: list[str] = Field(default_factory=list)
    sourcedFrom: list[str] = Field(default_factory=list)
    toolTraces: list[ToolTraceOut] = Field(default_factory=list)
    policyConfigVersion: str


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


class ReviewRequest(BaseModel):
    note: str | None = None
