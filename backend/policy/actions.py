"""The policy gate: what each tool is allowed to do under the bank's active configuration.

Tiers come from the tool definition, never from the model. A tool ships with a
tier or it does not ship. Every gated call records the configuration version it
ran under, so a case can be reconstructed after the configuration changes.
"""
from dataclasses import dataclass

# Bump this whenever the table below changes. Stored on every record the gate allows.
CONFIG_VERSION = "2026-09-20.3"


class Tier:
    READ = "read"
    REVERSIBLE_WRITE = "reversible_write"
    IRREVERSIBLE_WRITE = "irreversible_write"


@dataclass(frozen=True)
class ActionPolicy:
    tier: str
    enabled: bool
    requires_confirmation: bool
    description: str


# The bank's active tool configuration. Disabling an action here takes it out of
# service everywhere, including for the agent, without a code change elsewhere.
ACTIONS: dict[str, ActionPolicy] = {
    "get_accounts": ActionPolicy(Tier.READ, True, False, "List the signed-in user's accounts"),
    "get_transactions": ActionPolicy(
        Tier.READ, True, False, "List the signed-in user's recent transactions"
    ),
    "find_possible_duplicates": ActionPolicy(
        Tier.READ, True, False, "Surface candidate duplicate charges for review"
    ),
    # Issuing a form writes a short-lived record of what was offered. It moves no
    # money and changes no account state, so it is reversible rather than read —
    # the tier reflects what the call does, not how harmless it feels.
    "start_dispute_form": ActionPolicy(
        Tier.REVERSIBLE_WRITE, True, False, "Issue a dispute intake form built from the user's own data"
    ),
    "create_dispute": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Open a dispute case for charges the user confirmed"
    ),
    "review_dispute": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Staff approval or rejection of a dispute case"
    ),
    "get_cards": ActionPolicy(Tier.READ, True, False, "List the customer's own cards"),
    # A waiver request costs nothing until staff decide, but the customer is
    # asking the bank to give money back, so the request itself is confirmed.
    "start_fee_waiver_form": ActionPolicy(
        Tier.REVERSIBLE_WRITE, True, False, "Issue the fee waiver request form"
    ),
    "request_fee_waiver": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Ask the bank to refund a fee it charged"
    ),
    # Triage asks whether the customer recognises a charge before anything is
    # locked or claimed. It only issues a form, so it is not a money action.
    "start_fraud_triage": ActionPolicy(
        Tier.REVERSIBLE_WRITE, True, False, "Issue the unfamiliar-charge triage form"
    ),
    # Locking is reversible in principle, but it stops the customer's payments
    # today, so it is confirmed like a money action and named to the last four.
    "lock_card": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Block a specific card against further charges"
    ),
    "replace_card": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Cancel a card for good and order a replacement"
    ),
    "create_fraud_claim": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Open a fraud claim for a charge the customer disowns"
    ),
    # A provisional credit is real money that may be taken back, so it is its
    # own action rather than part of approving a case.
    "issue_provisional_credit": ActionPolicy(
        Tier.IRREVERSIBLE_WRITE, True, True, "Credit the customer while the claim is investigated"
    ),
}


class ActionNotAllowed(Exception):
    """Raised when the active configuration does not permit an action."""

    def __init__(self, action: str, reason: str):
        self.action = action
        self.reason = reason
        super().__init__(f"{action}: {reason}")


def get_policy(action: str) -> ActionPolicy:
    policy = ACTIONS.get(action)
    if policy is None:
        # An action absent from the table is not permitted by default.
        raise ActionNotAllowed(action, "not in the active tool configuration")
    return policy


def check_enabled(action: str) -> str:
    """Assert the action is enabled and return the configuration version to record."""
    policy = get_policy(action)
    if not policy.enabled:
        raise ActionNotAllowed(action, "disabled in the active tool configuration")
    return CONFIG_VERSION


def requires_confirmation(action: str) -> bool:
    return get_policy(action).requires_confirmation
