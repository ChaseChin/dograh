"""SIP trunk (SIP Track) configuration schemas.

The carrier hands out a host and a port and recognises this server by its
source IP; there is nothing secret to fill in. Everything Asterisk needs
beyond those two fields — the ARI user, the Stasis application, the dial
string — is generated on save and never leaves the server.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

# The carrier's signalling port. 5060 is what every SIP trunk defaults to, so
# asking for it only ever confirms what the operator already assumed.
DEFAULT_SIP_PORT = 5060

# Asterisk's own transport names, which is what the generated trunk config
# writes. Kept as a closed set: an arbitrary value would render a
# ``transport-<name>`` section that does not exist and the trunk would never
# load, with no error anywhere the customer could see.
SIP_TRANSPORTS = ("udp", "tcp")


class SIPTrunkConfigurationRequest(BaseModel):
    """Request schema for a SIP Track trunk configuration."""

    provider: Literal["siptrack"] = Field(default="siptrack")
    hostname: str = Field(
        ...,
        description="SIP host the carrier gave you, e.g. sip.example.com or 203.0.113.7",
    )
    port: int = Field(
        default=DEFAULT_SIP_PORT,
        description="Carrier's SIP signalling port",
    )
    transport: Literal["udp", "tcp"] = Field(
        default="udp",
        description="Transport the carrier expects signalling on",
    )

    @field_validator("hostname")
    @classmethod
    def validate_hostname(cls, value: str) -> str:
        """Accept a bare host, which is all the trunk config can hold.

        A ``sip:`` prefix, a port, or a path are all things operators paste
        from a carrier's portal; each of them would be written verbatim into
        ``contact=sip:<host>:<port>`` and produce a trunk Asterisk refuses to
        load. Rejecting them here turns a silent broken trunk into a field
        error.
        """
        stripped = value.strip()
        if not stripped:
            raise ValueError("SIP host is required")
        if "://" in stripped or stripped.lower().startswith("sip:"):
            raise ValueError(
                "Enter the host on its own, without a sip:// or sip: prefix"
            )
        if any(character in stripped for character in (":", "/", " ", "?")):
            raise ValueError(
                "Enter the host on its own, without a port, path, or spaces"
            )
        return stripped

    @field_validator("port")
    @classmethod
    def validate_port(cls, value: int) -> int:
        if not 1 <= value <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return value