"""Transaction reads. Every number the assistant states comes from here."""
from datetime import datetime, timedelta

from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db

# Two charges are candidates when the merchant and amount match exactly and they
# posted within this window of each other. Wider windows catch more legitimate
# repeat purchases, so keep it tight and let the customer decide.
DUPLICATE_WINDOW = timedelta(hours=24)


def _parse_created_at(value) -> datetime | None:
    """createdAt is an ISO string after seeding, but may be a Firestore timestamp."""
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    if isinstance(value, datetime):
        return value
    return None


def get_transactions_for_user(user_id: str) -> list[dict]:
    """Return every transaction belonging to this user, newest first."""
    docs = (
        db.collection("transactions")
        .where(filter=FieldFilter("userId", "==", user_id))
        .stream()
    )
    rows = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    rows.sort(key=lambda row: str(row.get("createdAt", "")), reverse=True)
    return rows


def get_transactions_by_ids(user_id: str, transaction_ids: list[str]) -> list[dict]:
    """Fetch specific transactions, keeping only those the user actually owns.

    The ownership filter is applied here rather than trusted from the caller, so a
    transaction ID from anywhere — including model output — cannot read another
    user's data.
    """
    found = []
    for transaction_id in transaction_ids:
        snapshot = db.collection("transactions").document(transaction_id).get()
        if snapshot.exists:
            row = {"id": snapshot.id, **snapshot.to_dict()}
            if row.get("userId") == user_id:
                found.append(row)
    return found


def find_possible_duplicates(user_id: str) -> list[dict]:
    """Return pairs of charges that look like the same purchase billed twice.

    These are candidates for the customer to review, not confirmed errors. A
    merchant can legitimately bill the same amount twice in a day, so nothing
    here is flagged as fraud and no charge is altered.
    """
    charges = [
        row
        for row in get_transactions_for_user(user_id)
        # Outflows only: a matching pair of deposits is not a double charge.
        if row.get("status") == "posted" and (row.get("amountCents") or 0) < 0
    ]

    candidates = []
    for index, first in enumerate(charges):
        first_time = _parse_created_at(first.get("createdAt"))
        if first_time is None:
            continue
        for second in charges[index + 1 :]:
            if first.get("merchant") != second.get("merchant"):
                continue
            if first.get("amountCents") != second.get("amountCents"):
                continue
            second_time = _parse_created_at(second.get("createdAt"))
            if second_time is None:
                continue
            gap = abs(first_time - second_time)
            if gap > DUPLICATE_WINDOW:
                continue
            earlier, later = sorted([first, second], key=lambda row: str(row["createdAt"]))
            candidates.append(
                {
                    "transactionIds": [earlier["id"], later["id"]],
                    "merchant": first.get("merchant"),
                    "amountCents": first.get("amountCents"),
                    "accountId": first.get("accountId"),
                    "minutesApart": round(gap.total_seconds() / 60),
                    "charges": [earlier, later],
                    "reason": (
                        f"Two {first.get('merchant')} charges of the same amount posted "
                        f"{round(gap.total_seconds() / 60)} minutes apart."
                    ),
                    "status": "candidate",
                }
            )

    candidates.sort(key=lambda row: row["minutesApart"])
    return candidates
