"""Dispute case endpoints: the customer submits after confirming, then checks status."""
from fastapi import APIRouter, Depends, HTTPException

from api.deps import current_session
from models.schemas import CreateDisputeRequest, DisputeForm, DisputeResponse
from policy.actions import ActionNotAllowed, requires_confirmation
from services.dispute_form_service import (
    FormError,
    build_dispute_form,
    mark_form_used,
    validate_submission,
)
from services.dispute_service import DisputeError, create_dispute, get_dispute, list_disputes_for_user
from services.session_service import Session

router = APIRouter(tags=["disputes"])


@router.post("/disputes", response_model=DisputeResponse, status_code=201)
def submit_dispute(request: CreateDisputeRequest, session: Session = Depends(current_session)):
    """Open a case from a submitted intake form.

    The agent never reaches this route. The customer submitting the form they
    filled in is the confirmation, and it names specifics rather than agreeing
    to a summary.
    """
    if requires_confirmation("create_dispute") and not request.confirmed:
        raise HTTPException(
            status_code=400,
            detail="This action needs the customer's explicit confirmation (confirmed=true).",
        )

    form = None
    if request.formId:
        if not request.accountId:
            raise HTTPException(status_code=400, detail="accountId is required with a form submission.")
        try:
            form = validate_submission(
                session.user_id,
                request.formId,
                request.accountId,
                request.transactionIds,
                request.reasonCode,
            )
        except FormError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        # A form already used returns the case it opened, so a double tap on
        # Submit does not open a second case.
        if form.get("status") == "used" and form.get("disputeId"):
            try:
                return get_dispute(form["disputeId"], user_id=session.user_id)
            except DisputeError as exc:
                raise HTTPException(status_code=404, detail=str(exc)) from exc

    try:
        # user_id comes from the session; the request body says which charges, not whose.
        case = create_dispute(
            session.user_id,
            request.transactionIds,
            reason_code=request.reasonCode,
            note=request.note,
            contacted_merchant=request.contactedMerchant,
            form_id=request.formId,
        )
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DisputeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if form is not None:
        mark_form_used(request.formId, case["id"])
    return case


@router.post("/disputes/form", response_model=DisputeForm)
def request_dispute_form(session: Session = Depends(current_session)):
    """Issue an intake form directly, without a chat turn.

    Same form the agent hands back, for a "Dispute a charge" button or for
    testing the flow with no model in the loop.
    """
    try:
        return build_dispute_form(session.user_id)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except FormError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/disputes", response_model=list[DisputeResponse])
def my_disputes(session: Session = Depends(current_session)):
    return list_disputes_for_user(session.user_id)


@router.get("/disputes/{dispute_id}", response_model=DisputeResponse)
def dispute_status(dispute_id: str, session: Session = Depends(current_session)):
    try:
        # Staff may read any case; a customer only their own.
        return get_dispute(dispute_id, user_id=None if session.is_staff else session.user_id)
    except DisputeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
