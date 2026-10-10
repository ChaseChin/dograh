"""SIP Track: a carrier SIP trunk plugged into Dograh's bundled gateway.

The customer gives Dograh a host and a port, and nothing else. The SIP and RTP
on the other side of that trunk are terminated by the Asterisk gateway this
deployment ships, which is then driven over ARI — the same path the ``ari``
provider uses for a customer's own PBX. What this package adds is the trunk
definition the gateway needs (``api.services.telephony.asterisk.reconcile``)
and a credentials schema with nothing secret in it.

The gateway's own ARI user and websocket-client connection are deployment
constants, not per-configuration credentials: there is one gateway, it belongs
to this installation, and every trunk on it authenticates the same way. Only
the trunk name is minted per configuration, because two configurations must
become two endpoints on that one gateway.
"""

import os
import secrets
from typing import Any, Dict

from api.services.telephony.registry import (
    ProviderSpec,
    ProviderUIField,
    ProviderUIMetadata,
    ProviderUIOption,
    register,
)

from .config import SIPTrunkConfigurationRequest
from .provider import SIPTrunkProvider
from .transport import create_transport

# The gateway runs in this deployment's compose stack, so the API reaches it by
# service name. Overridable for an install that puts the gateway elsewhere.
_DEFAULT_ARI_ENDPOINT = "http://asterisk:8088"

# The gateway's ARI credentials, written into its ari.conf from the same
# environment variables that reach the API container. Empty passwords are
# tolerated here and rejected at connection time, where the operator gets a
# failure report naming the missing setting rather than a credentials row that
# looks complete and silently cannot dial.
_DEFAULT_ARI_USER = "dograh"

# The websocket_client.conf connection the gateway uses for externalMedia. One
# connection serves every trunk: the per-call routing travels in the URI query
# parameters Asterisk appends, not in the connection itself.
_DEFAULT_WS_CLIENT_NAME = "dograh"

# The port the gateway listens for carrier signalling on. This is the local
# port, and it is what the operator reports to the carrier alongside the public
# IP; a deployment that maps a different public port sets the override.
_GATEWAY_SIP_PORT = 5060

# Prefix keeps a generated trunk recognisable in the gateway's own config, the
# way ``dograh_`` does for the ari provider's Stasis applications.
_TRUNK_NAME_PREFIX = "dograhst_"

_CREDENTIAL_FIELD = "stasis_app_name"


def _generate_trunk_name() -> str:
    """Mint the name this configuration's trunk has on the shared gateway.

    This single string is three things at once: the PJSIP endpoint and aor, the
    dialplan context inbound calls arrive in, and the Stasis application
    outbound calls are placed into. The generated trunk config and the dial
    string both read it from here, which is what keeps them in step.

    It is random because every configuration shares one gateway. A
    customer-chosen name would let two configurations claim the same endpoint,
    and Asterisk would load the second over the first — one trunk silently
    serving the other's calls.
    """
    return f"{_TRUNK_NAME_PREFIX}{secrets.token_hex(6)}"


def _gateway_settings() -> Dict[str, str]:
    """The gateway constants, read at use rather than at import.

    Read lazily so a deployment that sets these after the process started — or
    a test that patches the environment — is not stuck with whatever was set
    when the package was first imported.
    """
    return {
        "ari_endpoint": (
            os.getenv("ASTERISK_ARI_ENDPOINT") or _DEFAULT_ARI_ENDPOINT
        ).rstrip("/"),
        "app_name": os.getenv("ASTERISK_ARI_USER") or _DEFAULT_ARI_USER,
        "app_password": os.getenv("ASTERISK_ARI_PASSWORD") or "",
        "ws_client_name": os.getenv("ASTERISK_WS_CLIENT_NAME")
        or _DEFAULT_WS_CLIENT_NAME,
    }


def _dial_string_template(trunk_name: str) -> str:
    """Dial a dialled number out over this configuration's own trunk.

    Every configuration has its own endpoint, so the number can be rendered
    straight into the gateway's dialplan rather than through a route the
    operator would have to maintain by hand.
    """
    return f"PJSIP/{{number}}@{trunk_name}"


def _inbound_address() -> str:
    """What the operator reports to the carrier for IP whitelisting.

    The carrier sends calls to a public address it has been told about, so an
    install that hides it from the operator produces a trunk that looks
    configured and never rings. Falls back to empty, which the UI renders as
    "not set" rather than as a plausible-looking wrong address.
    """
    explicit = os.getenv("SIPTRACK_INBOUND_ADDRESS")
    if explicit:
        return explicit.strip()
    public_host = (os.getenv("PUBLIC_HOST") or "").strip()
    if not public_host:
        return ""
    port = int(os.getenv("ASTERISK_SIP_PORT") or _GATEWAY_SIP_PORT)
    return f"{public_host}:{port}"


