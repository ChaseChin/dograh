"""Asterisk ARI as a provider: the customer's own PBX, reached over ARI.

The driver lives in ``api.services.telephony.asterisk`` rather than here,
because it is not specific to this provider: ``siptrack`` drives a bundled
Asterisk the same way, and ``providers/AGENTS.md`` keeps provider packages from
importing each other. What is left is what actually differs — the provider's
name, and the credentials a customer fills in.
"""

from api.enums import WorkflowRunMode
from api.services.telephony.asterisk import AsteriskARIProvider


class ARIProvider(AsteriskARIProvider):
    """Asterisk ARI implementation of TelephonyProvider.

    Uses ARI REST API for call control and relies on a separate
    ari_manager process for WebSocket event listening.
    """

    PROVIDER_NAME = WorkflowRunMode.ARI.value
    WEBHOOK_ENDPOINT = None  # ARI uses WebSocket events, not webhooks


__all__ = ["ARIProvider"]