from fastapi import APIRouter, Depends, HTTPException

from api.deps import current_session
from services.account_service import get_accounts_for_user
from services.session_service import Session

router = APIRouter(tags=["accounts"])


@router.get("/users/{user_id}/accounts")
def list_user_accounts(user_id: str, session: Session = Depends(current_session)):
    """A customer's accounts. The path names whose, the session decides if you may.

    Customers may only read their own; staff review cases and have no reason to
    pull balances, so they are refused here too.
    """
    if user_id != session.user_id:
        # Same answer whether the user exists or not.
        raise HTTPException(status_code=404, detail="No accounts found.")
    return get_accounts_for_user(session.user_id)


@router.get("/accounts")
def my_accounts(session: Session = Depends(current_session)):
    """The signed-in customer's own accounts, without naming them in the path."""
    return get_accounts_for_user(session.user_id)
