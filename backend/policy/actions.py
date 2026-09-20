"""The policy gate: what each tool is allowed to do under the bank's active configuration.

Tiers come from the tool definition, never from the model. A tool ships with a
tier or it does not ship. Every gated call records the configuration version it
ran under, so a case can be reconstructed after the configuration changes.
"""
from dataclasses import dataclass

# Bump this whenever the table below changes. Stored on every record the gate allows.
CONFIG_VERSION = "2026-09-19.1"


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
