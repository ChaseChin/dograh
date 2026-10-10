"""Asterisk ARI driver shared by the providers that ride an Asterisk.

``ari`` connects Dograh to a customer's own PBX; ``siptrack`` connects it to the
gateway Dograh deploys alongside itself. Both drive the same software the same
way, so the driver, the transport factory, and the code that renders the
gateway's trunk configuration all live here rather than in either provider
package.

Provider packages import from this module; it never imports a provider's
``provider.py`` or ``transport.py``.
"""

from api.services.telephony.asterisk.driver import (
    AsteriskARIProvider,
    asterisk_driven_provider_names,
)
from api.services.telephony.asterisk.reconcile import (
    AsteriskGatewayReconciler,
    render_gateway_config,
)
from api.services.telephony.asterisk.transport import create_asterisk_transport

__all__ = [
    "AsteriskARIProvider",
    "AsteriskGatewayReconciler",
    "asterisk_driven_provider_names",
    "create_asterisk_transport",
    "render_gateway_config",
]