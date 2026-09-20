"""The conversation endpoint.

The model phrases the answer; it never sources a number and never opens a case.
Candidate charges are pulled out of this turn's tool results and returned as
structured data next to the prose, so the app can render the charges itself
rather than parsing them back out of a sentence.
"""
import os

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic_ai.exceptions import ModelHTTPError, UnexpectedModelBehavior
from pydantic_ai.messages import ToolReturnPart

from agent.router import classify, is_in_scope
from agent.tools import SessionDeps, agent, missing_api_key
from api.deps import current_session
from models.schemas import (
    ChatRequest,
    ChatResponse,
    ChatSuggestion,
    DisputeForm,
    DuplicateCandidate,
    PendingConfirmation,
    ToolTraceOut,
    TriageForm,
)
from policy.actions import CONFIG_VERSION, ActionNotAllowed, requires_confirmation
from policy.services import REPLIES, suggestions
from services.dispute_form_service import FormError, build_dispute_form
from services.dispute_service import disputable_duplicates
from services.fraud_service import TriageError, build_triage_form
from services.session_service import Session

router = APIRouter(tags=["chat"])


def _dollars(cents: int) -> str:
    return f"${abs(cents) / 100:,.2f}"


def _provider_hint(exc: ModelHTTPError) -> str:
    """Turn a provider error into something the logs make actionable."""
    body = str(getattr(exc, "body", "") or "")
    if exc.status_code == 429 and "credit" in body.lower():
        return "The API account is out of credits."
    if exc.status_code == 429:
        return "Rate limited; try again shortly."
    if exc.status_code in (401, 403):
        return "Check the provider API key in backend/.env."
    return "Check the backend logs for the provider's response."


def _tool_results(messages) -> list[tuple[str, object]]:
    """Every tool return in this run, in order: (tool_name, content)."""
    results = []
    for message in messages:
        for part in getattr(message, "parts", []):
            if isinstance(part, ToolReturnPart):
                results.append((part.tool_name, part.content))
    return results


# Words that mean "I want to dispute a charge". Used only to decide whether the
# server issues a form the model failed to ask for — never to answer anything.
DISPUTE_INTENT = (
    "charged twice",
    "charged me twice",
    "double charge",
    "double charged",
    "duplicate charge",
    "charged two times",
    "dispute",
    "refund",
    "reverse",
    "chargeback",
    "didn't authorize",
    "didn't authorise",
    "did not authorize",
    "did not authorise",
    "wrong amount",
    "never received",
)


# A charge the customer disowns, or a card at risk. These go to triage, which
# asks whether they made the purchase before anything is blocked or claimed.
FRAUD_INTENT = (
    "didn't authorize",
    "didn't authorise",
    "did not authorize",
    "did not authorise",
    "unauthorized",
    "unauthorised",
    "without permission",
    "didn't make this",
    "did not make this",
    "did not make that",
    "not mine",
    "don't recognize",
    "don't recognise",
    "do not recognize",
    "do not recognise",
    "never heard of",
    "fraud",
    "stolen",
    "lost my card",
    "someone used my card",
    "card was used",
)


# A claim specifically about being billed twice. If no such pair exists, the
# answer is "there isn't one", not a form.
DUPLICATE_CLAIM = (
    "charged twice",
    "charged me twice",
    "double charge",
    "double charged",
    "duplicate charge",
    "charged two times",
    "twice for",
    "same charge twice",
)


def _wants_dispute(message: str) -> bool:
    lowered = message.lower()
    return any(phrase in lowered for phrase in DISPUTE_INTENT)


def _claims_duplicate(message: str) -> bool:
    lowered = message.lower()
    return any(phrase in lowered for phrase in DUPLICATE_CLAIM)


def _suspects_fraud(message: str) -> bool:
    lowered = message.lower()
    return any(phrase in lowered for phrase in FRAUD_INTENT)


def _is_new_conversation(request: ChatRequest) -> bool:
    """True when the client is starting fresh, so server history must be dropped.

    The app rebuilds its message list on every launch, but the session lives in
    this process. Without this, the model keeps answering from a conversation
    the customer can no longer see — "I already opened the form" for a form that
    was never rendered.
    """
    history = request.conversationHistory or []
    return sum(1 for turn in history if turn.role == "user") <= 1


