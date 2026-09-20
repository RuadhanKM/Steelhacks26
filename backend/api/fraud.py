"""Unfamiliar-charge triage: ask before blocking anything or opening a claim."""
from fastapi import APIRouter, Depends, HTTPException

from api.deps import current_session
from models.schemas import TriageForm, TriageRequest, TriageResult
from policy.actions import ActionNotAllowed, requires_confirmation
from services.card_service import CardError
from services.dispute_service import DisputeError
from services.fraud_service import TriageError, build_triage_form, submit_triage
from services.session_service import Session

router = APIRouter(tags=["fraud"])


@router.post("/fraud/triage", response_model=TriageForm)
def start_triage(transaction_id: str | None = None, session: Session = Depends(current_session)):
    """Issue the "did you make this?" form, optionally focused on one charge."""
    try:
        return build_triage_form(session.user_id, transaction_id)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TriageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/fraud/triage/{form_id}", response_model=TriageResult)
def answer_triage(
    form_id: str,
    request: TriageRequest,
    session: Session = Depends(current_session),
):
    """Act on the answer: nothing, or secure the card and open a fraud claim.

    Recognising the charge ends the flow. Only "I do not recognise this"
    opens a claim, and only then does a card action apply.
    """
    opens_claim = request.recognition == "not_recognised"
    if opens_claim and requires_confirmation("create_fraud_claim") and not request.confirmed:
        raise HTTPException(
            status_code=400,
            detail="This action needs the customer's explicit confirmation (confirmed=true).",
        )
    try:
        return submit_triage(
            session.user_id,
            form_id,
            request.transactionId,
            request.recognition,
            request.cardAction,
            request.cardId,
            request.note,
        )
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (TriageError, CardError, DisputeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
