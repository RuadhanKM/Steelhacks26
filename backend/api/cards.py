"""Card endpoints. The agent never reaches these: the customer confirms a named card."""
from fastapi import APIRouter, Depends, HTTPException

from api.deps import current_session
from models.schemas import CardActionRequest, CardResponse
from policy.actions import ActionNotAllowed, requires_confirmation
from services.card_service import CardError, get_cards_for_user, lock_card, replace_card
from services.session_service import Session

router = APIRouter(tags=["cards"])


def _confirmed(action: str, request: CardActionRequest | None):
    if requires_confirmation(action) and not (request and request.confirmed):
        raise HTTPException(
            status_code=400,
            detail="This action needs the customer's explicit confirmation (confirmed=true).",
        )


@router.get("/cards", response_model=list[CardResponse])
def my_cards(session: Session = Depends(current_session)):
    return get_cards_for_user(session.user_id)


@router.post("/cards/{card_id}/lock", response_model=CardResponse)
def lock(
    card_id: str,
    request: CardActionRequest | None = None,
    session: Session = Depends(current_session),
):
    """Block a card against new charges."""
    _confirmed("lock_card", request)
    try:
        return lock_card(session.user_id, card_id, request.reason if request else None)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except CardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/cards/{card_id}/replace", response_model=CardResponse)
def replace(
    card_id: str,
    request: CardActionRequest | None = None,
    session: Session = Depends(current_session),
):
    """Cancel a card for good and order a replacement."""
    _confirmed("replace_card", request)
    try:
        return replace_card(session.user_id, card_id, request.reason if request else None)
    except ActionNotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except CardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
