"""Unfamiliar-charge triage and fraud claims.

An unfamiliar merchant name is not proof of theft. A merchant may bill under a
different name, or someone in the household may have used the card. So the flow
asks before it acts:

    identify charge -> "did you make this?" -> secure the card if needed
        -> open a claim -> show status

Only the "I don't recognise it" answer leads anywhere. The other two end the
flow with an explanation and no case, which is the honest outcome.

Nothing here promises a refund. A provisional credit is a decision the bank
makes during the investigation, and it can be taken back.
"""
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db
from policy.actions import CONFIG_VERSION, check_enabled
from services.card_service import card_for_account, describe, get_cards_for_user
from services.dispute_service import create_dispute, disputed_transaction_ids
from services.transaction_service import get_transactions_for_user

TRIAGE_TTL = timedelta(minutes=30)
CHARGE_LOOKBACK = timedelta(days=90)
MAX_CHARGES_OFFERED = 30
NOT_DISPUTABLE_TYPES = {"transfer_out", "transfer_in", "dispute_reversal", "provisional_credit"}

STATUS_ISSUED = "issued"
STATUS_USED = "used"

# What the customer can answer, and what each answer means for the flow.
RECOGNITION_OPTIONS = [
    {
        "value": "i_made_it",
        "label": "Yes, I made this purchase",
        "opensClaim": False,
        "outcome": "Nothing further is needed. Merchants sometimes bill under a different name.",
    },
    {
        "value": "household",
        "label": "Someone with access to my card may have",
        "opensClaim": False,
        "outcome": "Check with them first. A charge someone in your household made is not fraud.",
    },
    {
        "value": "not_recognised",
        "label": "No, I do not recognise this charge",
        "opensClaim": True,
        "outcome": "We can protect the card and open a fraud claim for the bank to investigate.",
    },
]
RECOGNITION_BY_VALUE = {option["value"]: option for option in RECOGNITION_OPTIONS}

# What the customer may choose to do with the card, in plain language.
CARD_ACTIONS = [
    {"value": "none", "label": "Leave my card as it is for now"},
    {"value": "lock", "label": "Block this card against new charges"},
    {"value": "replace", "label": "Cancel it and send me a replacement"},
]
CARD_ACTION_VALUES = {action["value"] for action in CARD_ACTIONS}

# Said in the form itself, so the wording does not depend on the model.
INVESTIGATION_NOTICE = (
    "Opening a claim starts an investigation. The bank may place a temporary credit on your "
    "account while it reviews the charge, and that credit can be reversed if the charge turns "
    "out to be yours. Nothing is refunded automatically."
)


