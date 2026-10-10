"""Transport factory for providers that ride an Asterisk over ARI.

Shared by ``ari`` and ``siptrack``: the media path is identical — Asterisk's
externalMedia channel arrives as a WebSocket and the frame serializer speaks
ARI back at it for transfers and hangups. Only the provider name used to look
up the credentials differs, which is why it is a parameter.
"""

from fastapi import WebSocket
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from api.services.pipecat.audio_config import AudioConfig
from api.services.pipecat.audio_mixer import build_audio_out_mixer
from api.services.pipecat.transport_params import realtime_param_overrides
from api.services.telephony.factory import load_credentials_for_transport
from api.services.telephony.asterisk.external_pbx import create_adapter
from api.services.telephony.asterisk.serializers import AsteriskFrameSerializer
from api.services.telephony.asterisk.strategies import (
    ARIBridgeSwapStrategy,
    ARIHangupStrategy,
)


async def create_asterisk_transport(
    websocket: WebSocket,
    workflow_run_id: int,
    audio_config: AudioConfig,
    organization_id: int,
    *,
    ambient_noise_config: dict | None = None,
    telephony_configuration_id: int | None = None,
    is_realtime: bool = False,
    channel_id: str,
    expected_provider: str,
):
    """Create a transport for an Asterisk externalMedia WebSocket.

    ``expected_provider`` is the registry name the stored configuration must
    carry; ``load_credentials_for_transport`` refuses a mismatch, which is what
    keeps a run from being served by another provider's credentials.
    """
    config = await load_credentials_for_transport(
        organization_id, telephony_configuration_id, expected_provider=expected_provider
    )

    ari_endpoint = config.get("ari_endpoint")
    app_name = config.get("app_name")
    app_password = config.get("app_password")

    if not ari_endpoint or not app_name or not app_password:
        raise ValueError(
            f"Incomplete {expected_provider} configuration for organization "
            f"{organization_id}. Required: ari_endpoint, app_name, app_password"
        )

    serializer = AsteriskFrameSerializer(
        channel_id=channel_id,
        ari_endpoint=ari_endpoint,
        app_name=app_name,
        app_password=app_password,
        transfer_strategy=ARIBridgeSwapStrategy(),
        hangup_strategy=ARIHangupStrategy(
            external_pbx_adapter=create_adapter(config.get("external_pbx"))
        ),
        params=AsteriskFrameSerializer.InputParams(
            asterisk_sample_rate=audio_config.transport_in_sample_rate,
            sample_rate=audio_config.pipeline_sample_rate,
        ),
    )

    mixer = await build_audio_out_mixer(
        audio_config.transport_out_sample_rate, ambient_noise_config
    )

    return FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=audio_config.transport_in_sample_rate,
            audio_out_sample_rate=audio_config.transport_out_sample_rate,
            audio_out_mixer=mixer,
            serializer=serializer,
            **realtime_param_overrides(is_realtime),
        ),
    )