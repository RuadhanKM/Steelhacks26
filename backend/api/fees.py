"""Fee waiver endpoints. The agent issues the form; only the customer submits it."""
from fastapi import APIRouter, Depends, HTTPException

from api.deps import current_session
from models.schemas import DisputeResponse, FeeWaiverForm, FeeWaiverRequest
from policy.actions import ActionNotAllowed, requires_confirmation
from services.dispute_service import DisputeError
from services.fee_service import FeeWaiverError, build_fee_waiver_form, submit_fee_waiver
from services.session_service import Session

router = APIRouter(tags=["fees"])


@router.post("/fees/waiver-form", response_model=FeeWaiverForm)
def request_waiver_form(session: Session = Depends(current_session)):
    """Issue the request form, listing fees this customer actually paid."""
    try:
        return build_fee_waiver_form(session.user_id)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except FeeWaiverError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/fees/waiver-requests", response_model=DisputeResponse, status_code=201)
def submit_waiver(request: FeeWaiverRequest, session: Session = Depends(current_session)):
    """Open a fee waiver case. A banker decides; nothing is refunded here."""
    if requires_confirmation("request_fee_waiver") and not request.confirmed:
        raise HTTPException(
            status_code=400,
            detail="This action needs the customer's explicit confirmation (confirmed=true).",
        )
    try:
        return submit_fee_waiver(
            session.user_id,
            request.formId,
            request.transactionId,
            request.reasonCode,
            request.note,
        )
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (FeeWaiverError, DisputeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