class TriageError(Exception):
    """The triage form could not be issued, or a submission did not match one."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value):
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return value if isinstance(value, datetime) else None


def _dollars(cents: int) -> str:
    return f"${abs(cents) / 100:,.2f}"


def _charge_label(row: dict) -> str:
    when = _parse(row.get("createdAt"))
    date_text = when.strftime("%b %d") if when else "date unavailable"
    return f"{row.get('merchant', 'Unknown merchant')} — {_dollars(row['amountCents'])} on {date_text}"


def _recent_charges(user_id: str) -> list[dict]:
    cutoff = _now() - CHARGE_LOOKBACK
    already_claimed = disputed_transaction_ids(user_id)
    charges = []
    for row in get_transactions_for_user(user_id):
        if row.get("status") != "posted" or (row.get("amountCents") or 0) >= 0:
            continue
        if row.get("type") in NOT_DISPUTABLE_TYPES or row["id"] in already_claimed:
            continue
        created = _parse(row.get("createdAt"))
        if created is None or created < cutoff:
            continue
        charges.append(row)
    return charges[:MAX_CHARGES_OFFERED]


def build_triage_form(user_id: str, transaction_id: str | None = None) -> dict:
    """Issue the "did you make this?" form for a charge the customer questions."""
    config_version = check_enabled("start_fraud_triage")

    charges = _recent_charges(user_id)
    if not charges:
        raise TriageError("No recent charges are available to review.")

    # The model may name a charge, but it is only honoured if the customer owns
    # it and it was offered here; otherwise the newest charge leads.
    offered_ids = [row["id"] for row in charges]
    prefill_charge = transaction_id if transaction_id in offered_ids else charges[0]["id"]

    cards = [card for card in get_cards_for_user(user_id) if card.get("status") != "cancelled"]
    prefill_row = next(row for row in charges if row["id"] == prefill_charge)
    suggested_card = card_for_account(user_id, prefill_row.get("accountId"))

    issued_at = _now()
    expires_at = issued_at + TRIAGE_TTL
    form_ref = db.collection("fraudTriageForms").document()
    form_ref.set(
        {
            "userId": user_id,
            "status": STATUS_ISSUED,
            "policyConfigVersion": config_version,
            "createdAt": issued_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "offeredTransactionIds": offered_ids,
            "offeredCardIds": [card["id"] for card in cards],
            "claimId": None,
        }
    )

    return {
        "formId": form_ref.id,
        "title": "Check an unfamiliar charge",
        "description": (
            "A merchant can bill under a name you do not recognise, and someone with access to "
            "your card may have used it. Let us check before anything is blocked."
        ),
        "investigationNotice": INVESTIGATION_NOTICE,
        "expiresAt": expires_at.isoformat(),
        "policyConfigVersion": config_version,
        "fields": [
            {
                "name": "transactionId",
                "label": "Which charge?",
                "type": "select",
                "required": True,
                "prefill": prefill_charge,
                "options": [
                    {
                        "value": row["id"],
                        "label": _charge_label(row),
                        "accountId": row.get("accountId"),
                        "merchant": row.get("merchant"),
                        "amountCents": row["amountCents"],
                        "createdAt": row.get("createdAt"),
                    }
                    for row in charges
                ],
            },
            {
                "name": "recognition",
                "label": "Did you make this purchase?",
                "type": "select",
                "required": True,
                "prefill": None,
                "helpText": "An unfamiliar name on its own does not mean the card was stolen.",
                "options": [
                    {
                        "value": option["value"],
                        "label": option["label"],
                        "opensClaim": option["opensClaim"],
                        "outcome": option["outcome"],
                    }
                    for option in RECOGNITION_OPTIONS
                ],
            },
            {
                "name": "cardAction",
                "label": "Protect the card?",
                "type": "select",
                "required": False,
                "prefill": "none",
                "helpText": "Only needed if you do not recognise the charge.",
                "showWhen": {"recognition": "not_recognised"},
                "options": CARD_ACTIONS,
            },
            {
                "name": "cardId",
                "label": "Which card?",
                "type": "select",
                "required": False,
                "prefill": suggested_card["id"] if suggested_card else None,
                "showWhen": {"recognition": "not_recognised"},
                "options": [
                    {
                        "value": card["id"],
                        # Named to the last four, so a mis-tap is visible first.
                        "label": f"{describe(card)} on {str(card.get('accountId', '')).replace('demo_', '')}",
                        "status": card.get("status"),
                        "accountId": card.get("accountId"),
                    }
                    for card in cards
                ],
            },
            {
                "name": "note",
                "label": "Anything else the investigator should know?",
                "type": "textarea",
                "required": False,
                "prefill": None,
            },
        ],
    }


def load_triage_form(form_id: str, user_id: str) -> dict:
    snapshot = db.collection("fraudTriageForms").document(form_id).get()
    if not snapshot.exists:
        raise TriageError("That form is no longer available. Ask for a new one.")
    form = {"id": snapshot.id, **snapshot.to_dict()}
    if form.get("userId") != user_id:
        raise TriageError("That form is no longer available. Ask for a new one.")
    return form


def submit_triage(
    user_id: str,
    form_id: str,
    transaction_id: str,
    recognition: str,
    card_action: str = "none",
    card_id: str | None = None,
    note: str | None = None,
) -> dict:
    """Act on a triage answer: nothing, or secure the card and open a claim.

    Returns what happened, so the app can render it without inferring anything:
    ``{"outcome": ..., "claim": ..., "card": ...}``.
    """
    form = load_triage_form(form_id, user_id)

    if form.get("status") == STATUS_USED and form.get("claimId"):
        # Idempotent: a second submit returns the claim the first one opened.
        from services.dispute_service import get_dispute

        return {
            "recognition": recognition,
            "outcome": "claim_already_open",
            "claim": get_dispute(form["claimId"], user_id=user_id),
            "card": None,
            "message": "This charge is already in a fraud claim.",
        }

    expires_at = _parse(form.get("expiresAt"))
    if expires_at is None or _now() > expires_at:
        raise TriageError("That form has expired. Ask for a new one.")
    if form.get("policyConfigVersion") != CONFIG_VERSION:
        raise TriageError(
            "The bank's tool configuration changed while this form was open. Ask for a new one."
        )

    option = RECOGNITION_BY_VALUE.get(recognition)
    if option is None:
        raise TriageError(f"Unknown answer: {recognition}")
    if transaction_id not in form.get("offeredTransactionIds", []):
        raise TriageError("That charge was not on the form.")

    # The customer recognises the charge: no claim, no card action, no refund talk.
    if not option["opensClaim"]:
        return {
            "recognition": recognition,
            "outcome": "no_claim",
            "claim": None,
            "card": None,
            "message": option["outcome"],
        }

    if card_action not in CARD_ACTION_VALUES:
        raise TriageError(f"Unknown card action: {card_action}")

    card = None
    if card_action != "none":
        if not card_id:
            raise TriageError("Choose which card to protect.")
        if card_id not in form.get("offeredCardIds", []):
            raise TriageError("That card was not on the form.")
        # Card first: protecting it is the urgent half, and it must not depend
        # on the claim write succeeding.
        from services.card_service import lock_card, replace_card

        card = (
            lock_card(user_id, card_id, reason="unauthorised charge reported")
            if card_action == "lock"
            else replace_card(user_id, card_id, reason="unauthorised charge reported")
        )

    check_enabled("create_fraud_claim")
    claim = create_dispute(
        user_id,
        [transaction_id],
        reason_code="unauthorized",
        note=note,
        form_id=form_id,
    )
    db.collection("disputes").document(claim["id"]).update(
        {
            "claimType": "fraud",
            "recognition": recognition,
            "cardId": card["id"] if card else None,
            "cardAction": card_action,
            "provisionalCreditCents": None,
            "provisionalCreditTransactionId": None,
        }
    )
    db.collection("fraudTriageForms").document(form_id).update(
        {"status": STATUS_USED, "claimId": claim["id"], "usedAt": _now().isoformat()}
    )

    from services.dispute_service import get_dispute

    return {
        "recognition": recognition,
        "outcome": "claim_opened",
        "claim": get_dispute(claim["id"], user_id=user_id),
        "card": card,
        "message": INVESTIGATION_NOTICE,
    }
