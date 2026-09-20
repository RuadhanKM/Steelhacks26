"""Cards, and the two protective actions a customer can take on one.

Locking and replacing are irreversible writes under the policy gate. The agent
never calls them: it can say a card could be locked, but the customer confirms a
named card — "Visa ····4417 on Checking" — and the API does the work.
"""
from datetime import datetime, timezone

from google.cloud import firestore as gcf
from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db
from policy.actions import check_enabled

STATUS_ACTIVE = "active"
STATUS_LOCKED = "locked"
STATUS_CANCELLED = "cancelled"


class CardError(Exception):
    """The card could not be read or changed as asked."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def describe(card: dict) -> str:
    """How a card is named in a confirmation: never just "your card"."""
    return f"{card.get('network', 'Card')} ····{card.get('last4', '????')}"


def get_cards_for_user(user_id: str) -> list[dict]:
    check_enabled("get_cards")
    docs = (
        db.collection("cards").where(filter=FieldFilter("userId", "==", user_id)).stream()
    )
    cards = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    cards.sort(key=lambda card: card["id"])
    return cards


def get_card(user_id: str, card_id: str) -> dict:
    """Read one card, restricted to this customer's own."""
    snapshot = db.collection("cards").document(card_id).get()
    if not snapshot.exists:
        raise CardError(f"No such card: {card_id}")
    card = {"id": snapshot.id, **snapshot.to_dict()}
    if card.get("userId") != user_id:
        # Same message either way: the caller learns nothing about other users.
        raise CardError(f"No such card: {card_id}")
    return card


def _update_card(user_id: str, card_id: str, action: str, changes: dict, allowed_from: tuple[str, ...]) -> dict:
    card_ref = db.collection("cards").document(card_id)

    @gcf.transactional
    def _apply(transaction):
        snapshot = card_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise CardError(f"No such card: {card_id}")
        card = snapshot.to_dict()
        if card.get("userId") != user_id:
            raise CardError(f"No such card: {card_id}")
        if card.get("status") not in allowed_from:
            raise CardError(f"That card is already {card.get('status')}.")
        transaction.update(card_ref, {**changes, "updatedAt": _now()})

    _apply(db.transaction())
    return get_card(user_id, card_id)


def lock_card(user_id: str, card_id: str, reason: str | None = None) -> dict:
    """Block a card against new charges. Reversible by the bank, not by the agent."""
    config_version = check_enabled("lock_card")
    return _update_card(
        user_id,
        card_id,
        "lock_card",
        {
            "status": STATUS_LOCKED,
            "lockedAt": _now(),
            "lockReason": reason,
            "policyConfigVersion": config_version,
        },
        allowed_from=(STATUS_ACTIVE,),
    )


def replace_card(user_id: str, card_id: str, reason: str | None = None) -> dict:
    """Cancel a card for good and order a replacement. Cannot be undone."""
    config_version = check_enabled("replace_card")
    return _update_card(
        user_id,
        card_id,
        "replace_card",
        {
            "status": STATUS_CANCELLED,
            "cancelledAt": _now(),
            "replacementOrdered": True,
            "lockReason": reason,
            "policyConfigVersion": config_version,
        },
        # A locked card can still be cancelled; a cancelled one is final.
        allowed_from=(STATUS_ACTIVE, STATUS_LOCKED),
    )


def card_for_account(user_id: str, account_id: str) -> dict | None:
    """The card attached to an account, if there is one."""
    for card in get_cards_for_user(user_id):
        if card.get("accountId") == account_id:
            return card
    return None
