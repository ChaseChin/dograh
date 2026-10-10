"""SIP Track as a provider: a carrier trunk reached through Dograh's own gateway.

The SIP signalling and the RTP belong to the Asterisk gateway that ships with
this deployment; Dograh drives that gateway over ARI exactly as the ``ari``
provider drives a customer's PBX. The ARI driver itself lives in
``api.services.telephony.asterisk`` — this package contributes only what is
different, which is the credentials a customer fills in and the fact that the
trunk is generated rather than typed. See ``providers/AGENTS.md``.
"""

from api.enums import WorkflowRunMode
from api.services.telephony.asterisk import AsteriskARIProvider


class SIPTrunkProvider(AsteriskARIProvider):
    """ARI driver bound to the bundled gateway rather than a customer PBX."""

    PROVIDER_NAME = WorkflowRunMode.SIPTRACK.value
    WEBHOOK_ENDPOINT = None  # Inbound arrives as ARI events, not webhooks


__all__ = ["SIPTrunkProvider"]