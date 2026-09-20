"""Dispute intake forms, built by the server from the customer's own data.

The agent recognises dispute intent and asks for a form; it does not choose the
account, the charges, or the amounts. Everything offered here comes from the
account services, so the customer picks from real data and the model never
sources a figure.

An issued form is recorded in Firestore with exactly what was offered. A
submission is checked against that record, so a charge that was never on the
form cannot be submitted, a form cannot be reused to open a second case, and a
form issued under an older tool configuration is reissued rather than honoured.
Firestore rather than the in-memory session, so a server reload mid-demo does
not invalidate a form the customer is still filling in.
"""
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db
from policy.actions import CONFIG_VERSION, check_enabled
from services.account_service import get_accounts_for_user
from services.dispute_service import disputed_transaction_ids
from services.transaction_service import find_possible_duplicates, get_transactions_for_user

FORM_TTL = timedelta(minutes=30)
# How far back the charge picker looks, and how many charges it offers.
CHARGE_LOOKBACK = timedelta(days=90)
MAX_CHARGES_OFFERED = 30
# Money the customer moved themselves, and credits back from a past case.
NOT_DISPUTABLE_TYPES = {"transfer_out", "transfer_in", "dispute_reversal"}

STATUS_ISSUED = "issued"
STATUS_USED = "used"

REASON_CODES = [
    {
        "value": "duplicate_charge",
        "label": "I was charged more than once for the same purchase",
        "chargesRequired": 2,
    },
    {"value": "unauthorized", "label": "I did not authorise this charge", "chargesRequired": 1},
    {"value": "wrong_amount", "label": "The amount is wrong", "chargesRequired": 1},
    {"value": "goods_not_received", "label": "I never received what I paid for", "chargesRequired": 1},
]
REASON_BY_VALUE = {code["value"]: code for code in REASON_CODES}


class FormError(Exception):
    """A form could not be issued, or a submission did not match the form issued."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(value) -> datetime | None:
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


def build_dispute_form(user_id: str) -> dict:
    """Issue an intake form listing this customer's accounts and recent charges."""
    config_version = check_enabled("start_dispute_form")

    accounts = get_accounts_for_user(user_id)
    if not accounts:
        raise FormError("This customer has no accounts to dispute a charge on.")

    cutoff = _now() - CHARGE_LOOKBACK
    # A charge already in a case cannot be disputed again, so it is not offered.
    # Without this the form keeps proposing charges that were already credited.
    already_disputed = disputed_transaction_ids(user_id)
    charges = []
    for row in get_transactions_for_user(user_id):
        if row.get("status") != "posted" or (row.get("amountCents") or 0) >= 0:
            continue
        if row["id"] in already_disputed:
            continue
        # A transfer between the customer's own accounts is not a merchant
        # charge, so there is nothing to dispute about it.
        if row.get("type") in NOT_DISPUTABLE_TYPES:
            continue
        created = _parse(row.get("createdAt"))
        if created is None or created < cutoff:
            continue
        charges.append(row)
    charges = charges[:MAX_CHARGES_OFFERED]
    if not charges:
        if already_disputed:
            raise FormError(
                "Every recent charge is already in a dispute case. Check the status of those "
                "cases, or contact a banker about a charge that is not listed."
            )
        raise FormError("No recent posted charges are available to dispute.")

    # Prefill from the duplicate finder so the common case is one tap, while the
    # customer stays free to pick different charges.
    candidates = find_possible_duplicates(user_id)
    prefill_ids: list[str] = []
    prefill_account: str | None = None
    prefill_reason: str | None = None
    if candidates:
        top = candidates[0]
        offered = {row["id"] for row in charges}
        if set(top["transactionIds"]) <= offered:
            prefill_ids = top["transactionIds"]
            prefill_account = top["accountId"]
            prefill_reason = "duplicate_charge"

    issued_at = _now()
    expires_at = issued_at + FORM_TTL
    form_ref = db.collection("disputeForms").document()
    form_ref.set(
        {
            "userId": user_id,
            "status": STATUS_ISSUED,
            "policyConfigVersion": config_version,
            "createdAt": issued_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            # Exactly what was offered, so a submission can be checked against it.
            "offeredAccountIds": [account["id"] for account in accounts],
            "offeredTransactionIds": [row["id"] for row in charges],
            "disputeId": None,
        }
    )

    return {
        "formId": form_ref.id,
        "title": "Dispute a charge",
        "description": (
            "Pick the account and the charges you want reviewed. Submitting opens a case "
            "for a banker to look at; it does not reverse anything on its own."
        ),
        "expiresAt": expires_at.isoformat(),
        "policyConfigVersion": config_version,
        "fields": [
            {
                "name": "accountId",
                "label": "Which account?",
                "type": "select",
                "required": True,
                "prefill": prefill_account or accounts[0]["id"],
                "options": [
                    {
                        "value": account["id"],
                        "label": f"{str(account.get('type', 'account')).title()} — {_dollars(account.get('balanceCents', 0))}",
                    }
                    for account in accounts
                ],
            },
            {
                "name": "reasonCode",
                "label": "What went wrong?",
                "type": "select",
                "required": True,
                "prefill": prefill_reason,
                "options": [
                    {"value": code["value"], "label": code["label"], "chargesRequired": code["chargesRequired"]}
                    for code in REASON_CODES
                ],
            },
            {
                "name": "transactionIds",
                "label": "Which charges?",
                "type": "multiselect",
                "required": True,
                "prefill": prefill_ids,
                "helpText": "For a double charge, select both charges.",
                "options": [
                    {
                        "value": row["id"],
                        "label": _charge_label(row),
                        "accountId": row.get("accountId"),
                        "merchant": row.get("merchant"),
                        "amountCents": row["amountCents"],
                        "createdAt": row.get("createdAt"),
                        "isDuplicateCandidate": row["id"] in prefill_ids,
                    }
                    for row in charges
                ],
            },
            {
                "name": "contactedMerchant",
                "label": "Have you contacted the merchant?",
                "type": "boolean",
                "required": False,
                "prefill": False,
                "helpText": "Not required, but it usually speeds up the review.",
            },
            {
                "name": "note",
                "label": "Anything else the reviewer should know?",
                "type": "textarea",
                "required": False,
                "prefill": None,
            },
        ],
    }