async def _preprocess_credentials_on_save(
    credentials: Dict[str, Any],
    existing_credentials: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Own the generated trunk name; restate the deployment facts.

    The trunk name is written from here and never read from the request, so a
    client cannot choose it. An update carries the existing one forward rather
    than minting a new one: saving replaces the stored credentials wholesale,
    and a fresh name would point the dial string at an endpoint the gateway's
    config still calls something else.

    The gateway constants are restated on every save for the same reason —
    they are not part of the credential form and would otherwise be dropped.
    """
    credentials = dict(credentials)
    if existing_credentials is None:
        credentials[_CREDENTIAL_FIELD] = _generate_trunk_name()
    elif existing_credentials.get(_CREDENTIAL_FIELD):
        credentials[_CREDENTIAL_FIELD] = existing_credentials[_CREDENTIAL_FIELD]
    else:
        credentials.pop(_CREDENTIAL_FIELD, None)

    credentials.update(_gateway_settings())
    credentials["dial_string_template"] = _dial_string_template(
        credentials[_CREDENTIAL_FIELD]
    )

    # Displayed, never accepted: the operator copies it into the carrier's
    # console, so it has to survive as a stored value. Deliberately not in
    # server_managed_credential_fields for that reason — those are hidden from
    # the configuration response.
    inbound_address = _inbound_address()
    if inbound_address:
        credentials["inbound_address"] = inbound_address
    else:
        credentials.pop("inbound_address", None)

    return credentials


def _config_loader(value: Dict[str, Any]) -> Dict[str, Any]:
    """Reshape stored credentials into the ARI driver's constructor dict.

    Pure: the gateway facts were written at save time, so nothing here has to
    look at the environment, and a configuration keeps behaving the same even
    if the deployment's settings move under it.
    """
    trunk_name = value.get(_CREDENTIAL_FIELD) or ""
    gateway = _gateway_settings()
    return {
        "provider": "siptrack",
        # Stored values win, so the driver keeps using the gateway the
        # configuration was saved against.
        "ari_endpoint": value.get("ari_endpoint") or gateway["ari_endpoint"],
        "app_name": value.get("app_name") or gateway["app_name"],
        "app_password": value.get("app_password") or gateway["app_password"],
        "stasis_app_name": trunk_name,
        "ws_client_name": value.get("ws_client_name") or gateway["ws_client_name"],
        "dial_string_template": value.get("dial_string_template")
        or _dial_string_template(trunk_name),
        "external_pbx": value.get("external_pbx"),
    }


_UI_METADATA = ProviderUIMetadata(
    display_name="SIP Track",
    docs_url="https://docs.dograh.com/integrations/telephony/siptrack",
    fields=[
        ProviderUIField(
            name="hostname",
            label="SIP Host",
            type="text",
            description=(
                "The host your carrier gave you for this trunk, without a "
                "sip: prefix and without a port. Dograh terminates it on the "
                "gateway bundled with your installation."
            ),
            placeholder="sip.carrier.example.com",
        ),
        ProviderUIField(
            name="port",
            label="Port",
            type="number",
            description="The carrier's SIP signalling port. Almost always 5060.",
        ),
        ProviderUIField(
            name="transport",
            label="Transport",
            type="select",
            description=(
                "The transport the carrier expects. UDP unless they told you "
                "otherwise."
            ),
            options=[
                ProviderUIOption(value="udp", label="UDP"),
                ProviderUIOption(value="tcp", label="TCP"),
            ],
        ),
        ProviderUIField(
            name="inbound_address",
            label="Inbound Address",
            type="readonly",
            required=False,
            description=(
                "Give this address to your carrier and ask them to whitelist "
                "it, then point your inbound numbers at it. Inbound calls "
                "cannot reach Dograh until they do."
            ),
        ),
    ],
)


SPEC = ProviderSpec(
    name="siptrack",
    provider_cls=SIPTrunkProvider,
    config_loader=_config_loader,
    transport_factory=create_transport,
    transport_sample_rate=8000,
    config_request_cls=SIPTrunkConfigurationRequest,
    ui_metadata=_UI_METADATA,
    # Dograh's own gateway carries the calls; the customer brings the trunk.
    connectivity="sip",
    # The trunk's host and port are the whole of the setup. A phone number is
    # still what presents a caller ID and what inbound routing matches on, but
    # a trunk can be dialled over without one, so it does not block outbound.
    requires_caller_id=False,
    # Destinations are real PSTN numbers: the carrier hands the call to the
    # public network, which is what makes this a carrier trunk and not a PBX.
    requires_e164_destinations=True,
    # No account-id concept: inbound matching is by called number, and the
    # trunk name that would distinguish configurations is not something the
    # carrier ever sends back.
    account_id_credential_field="",
    # The ARI user, password and websocket-client name are deployment facts rather
    # than customer input; clients never send them. The trunk name is generated
    # here and meaningless outside this deployment — unlike the ari provider's,
    # nobody has to paste it anywhere — so it is hidden along with them.
    server_managed_credential_fields=(
        "ari_endpoint",
        "app_name",
        "app_password",
        "ws_client_name",
        _CREDENTIAL_FIELD,
    ),
    preprocess_credentials_on_save=_preprocess_credentials_on_save,
)


register(SPEC)


__all__ = [
    "SPEC",
    "SIPTrunkConfigurationRequest",
    "SIPTrunkProvider",
    "create_transport",
]