@router.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest, session: Session = Depends(current_session)):
    missing_key = missing_api_key()
    if missing_key:
        raise HTTPException(
            status_code=503,
            detail=f"{missing_key} is not set, so the assistant cannot run.",
        )

    if _is_new_conversation(request):
        session.history = []
        session.pending_confirmation = None

    # Classify before waking the main agent. A greeting or an off-topic question
    # is answered from a fixed list here, for a fraction of a full turn.
    route, decided_by = classify(request.message)
    if not is_in_scope(route, decided_by):
        return ChatResponse(
            message=REPLIES[route],
            sessionId=session.session_id,
            suggestions=[ChatSuggestion(**item) for item in suggestions()],
            routedAs=route,
            routedBy=decided_by,
            policyConfigVersion=CONFIG_VERSION,
        )

    deps = SessionDeps(user_id=session.user_id, session_id=session.session_id)

    try:
        # History lives on the server session, not in the request body: the client
        # cannot rewrite what was already said to change what the agent may do.
        result = agent.run_sync(request.message, deps=deps, message_history=session.history or None)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ModelHTTPError as exc:
        # The model provider refused: no credits, rate limit, bad key, outage.
        # Answer with a real status so the app can say the assistant is
        # unavailable. An unhandled error here would skip the CORS middleware
        # and reach the browser as a CORS failure instead of the actual reason.
        raise HTTPException(
            status_code=503,
            detail=f"The assistant's model provider returned {exc.status_code}. {_provider_hint(exc)}",
        ) from exc
    except UnexpectedModelBehavior as exc:
        raise HTTPException(status_code=502, detail=f"The assistant could not complete that: {exc}") from exc
    session.history = result.all_messages()

    tool_results = _tool_results(result.new_messages())
    candidates: list[DuplicateCandidate] = []
    dispute_form: DisputeForm | None = None
    triage_form: TriageForm | None = None
    for tool_name, content in tool_results:
        if tool_name == "start_fraud_triage" and isinstance(content, dict) and "formId" in content:
            triage_form = TriageForm(**content)
        if tool_name == "find_possible_duplicates" and isinstance(content, list):
            candidates.extend(DuplicateCandidate(**row) for row in content)
        elif tool_name == "start_dispute_form" and isinstance(content, dict) and "formId" in content:
            dispute_form = DisputeForm(**content)

    # The model sometimes talks about the form without calling the tool — most
    # often when an earlier turn already issued one. The customer would see a
    # sentence about a form that is not on screen, so the server issues it.
    # Its own reply mentioning a form counts: that promise has to be kept.
    # A disowned charge goes to triage, not to the dispute form: the customer is
    # asked whether they made the purchase before anything is blocked.
    if triage_form is None and dispute_form is None and _suspects_fraud(request.message):
        try:
            triage_form = TriageForm(**build_triage_form(session.user_id))
        except (TriageError, ActionNotAllowed):
            triage_form = None

    mentions_form = "form" in (result.output or "").lower()
    # A double-charge claim with no matching pair gets an answer, not a form.
    duplicate_claim_without_pair = _claims_duplicate(request.message) and not disputable_duplicates(
        session.user_id
    )
    if (
        dispute_form is None
        and triage_form is None
        and not duplicate_claim_without_pair
        and (_wants_dispute(request.message) or mentions_form)
    ):
        try:
            dispute_form = DisputeForm(**build_dispute_form(session.user_id))
        except (FormError, ActionNotAllowed):
            # No accounts, no recent charges, or the action is switched off.
            # The model's own reply already covers it.
            dispute_form = None

    # When a form was issued, the form itself is the confirmation surface: the
    # customer confirms by submitting the specifics they picked.
    pending = None
    if dispute_form is None and candidates and requires_confirmation("create_dispute"):
        top = candidates[0]
        pending = PendingConfirmation(
            action="create_dispute",
            transactionIds=top.transactionIds,
            merchant=top.merchant,
            amountCents=top.amountCents,
            # Confirmation names the specifics, not a summary of them.
            detail=(
                f"Open a dispute for one {top.merchant} charge of "
                f"{_dollars(top.amountCents)}, posted {top.minutesApart} minutes after "
                f"an identical charge."
            ),
        )
    session.pending_confirmation = pending.model_dump() if pending else None

    tool_names = [name for name, _ in tool_results]
    now = datetime.now(timezone.utc).isoformat()
    return ChatResponse(
        message=result.output,
        sessionId=session.session_id,
        duplicateCandidates=candidates,
        disputeForm=dispute_form,
        fraudTriage=triage_form,
        pendingConfirmation=pending,
        toolsUsed=tool_names,
        # Provenance for the app: which services this turn's figures came from.
        # An answer with no tool behind it has an empty list, which the app checks.
        sourcedFrom=tool_names,
        routedAs=route,
        routedBy=decided_by,
        toolTraces=[
            ToolTraceOut(id=f"{session.session_id}-{index}", name=name, timestamp=now)
            for index, name in enumerate(tool_names)
        ],
        policyConfigVersion=CONFIG_VERSION,
    )
