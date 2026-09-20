from fastapi import APIRouter

from services.account_service import get_accounts_for_user

router = APIRouter(tags=["accounts"])


@router.get("/users/{user_id}/accounts")
def list_user_accounts(user_id: str):
    return get_accounts_for_user(user_id)
