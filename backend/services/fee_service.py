"""Fee waiver requests: asking the bank to refund a fee it charged.

This is not a dispute. The charge is the bank's own and is not in doubt — the
customer is asking for a courtesy. So the flow says so plainly:

    pick the fee -> say why -> submit a request -> a banker decides

Nothing here waives anything. A request opens a case with the same review
pipeline as a dispute, and only staff approval moves money. The assistant must
never say a fee will be refunded, because that is not its call to make.

Eligibility is reported, not enforced: how many waivers this customer has had in
the last twelve months goes on the case so the reviewer can weigh it. A rule
that silently refuses would be worse than a human saying no with a reason.
"""
from datetime import datetime, timedelta, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db
from policy.actions import CONFIG_VERSION, check_enabled
from services.dispute_service import create_dispute, disputed_transaction_ids, get_dispute
from services.transaction_service import get_transactions_for_user

FORM_TTL = timedelta(minutes=30)
FEE_LOOKBACK = timedelta(days=180)
# What the bank's courtesy policy considers normal in a rolling year. Exceeding
# it does not block a request; it is context for the reviewer.
COURTESY_WAIVERS_PER_YEAR = 2

STATUS_ISSUED = "issued"
STATUS_USED = "used"

FEE_LABELS = {
    "overdraft_fee": "Overdraft fee",
    "monthly_maintenance_fee": "Monthly maintenance fee",
    "late_payment_fee": "Late payment fee",
}

# Why a customer asks. The reviewer sees this verbatim.
WAIVER_REASONS = [
    {"value": "first_time", "label": "This is the first time it has happened"},
    {"value": "deposit_timing", "label": "A deposit had not landed yet"},
    {"value": "bank_error", "label": "I think the fee was charged in error"},
    {"value": "hardship", "label": "I am going through financial hardship"},
    {"value": "long_standing", "label": "I have been a customer a long time"},
]
REASON_VALUES = {reason["value"] for reason in WAIVER_REASONS}

# Said by the form, not by the model, so the promise cannot drift.
DECISION_NOTICE = (
    "This sends a request to a banker, who decides whether the fee is refunded. "
    "It is not automatic, and nothing is credited until they approve it."
)


class FeeWaiverError(Exception):
    """The form could not be issued, or a submission did not match one."""


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


def waivable_fees(user_id: str) -> list[dict]:
    """Fees this customer was charged that are not already in a case."""
    already_claimed = disputed_transaction_ids(user_id)
    cutoff = _now() - FEE_LOOKBACK
    fees = []
    for row in get_transactions_for_user(user_id):
        if row.get("type") != "fee" or row.get("status") != "posted":
            continue
        if row["id"] in already_claimed:
            continue
        charged_at = _parse(row.get("createdAt"))
        if charged_at is None or charged_at < cutoff:
            continue
        fees.append(row)
    return fees


def waivers_in_last_year(user_id: str) -> int:
    """How many fee waivers this customer has already been granted."""
    docs = (
        db.collection("disputes")
        .where(filter=FieldFilter("userId", "==", user_id))
        .where(filter=FieldFilter("reason", "==", "fee_waiver"))
        .stream()
    )
    cutoff = _now() - timedelta(days=365)
    granted = 0
    for doc in docs:
        case = doc.to_dict()
        if case.get("status") != "resolved":
            continue
        decided_at = _parse(case.get("reviewedAt") or case.get("createdAt"))
        if decided_at is None or decided_at >= cutoff:
            granted += 1
    return granted


