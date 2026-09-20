"""Who am I: lets a client render the right screen without guessing at identity.

The answer is derived from the verified token server-side. A client cannot ask
to be staff; it can only be told that it is.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import current_session
from policy.actions import CONFIG_VERSION
from services.session_service import Session

router = APIRouter(tags=["session"])


class SessionInfo(BaseModel):
    sessionId: str
    userId: str
    email: str | None = None
    isStaff: bool
    policyConfigVersion: str


@router.get("/session", response_model=SessionInfo)
def whoami(session: Session = Depends(current_session)):
    return SessionInfo(
        sessionId=session.session_id,
        userId=session.user_id,
        email=session.email,
        isStaff=session.is_staff,
        policyConfigVersion=CONFIG_VERSION,
    )
