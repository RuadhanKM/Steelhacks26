from google.cloud.firestore_v1.base_query import FieldFilter

from db.firestore import db


def get_accounts_for_user(user_id: str) -> list[dict]:
    """Return every account whose userId matches, e.g. "demo_user_01"."""
    docs = db.collection("accounts").where(filter=FieldFilter("userId", "==", user_id))  .stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]
