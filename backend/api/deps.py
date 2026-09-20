"""Shared request dependencies: who is asking, and may they act as staff."""
from fastapi import Depends, Header, HTTPException

from services.session_service import InvalidSession, Session, resolve_session


def current_session(
    authorization: str | None = Header(default=None),
    x_session_id: str | None = Header(default=None),
) -> Session:
    try:
        return resolve_session(authorization, x_session_id)
    except InvalidSession as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def staff_session(session: Session = Depends(current_session)) -> Session:
    if not session.is_staff:
        raise HTTPException(status_code=403, detail="Staff session required.")
    return session