def build_fee_waiver_form(user_id: str) -> dict:
    """Issue the request form, built from fees this customer actually paid."""
    config_version = check_enabled("start_fee_waiver_form")

    fees = waivable_fees(user_id)
    if not fees:
        raise FeeWaiverError(
            "No bank fees are showing on this account in the last six months that could be "
            "refunded. A charge from a merchant is a different kind of request."
        )

    granted = waivers_in_last_year(user_id)
    issued_at = _now()
    expires_at = issued_at + FORM_TTL
    form_ref = db.collection("feeWaiverForms").document()
    form_ref.set(
        {
            "userId": user_id,
            "status": STATUS_ISSUED,
            "policyConfigVersion": config_version,
            "createdAt": issued_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "offeredTransactionIds": [row["id"] for row in fees],
            "waiversGrantedLastYear": granted,
            "caseId": None,
        }
    )

    return {
        "formId": form_ref.id,
        "title": "Ask us to refund a fee",
        "description": (
            "Pick the fee and tell us why. A banker reviews the request and decides."
        ),
        "decisionNotice": DECISION_NOTICE,
        "waiversGrantedLastYear": granted,
        "courtesyPerYear": COURTESY_WAIVERS_PER_YEAR,
        "expiresAt": expires_at.isoformat(),
        "policyConfigVersion": config_version,
        "fields": [
            {
                "name": "transactionId",
                "label": "Which fee?",
                "type": "select",
                "required": True,
                "prefill": fees[0]["id"],
                "options": [
                    {
                        "value": row["id"],
                        "label": (
                            f"{FEE_LABELS.get(row.get('feeKind'), row.get('merchant', 'Fee'))} — "
                            f"{_dollars(row['amountCents'])}"
                            + (f" on {_parse(row['createdAt']):%b %d}" if _parse(row.get("createdAt")) else "")
                        ),
                        "merchant": FEE_LABELS.get(row.get("feeKind"), row.get("merchant")),
                        "amountCents": row["amountCents"],
                        "createdAt": row.get("createdAt"),
                        "accountId": row.get("accountId"),
                    }
                    for row in fees
                ],
            },
            {
                "name": "reasonCode",
                "label": "Why should we look at it?",
                "type": "select",
                "required": True,
                "prefill": None,
                "options": [
                    {"value": reason["value"], "label": reason["label"]} for reason in WAIVER_REASONS
                ],
            },
            {
                "name": "note",
                "label": "Anything else the banker should know?",
                "type": "textarea",
                "required": False,
                "prefill": None,
            },
        ],
    }


def load_form(form_id: str, user_id: str) -> dict:
    snapshot = db.collection("feeWaiverForms").document(form_id).get()
    if not snapshot.exists:
        raise FeeWaiverError("That request form is no longer available. Ask for a new one.")
    form = {"id": snapshot.id, **snapshot.to_dict()}
    if form.get("userId") != user_id:
        raise FeeWaiverError("That request form is no longer available. Ask for a new one.")
    return form


def submit_fee_waiver(
    user_id: str, form_id: str, transaction_id: str, reason_code: str, note: str | None = None
) -> dict:
    """Open a fee waiver case. Money moves only when staff approve it."""
    form = load_form(form_id, user_id)

    if form.get("status") == STATUS_USED and form.get("caseId"):
        # Idempotent: a second submit returns the case the first one opened.
        return get_dispute(form["caseId"], user_id=user_id)

    expires_at = _parse(form.get("expiresAt"))
    if expires_at is None or _now() > expires_at:
        raise FeeWaiverError("That request form has expired. Ask for a new one.")
    if form.get("policyConfigVersion") != CONFIG_VERSION:
        raise FeeWaiverError(
            "The bank's tool configuration changed while this form was open. Ask for a new one."
        )
    if reason_code not in REASON_VALUES:
        raise FeeWaiverError(f"Unknown reason: {reason_code}")
    if transaction_id not in form.get("offeredTransactionIds", []):
        raise FeeWaiverError("That fee was not on the form.")

    config_version = check_enabled("request_fee_waiver")
    case = create_dispute(
        user_id,
        [transaction_id],
        reason_code="fee_waiver",
        note=note,
        form_id=form_id,
    )
    granted = form.get("waiversGrantedLastYear", 0)
    db.collection("disputes").document(case["id"]).update(
        {
            "claimType": "fee_waiver",
            "feeWaiverReason": reason_code,
            # Context for the reviewer, not a rule that refused anyone.
            "waiversGrantedLastYear": granted,
            "withinCourtesyPolicy": granted < COURTESY_WAIVERS_PER_YEAR,
            "requestPolicyConfigVersion": config_version,
        }
    )
    db.collection("feeWaiverForms").document(form_id).update(
        {"status": STATUS_USED, "caseId": case["id"], "usedAt": _now().isoformat()}
    )
    return get_dispute(case["id"], user_id=user_id)
