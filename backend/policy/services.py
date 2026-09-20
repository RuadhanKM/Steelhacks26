"""What this assistant is for, in one list.

The router classifies each message against this list, the canned replies are
built from it, and the tap options the customer sees are its labels. Adding a
capability means adding it here, so routing and the offered options cannot drift
apart from each other.

Nothing here decides permissions. A route only picks which path handles the
message; every action still passes the policy gate in ``policy.actions``.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Service:
    id: str
    label: str  # what the customer taps
    description: str  # what the classifier reads
    prompt: str  # the message sent when they tap it


SERVICES: tuple[Service, ...] = (
    Service(
        id="balance",
        label="Check my balance",
        description="account balances, how much money they have, what is in checking or savings",
        prompt="What are my account balances?",
    ),
    Service(
        id="transactions",
        label="Recent transactions",
        description="recent charges, spending, what they paid, transaction history",
        prompt="Show me my recent transactions",
    ),
    Service(
        id="duplicate_charge",
        label="I was charged twice",
        description="the same purchase billed more than once, a duplicate or repeated charge",
        prompt="I think I was charged twice for something",
    ),
    Service(
        id="unauthorised_charge",
        label="I don't recognise a charge",
        description=(
            "a charge they did not make or do not recognise, an unfamiliar merchant, "
            "suspected fraud, a lost or stolen card"
        ),
        prompt="I don't recognise a charge on my account",
    ),
    Service(
        id="card",
        label="My card",
        description="blocking, locking, cancelling or replacing a card, card status",
        prompt="I need to do something about my card",
    ),
    Service(
        id="case_status",
        label="Check a case",
        description="the status of a dispute or fraud claim they already opened",
        prompt="What's the status of my dispute?",
    ),
)

SERVICE_IDS = tuple(service.id for service in SERVICES)
SERVICE_BY_ID = {service.id: service for service in SERVICES}

# Routes that are answered without waking the main agent.
GREETING = "greeting"
OUT_OF_SCOPE = "out_of_scope"
UNCLEAR = "unclear"
CHEAP_ROUTES = (GREETING, OUT_OF_SCOPE, UNCLEAR)

# The defined replies. Fixed text, so an off-topic question costs nothing and
# always gets the same honest answer rather than an improvised one.
REPLIES = {
    GREETING: "Hello. I can help with your accounts and charges — here's what I can do:",
    OUT_OF_SCOPE: (
        "I can only help with your own accounts and charges, so I can't help with that one. "
        "A banker can, if you'd like me to pass it on. In the meantime:"
    ),
    UNCLEAR: "I want to make sure I help with the right thing. Did you mean one of these?",
}


def suggestions() -> list[dict]:
    """The tap options offered alongside a canned reply."""
    return [{"label": service.label, "prompt": service.prompt} for service in SERVICES]