def load_form(form_id: str, user_id: str) -> dict:
    snapshot = db.collection("disputeForms").document(form_id).get()
    if not snapshot.exists:
        raise FormError("That dispute form is no longer available. Ask for a new one.")
    form = {"id": snapshot.id, **snapshot.to_dict()}
    if form.get("userId") != user_id:
        # Same message as a missing form: the caller learns nothing about others.
        raise FormError("That dispute form is no longer available. Ask for a new one.")
    return form


def validate_submission(
    user_id: str, form_id: str, account_id: str, transaction_ids: list[str], reason_code: str
) -> dict:
    """Check a submission against the form that was issued. Returns the form record."""
    form = load_form(form_id, user_id)

    if form.get("status") == STATUS_USED:
        # Idempotent: a double tap on Submit returns the case already opened.
        return form

    expires_at = _parse(form.get("expiresAt"))
    if expires_at is None or _now() > expires_at:
        raise FormError("That dispute form has expired. Ask for a new one.")

    if form.get("policyConfigVersion") != CONFIG_VERSION:
        raise FormError(
            "The bank's tool configuration changed while this form was open. Ask for a new one."
        )

    reason = REASON_BY_VALUE.get(reason_code)
    if reason is None:
        raise FormError(f"Unknown reason code: {reason_code}")

    if account_id not in form.get("offeredAccountIds", []):
        raise FormError("That account was not on the form.")

    unique_ids = list(dict.fromkeys(transaction_ids))
    offered = set(form.get("offeredTransactionIds", []))
    not_offered = [txn_id for txn_id in unique_ids if txn_id not in offered]
    if not_offered:
        raise FormError(f"These charges were not on the form: {', '.join(not_offered)}")

    required = reason["chargesRequired"]
    if reason_code == "duplicate_charge" and len(unique_ids) != 2:
        raise FormError("Select both charges for a duplicate-charge dispute.")
    if len(unique_ids) < required:
        raise FormError(f"Select at least {required} charge for this reason.")

    return form


def mark_form_used(form_id: str, dispute_id: str) -> None:
    db.collection("disputeForms").document(form_id).update(
        {"status": STATUS_USED, "disputeId": dispute_id, "usedAt": _now().isoformat()}
    )


def find_open_form_dispute(form_id: str) -> str | None:
    """The case a used form already opened, if any."""
    snapshot = db.collection("disputeForms").document(form_id).get()
    return snapshot.to_dict().get("disputeId") if snapshot.exists else None


def expire_stale_forms(user_id: str) -> int:
    """Housekeeping for the demo: drop this user's expired, unused forms."""
    docs = (
        db.collection("disputeForms")
        .where(filter=FieldFilter("userId", "==", user_id))
        .where(filter=FieldFilter("status", "==", STATUS_ISSUED))
        .stream()
    )
    removed = 0
    for doc in docs:
        expires_at = _parse(doc.to_dict().get("expiresAt"))
        if expires_at is not None and _now() > expires_at:
            doc.reference.delete()
            removed += 1
    return removed
