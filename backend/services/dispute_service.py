"""Dispute cases. Creating one is an irreversible write and runs through the policy gate."""
from datetime import datetime, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db
from policy.actions import check_enabled
from services.transaction_service import get_transactions_by_ids

# Case lifecycle. A case is open until staff resolve or reject it.
STATUS_SUBMITTED = "submitted"
STATUS_UNDER_REVIEW = "under_review"
STATUS_RESOLVED = "resolved"
STATUS_REJECTED = "rejected"
OPEN_STATUSES = (STATUS_SUBMITTED, STATUS_UNDER_REVIEW)


class DisputeError(Exception):
    """A dispute could not be created or read as asked."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_dispute(
    user_id: str,
    transaction_ids: list[str],
    reason_code: str = "duplicate_charge",
    note: str | None = None,
    contacted_merchant: bool | None = None,
    form_id: str | None = None,
) -> dict:
    """Open a case for charges the user confirmed. Returns the stored case.

    Every charge must belong to this user, and a charge already inside an open
    case cannot be submitted again — a customer pressing confirm twice gets one
    case back, not two.
    """
    config_version = check_enabled("create_dispute")

    unique_ids = list(dict.fromkeys(transaction_ids))
    if not unique_ids:
        raise DisputeError("Select at least one charge to dispute.")
    if reason_code == "duplicate_charge" and len(unique_ids) != 2:
        raise DisputeError("A duplicate-charge dispute needs two distinct transactions.")

    owned = get_transactions_by_ids(user_id, unique_ids)
    owned_ids = {row["id"] for row in owned}
    missing = [txn_id for txn_id in unique_ids if txn_id not in owned_ids]
    if missing:
        # Same message whether the charge is absent or belongs to someone else:
        # the caller learns nothing about other users' data.
        raise DisputeError(f"Not your transaction, or it does not exist: {', '.join(missing)}")

    existing = find_open_dispute_for_transactions(user_id, unique_ids)
    if existing is not None:
        raise DisputeError(
            f"These charges are already in case {existing['id']} ({existing['status']})."
        )

    amounts = {row["amountCents"] for row in owned}
    merchants = {row.get("merchant") for row in owned}
    if reason_code == "duplicate_charge":
        # The amount at stake is one charge, not the sum: the customer is asking
        # to be put back where they would have been with a single purchase.
        claimed_cents = abs(min(amounts)) if len(amounts) == 1 else None
    else:
        claimed_cents = abs(sum(row["amountCents"] for row in owned))

    doc_ref = db.collection("disputes").document()
    case = {
        "userId": user_id,
        "transactionIds": unique_ids,
        "status": STATUS_SUBMITTED,
        "reason": reason_code,
        "note": note,
        "contactedMerchant": contacted_merchant,
        "formId": form_id,
        "merchant": next(iter(merchants)) if len(merchants) == 1 else None,
        "claimedAmountCents": claimed_cents,
        "accountId": owned[0].get("accountId"),
        "policyConfigVersion": config_version,
        "createdAt": _now(),
        "updatedAt": _now(),
        "reviewedBy": None,
        "reviewedAt": None,
        "reviewNote": None,
        "reversalTransactionId": None,
    }
    doc_ref.set(case)
    return {"id": doc_ref.id, **case}


def find_open_dispute_for_transactions(user_id: str, transaction_ids: list[str]) -> dict | None:
    """Return this user's open case covering any of these charges, if one exists."""
    wanted = set(transaction_ids)
    docs = (
        db.collection("disputes")
        .where(filter=FieldFilter("userId", "==", user_id))
        .where(filter=FieldFilter("status", "in", list(OPEN_STATUSES)))
        .stream()
    )
    for doc in docs:
        case = doc.to_dict()
        if wanted & set(case.get("transactionIds", [])):
            return {"id": doc.id, **case}
    return None


def get_dispute(dispute_id: str, user_id: str | None = None) -> dict:
    """Read one case. Pass user_id to restrict it to that customer's own cases."""
    snapshot = db.collection("disputes").document(dispute_id).get()
    if not snapshot.exists:
        raise DisputeError(f"No such dispute: {dispute_id}")
    case = {"id": snapshot.id, **snapshot.to_dict()}
    if user_id is not None and case.get("userId") != user_id:
        raise DisputeError(f"No such dispute: {dispute_id}")
    return case


def list_disputes_for_user(user_id: str) -> list[dict]:
    docs = (
        db.collection("disputes")
        .where(filter=FieldFilter("userId", "==", user_id))
        .stream()
    )
    cases = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    cases.sort(key=lambda case: str(case.get("createdAt", "")), reverse=True)
    return cases
