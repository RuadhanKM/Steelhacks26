"""Staff review of dispute cases.

Approval is the one path in this build that moves money. The reversal credit and
the account balance are written in a single Firestore transaction, so the demo
cannot land in the half-finished state where a customer sees a credit that the
balance does not reflect, or the reverse.
"""
from datetime import datetime, timezone

from google.cloud import firestore as gcf

from db.firestore import db
from policy.actions import check_enabled
from services.dispute_service import (
    OPEN_STATUSES,
    STATUS_REJECTED,
    STATUS_RESOLVED,
    STATUS_UNDER_REVIEW,
    get_dispute,
)


class ReviewError(Exception):
    """The case could not be reviewed as asked."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def list_pending_reviews() -> list[dict]:
    """Every case awaiting staff action, oldest first — the staff work queue."""
    docs = (
        db.collection("disputes")
        .where(filter=gcf.FieldFilter("status", "in", list(OPEN_STATUSES)))
        .stream()
    )
    cases = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    cases.sort(key=lambda case: str(case.get("createdAt", "")))
    return cases


def claim_for_review(dispute_id: str, staff_id: str) -> dict:
    """Move a submitted case to under_review so two reviewers do not both work it."""
    check_enabled("review_dispute")
    case_ref = db.collection("disputes").document(dispute_id)

    @gcf.transactional
    def _claim(transaction):
        snapshot = case_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise ReviewError(f"No such dispute: {dispute_id}")
        case = snapshot.to_dict()
        if case["status"] not in OPEN_STATUSES:
            raise ReviewError(f"Case {dispute_id} is already {case['status']}.")
        transaction.update(
            case_ref,
            {"status": STATUS_UNDER_REVIEW, "reviewedBy": staff_id, "updatedAt": _now()},
        )

    _claim(db.transaction())
    return get_dispute(dispute_id)


def reject_dispute(dispute_id: str, staff_id: str, note: str | None = None) -> dict:
    """Close a case without a credit. Nothing about the original charges changes."""
    check_enabled("review_dispute")
    case_ref = db.collection("disputes").document(dispute_id)

    @gcf.transactional
    def _reject(transaction):
        snapshot = case_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise ReviewError(f"No such dispute: {dispute_id}")
        case = snapshot.to_dict()
        if case["status"] not in OPEN_STATUSES:
            raise ReviewError(f"Case {dispute_id} is already {case['status']}.")
        transaction.update(
            case_ref,
            {
                "status": STATUS_REJECTED,
                "reviewedBy": staff_id,
                "reviewedAt": _now(),
                "reviewNote": note,
                "updatedAt": _now(),
            },
        )

    _reject(db.transaction())
    return get_dispute(dispute_id)


def approve_dispute(dispute_id: str, staff_id: str, note: str | None = None) -> dict:
    """Approve a case: write a reversal credit and update the balance together.

    The original charges are left untouched. A reversal is a new transaction, so
    the account history still shows what happened rather than being rewritten.
    """
    config_version = check_enabled("review_dispute")
    case_ref = db.collection("disputes").document(dispute_id)
    reversal_ref = db.collection("transactions").document()

    @gcf.transactional
    def _approve(transaction):
        snapshot = case_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise ReviewError(f"No such dispute: {dispute_id}")
        case = snapshot.to_dict()
        if case["status"] not in OPEN_STATUSES:
            raise ReviewError(f"Case {dispute_id} is already {case['status']}.")

        amount_cents = case.get("claimedAmountCents")
        if not amount_cents:
            raise ReviewError(f"Case {dispute_id} has no single claimed amount to reverse.")

        account_ref = db.collection("accounts").document(case["accountId"])
        account_snapshot = account_ref.get(transaction=transaction)
        if not account_snapshot.exists:
            raise ReviewError(f"Account {case['accountId']} no longer exists.")

        # All reads must precede all writes inside a Firestore transaction.
        transaction.set(
            reversal_ref,
            {
                "userId": case["userId"],
                "accountId": case["accountId"],
                "amountCents": amount_cents,  # positive: a credit back to the customer
                "type": "dispute_reversal",
                "merchant": case.get("merchant"),
                "category": "adjustment",
                "status": "posted",
                "createdAt": _now(),
                "flaggedForReview": False,
                "disputeId": dispute_id,
            },
        )
        transaction.update(account_ref, {"balanceCents": gcf.Increment(amount_cents)})
        transaction.update(
            case_ref,
            {
                "status": STATUS_RESOLVED,
                "reviewedBy": staff_id,
                "reviewedAt": _now(),
                "reviewNote": note,
                "reversalTransactionId": reversal_ref.id,
                "reversalAmountCents": amount_cents,
                "reviewPolicyConfigVersion": config_version,
                "updatedAt": _now(),
            },
        )

    _approve(db.transaction())
    return get_dispute(dispute_id)
