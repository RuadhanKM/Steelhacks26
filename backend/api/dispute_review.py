"""Staff review queue: cases awaiting action, and the approve/reject decision."""
from fastapi import APIRouter, Depends, HTTPException

from api.deps import staff_session
from models.schemas import DisputeResponse, ReviewRequest
from policy.actions import ActionNotAllowed
from services.dispute_review_service import (
    ReviewError,
    approve_dispute,
    claim_for_review,
    list_pending_reviews,
    reject_dispute,
)
from services.session_service import Session

router = APIRouter(prefix="/staff", tags=["staff review"])


@router.get("/disputes/pending", response_model=list[DisputeResponse])
def pending_reviews(session: Session = Depends(staff_session)):
    """The staff work queue: submitted and under_review cases, oldest first."""
    return list_pending_reviews()


@router.post("/disputes/{dispute_id}/claim", response_model=DisputeResponse)
def claim(dispute_id: str, session: Session = Depends(staff_session)):
    try:
        return claim_for_review(dispute_id, session.user_id)
    except ReviewError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/disputes/{dispute_id}/approve", response_model=DisputeResponse)
def approve(
    dispute_id: str,
    request: ReviewRequest | None = None,
    session: Session = Depends(staff_session),
):
    """Approve the case: reversal credit and balance update land together."""
    try:
        return approve_dispute(dispute_id, session.user_id, request.note if request else None)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ReviewError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/disputes/{dispute_id}/reject", response_model=DisputeResponse)
def reject(
    dispute_id: str,
    request: ReviewRequest | None = None,
    session: Session = Depends(staff_session),
):
    """Close the case with no credit. The original charges are unchanged."""
    try:
        return reject_dispute(dispute_id, session.user_id, request.note if request else None)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ReviewError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
