"""ARI transport factory.

The factory itself is shared with every provider that rides an Asterisk; this
module only names the one whose credentials it must find.
"""

from fastapi import WebSocket

from api.services.pipecat.audio_config import AudioConfig
from api.services.telephony.asterisk import create_asterisk_transport


async def create_transport(
    websocket: WebSocket,
    workflow_run_id: int,
    audio_config: AudioConfig,
    organization_id: int,
    *,
    ambient_noise_config: dict | None = None,
    telephony_configuration_id: int | None = None,
    is_realtime: bool = False,
    channel_id: str,
):
    """Create a transport for Asterisk ARI connections."""
    return await create_asterisk_transport(
        websocket,
        workflow_run_id,
        audio_config,
        organization_id,
        ambient_noise_config=ambient_noise_config,
        telephony_configuration_id=telephony_configuration_id,
        is_realtime=is_realtime,
        channel_id=channel_id,
        expected_provider="ari",
    )