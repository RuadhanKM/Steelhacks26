"""Server-side session state. Identity is inherited from here, never asserted by the agent.

The app signs the customer in with Firebase and sends the resulting ID token.
This module verifies that token with the Admin SDK and hands back a session; the
agent and its tools only ever see the session. Nothing in a request body, and no
model output, can change whose data is read.

Which customer a Firebase account maps to is mocked for the demo: every signed-in
account maps to the same synthetic customer, per the build scope in the brief.
The shape is what matters — the mapping happens server-side, once, at the edge.
"""
import os
from dataclasses import dataclass, field

from firebase_admin import auth

# Every authenticated Firebase account maps to this synthetic customer.
DEMO_USER_ID = os.environ.get("DEMO_USER_ID", "demo_user_01")

# Accounts that review disputes instead of owning them. Set STAFF_EMAILS in
# backend/.env as a comma-separated list. Membership is decided here, from the
# verified token's email — never from anything the client sends.
STAFF_EMAILS = {
    email.strip().lower()
    for email in os.environ.get("STAFF_EMAILS", "").split(",")
    if email.strip()
}

DEMO_SESSION_ID = "demo_session_01"
STAFF_SESSION_ID = "demo_staff_session_01"


@dataclass
class Session:
    session_id: str
    user_id: str
    is_staff: bool = False
    firebase_uid: str | None = None
    email: str | None = None
    # Pending confirmations live with the session and expire with it; silence is never consent.
    pending_confirmation: dict | None = None
    history: list = field(default_factory=list)


_SESSIONS: dict[str, Session] = {
    DEMO_SESSION_ID: Session(session_id=DEMO_SESSION_ID, user_id=DEMO_USER_ID),
    STAFF_SESSION_ID: Session(session_id=STAFF_SESSION_ID, user_id="demo_staff_01", is_staff=True),
}


class InvalidSession(Exception):
    pass


def get_session(session_id: str | None) -> Session:
    """Return the session for this id, defaulting to the demo customer session."""
    session = _SESSIONS.get(session_id or DEMO_SESSION_ID)
    if session is None:
        raise InvalidSession(f"Unknown session: {session_id}")
    return session


def session_for_firebase_token(id_token: str) -> Session:
    """Verify a Firebase ID token and return that account's session, creating it once."""
    try:
        claims = auth.verify_id_token(id_token)
    except Exception as exc:  # expired, malformed, wrong project, revoked
        raise InvalidSession("Your session has expired. Please sign in again.") from exc

    uid = claims["uid"]
    session_id = f"firebase:{uid}"
    session = _SESSIONS.get(session_id)
    if session is None:
        email = claims.get("email")
        # Staff review disputes rather than owning them, so a staff session gets
        # its own id and never maps to the synthetic customer's data.
        is_staff = bool(email) and email.lower() in STAFF_EMAILS
        session = Session(
            session_id=session_id,
            user_id=f"staff:{email}" if is_staff else DEMO_USER_ID,
            is_staff=is_staff,
            firebase_uid=uid,
            email=email,
        )
        _SESSIONS[session_id] = session
    return session


# A verified Firebase token is required by default. The X-Session-Id fallback is
# a local development convenience — it lets /docs and scripts act as the demo
# customer or a reviewer — and must be switched on deliberately with
# ALLOW_DEMO_SESSIONS=1 in backend/.env. It is never set on a deployed instance:
# without a token, anyone with the URL could read the customer's data and pass
# X-Session-Id: demo_staff_session_01 to act as staff.
ALLOW_DEMO_SESSIONS = os.environ.get("ALLOW_DEMO_SESSIONS", "").lower() in {"1", "true", "yes"}


def resolve_session(authorization: str | None, x_session_id: str | None) -> Session:
    """Pick the session for a request: a Firebase token, or a demo id in local dev."""
    if authorization and authorization.lower().startswith("bearer "):
        return session_for_firebase_token(authorization.split(" ", 1)[1].strip())
    if ALLOW_DEMO_SESSIONS:
        return get_session(x_session_id)
    raise InvalidSession("Sign in to continue.")
