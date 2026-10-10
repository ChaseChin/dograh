"""SIP Track: a carrier trunk that needs a host, a port, and nothing else.

The customer's whole contribution is two fields. Everything else — the ARI user
on the gateway, the Stasis application, the dial string, the trunk definition
the gateway loads — is generated here or read from the deployment. These cover
that split: what comes from the request, what comes from the environment, and
what must never be asked for.
"""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from api.routes.organization import _credentials_for_display
from api.services.telephony import registry
from api.services.telephony.asterisk import (
    AsteriskGatewayReconciler,
    asterisk_driven_provider_names,
    render_gateway_config,
)
from api.services.telephony.providers import siptrack
from api.services.telephony.providers.siptrack import (
    _config_loader,
    _generate_trunk_name,
    _preprocess_credentials_on_save,
)
from api.services.telephony.providers.siptrack.config import (
    SIPTrunkConfigurationRequest,
)

FORM_INPUT = {"hostname": "sip.carrier.example", "port": 5060, "transport": "udp"}


# --------------------------------------------------------------------------
# The form
# --------------------------------------------------------------------------


def test_a_host_and_a_port_are_the_whole_request():
    request = SIPTrunkConfigurationRequest(**FORM_INPUT)

    assert request.provider == "siptrack"
    assert request.hostname == "sip.carrier.example"
    assert request.port == 5060
    assert request.transport == "udp"


def test_port_defaults_to_the_signalling_port():
    assert SIPTrunkConfigurationRequest(hostname="sip.example").port == 5060


@pytest.mark.parametrize(
    "hostname",
    [
        "sip:sip.carrier.example",  # pasted from the carrier's portal
        "sip://sip.carrier.example",
        "sip.carrier.example:5060",  # the port has its own field
        "sip.carrier.example/trunk1",
        "sip.carrier.example sip.carrier.example",
    ],
)
def test_a_host_that_would_not_load_as_a_trunk_is_rejected(hostname):
    """Each of these renders a contact= line Asterisk refuses to load."""
    with pytest.raises(ValidationError):
        SIPTrunkConfigurationRequest(hostname=hostname)


def test_a_host_is_trimmed_rather_than_rejected():
    assert SIPTrunkConfigurationRequest(hostname="  sip.example  ").hostname == (
        "sip.example"
    )


@pytest.mark.parametrize("port", [0, 70000])
def test_a_port_outside_the_range_is_rejected(port):
    with pytest.raises(ValidationError):
        SIPTrunkConfigurationRequest(hostname="sip.example", port=port)


def test_an_unknown_transport_is_rejected():
    with pytest.raises(ValidationError):
        SIPTrunkConfigurationRequest(hostname="sip.example", transport="sctp")


# --------------------------------------------------------------------------
# What the server generates
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_mints_a_trunk_name():
    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert created["stasis_app_name"].startswith("dograhst_")


@pytest.mark.asyncio
async def test_two_configurations_never_share_a_trunk_name():
    """One gateway carries them all, so the endpoint name is the only thing
    keeping one configuration's calls out of another's."""
    first = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)
    second = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert first["stasis_app_name"] != second["stasis_app_name"]


@pytest.mark.asyncio
async def test_update_keeps_the_trunk_the_dial_string_already_points_at():
    """Saving replaces the stored credentials, and a fresh name would leave
    outbound dialling an endpoint the gateway's config no longer defines."""
    existing = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    updated = await _preprocess_credentials_on_save(
        {**FORM_INPUT, "port": 5080}, existing
    )

    assert updated["stasis_app_name"] == existing["stasis_app_name"]
    assert updated["port"] == 5080


@pytest.mark.asyncio
async def test_create_restates_the_gateway_settings(monkeypatch):
    monkeypatch.setenv("ASTERISK_ARI_ENDPOINT", "http://gw.internal:8088")
    monkeypatch.setenv("ASTERISK_ARI_USER", "dograh")
    monkeypatch.setenv("ASTERISK_ARI_PASSWORD", "hunter2")
    monkeypatch.setenv("ASTERISK_WS_CLIENT_NAME", "dograh_ws")

    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert created["ari_endpoint"] == "http://gw.internal:8088"
    assert created["app_name"] == "dograh"
    assert created["app_password"] == "hunter2"
    assert created["ws_client_name"] == "dograh_ws"


@pytest.mark.asyncio
async def test_the_dial_string_names_this_configurations_own_trunk(monkeypatch):
    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert (
        created["dial_string_template"]
        == f"PJSIP/{{number}}@{created['stasis_app_name']}"
    )


# --------------------------------------------------------------------------
# What the operator is told to report
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_inbound_address_falls_back_to_the_public_host(monkeypatch):
    monkeypatch.delenv("SIPTRACK_INBOUND_ADDRESS", raising=False)
    monkeypatch.setenv("PUBLIC_HOST", "voice.example.com")
    monkeypatch.delenv("ASTERISK_SIP_PORT", raising=False)

    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert created["inbound_address"] == "voice.example.com:5060"


@pytest.mark.asyncio
async def test_the_inbound_address_can_be_stated_explicitly(monkeypatch):
    """A deployment that maps a different public port says so directly."""
    monkeypatch.setenv("SIPTRACK_INBOUND_ADDRESS", "203.0.113.7:15060")

    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert created["inbound_address"] == "203.0.113.7:15060"


@pytest.mark.asyncio
async def test_an_unknown_inbound_address_is_absent_rather_than_guessed(monkeypatch):
    """A plausible-looking wrong address is worse than none: the operator
    would give it to the carrier and the trunk would never ring."""
    monkeypatch.delenv("SIPTRACK_INBOUND_ADDRESS", raising=False)
    monkeypatch.delenv("PUBLIC_HOST", raising=False)

    created = await _preprocess_credentials_on_save(dict(FORM_INPUT), None)

    assert "inbound_address" not in created


# --------------------------------------------------------------------------
# What the driver is handed
# --------------------------------------------------------------------------


def test_the_config_loader_derives_the_dial_string_from_the_stored_trunk():
    loaded = _config_loader({**FORM_INPUT, "stasis_app_name": "dograhst_abc123"})

    assert loaded["provider"] == "siptrack"
    assert loaded["stasis_app_name"] == "dograhst_abc123"
    assert loaded["dial_string_template"] == "PJSIP/{number}@dograhst_abc123"


def test_the_config_loader_falls_back_to_the_deployment_gateway(monkeypatch):
    """A configuration saved before a setting moved keeps working only if the
    stored value is missing — never by overriding what is stored."""
    monkeypatch.setenv("ASTERISK_ARI_USER", "someone_else")

    loaded = _config_loader({**FORM_INPUT, "app_name": "dograh"})

    assert loaded["app_name"] == "dograh"


def test_the_driver_class_dials_a_number_out_over_the_configurations_trunk():
    provider = siptrack.SIPTrunkProvider(
        _config_loader({**FORM_INPUT, "stasis_app_name": "dograhst_abc123"})
    )

    assert provider.stasis_app_name == "dograhst_abc123"
    assert provider.dial_string_template == "PJSIP/{number}@dograhst_abc123"


@pytest.mark.asyncio
async def test_the_transport_declares_which_provider_it_serves(monkeypatch):
    """The wrong name here would have the transport load another provider's
    credentials, so the run would be answered by a configuration the call did
    not arrive on."""
    captured = {}

    async def fake_create_asterisk_transport(*args, **kwargs):
        captured.update(kwargs)
        return "transport"

    from api.services.telephony.providers.siptrack import transport as transport_module

    monkeypatch.setattr(
        transport_module, "create_asterisk_transport", fake_create_asterisk_transport
    )

    result = await transport_module.create_transport(
        websocket=None,
        workflow_run_id=1,
        audio_config=None,
        organization_id=2,
        channel_id="chan",
    )

    assert result == "transport"
    assert captured["expected_provider"] == "siptrack"


# --------------------------------------------------------------------------
# The registered spec
# --------------------------------------------------------------------------


def test_the_spec_says_this_is_a_carrier_trunk_on_a_gateway_we_run():
    spec = registry.get("siptrack")

    assert spec.connectivity == "sip"
    # A carrier hands the call to the public network, so destinations are real
    # numbers — unlike a PBX, where they are extensions.
    assert spec.requires_e164_destinations is True
    # Nothing on the inbound payload names an account, and the generated trunk
    # name is not something a carrier ever sends back.
    assert spec.account_id_credential_field == ""


def test_the_generated_fields_are_never_echoed_back_to_a_client():
    """They are deployment facts, not something the operator can edit, and the
    form does not render them — so returning them is noise at best."""
    displayed = _credentials_for_display(
        "siptrack",
        {
            **FORM_INPUT,
            "stasis_app_name": "dograhst_abc123",
            "app_password": "hunter2",
            "inbound_address": "voice.example.com:5060",
        },
    )

    assert "stasis_app_name" not in displayed
    assert "app_password" not in displayed
    # The one generated value the operator does need: they paste it into the
    # carrier's console, which is the only place it can be configured.
    assert displayed["inbound_address"] == "voice.example.com:5060"


def test_the_form_asks_for_the_host_the_port_and_nothing_secret():
    spec = registry.get("siptrack")

    assert [field.name for field in spec.ui_metadata.fields] == [
        "hostname",
        "port",
        "transport",
        "inbound_address",
    ]
    assert not any(field.sensitive for field in spec.ui_metadata.fields)


def test_a_generated_trunk_name_is_usable_as_a_pjsip_section():
    """It becomes an endpoint, an aor, and a dialplan context name."""
    name = _generate_trunk_name()

    assert name.replace("_", "").isalnum()
    assert not name[0].isdigit()


# --------------------------------------------------------------------------
# The gateway's generated config
# --------------------------------------------------------------------------


def _trunk(**overrides):
    from api.services.telephony.asterisk.reconcile import GatewayTrunk

    return GatewayTrunk(
        **{
            "label": "SIP Track",
            "endpoint": "dograhst_abc123",
            "host": "sip.carrier.example",
            "port": 5060,
            "transport": "udp",
            **overrides,
        }
    )


def test_a_trunk_carries_no_authentication_section():
    """The carrier recognises this server by its source IP. An auth section
    would name a credential nobody has, and the trunk would never register."""
    pjsip = render_gateway_config([_trunk()])["pjsip-dograh.conf"]

    assert "type=auth" not in pjsip
    assert "contact=sip:sip.carrier.example:5060" in pjsip
    assert "transport=transport-udp" in pjsip


def test_a_trunk_matches_inbound_calls_by_the_carriers_address():
    pjsip = render_gateway_config([_trunk()])["pjsip-dograh.conf"]

    assert "type=identify" in pjsip
    assert "match=sip.carrier.example" in pjsip


def test_a_trunk_dials_only_the_codec_the_media_path_speaks():
    """Dograh's ARI media channel is ulaw, so anything else is transcoded or
    silent."""
    pjsip = render_gateway_config([_trunk()])["pjsip-dograh.conf"]

    assert "allow=ulaw" in pjsip
    assert "disallow=all" in pjsip


def test_a_trunk_routes_inbound_calls_into_its_own_context():
    """One gateway carries every configuration; a shared context would deliver
    one configuration's calls to another."""
    dialplan = render_gateway_config([_trunk()])["extensions-dograh.conf"]

    assert "[dograhst_abc123-in]" in dialplan
    assert "Stasis(dograhst_abc123)" in dialplan
    assert "context=dograhst_abc123-in" in render_gateway_config([_trunk()])[
        "pjsip-dograh.conf"
    ]


def test_the_generated_config_says_it_is_generated():
    """It is the first thing anyone edits, and the edit is lost on the next
    reconcile."""
    for content in render_gateway_config([_trunk()]).values():
        assert content.startswith("; Generated by Dograh")


def _row(stasis_app_name="dograhst_abc123", **credentials):
    return SimpleNamespace(
        id=1,
        name="SIP Track",
        organization_id=7,
        provider="siptrack",
        credentials={"stasis_app_name": stasis_app_name, **credentials},
    )


def test_an_asterisk_the_customer_owns_contributes_no_trunk(tmp_path):
    """The ari provider's credentials name an endpoint Dograh must never write
    into a file the customer's own PBX is configured from."""
    reconciler = AsteriskGatewayReconciler(["ari", "siptrack"], conf_dir=tmp_path)

    trunks = reconciler._trunks_from_rows(
        [
            _row(
                ari_endpoint="http://pbx.customer.example:8088",
                app_name="dograh",
                app_password="secret",
                stasis_app_name="dograh_abc",
                ws_client_name="dograh",
            )
        ]
    )

    assert trunks == []


def test_a_trunk_row_becomes_a_trunk(tmp_path):
    reconciler = AsteriskGatewayReconciler(["siptrack"], conf_dir=tmp_path)

    trunks = reconciler._trunks_from_rows(
        [_row(hostname="sip.carrier.example", port=5080, transport="tcp")]
    )

    assert trunks == [_trunk(port=5080, transport="tcp")]


@pytest.mark.asyncio
async def test_the_reconciler_writes_once_and_then_leaves_the_file_alone(
    tmp_path, monkeypatch
):
    """It runs on a timer, so an unchanged configuration must not rewrite the
    file the gateway is reloading from."""
    rows = [_row(hostname="sip.carrier.example")]
    monkeypatch.setattr(
        "api.db.db_client",
        SimpleNamespace(
            list_active_telephony_configurations_by_provider=_rows_returning(rows)
        ),
        raising=False,
    )
    reconciler = AsteriskGatewayReconciler(["siptrack"], conf_dir=tmp_path)

    assert await reconciler.reconcile() is True
    assert (tmp_path / "pjsip-dograh.conf").exists()
    assert (tmp_path / "extensions-dograh.conf").exists()
    assert await reconciler.reconcile() is False


@pytest.mark.asyncio
async def test_a_configuration_that_no_longer_exists_stops_being_rendered(
    tmp_path, monkeypatch
):
    """There is no delete hook; convergence is the whole mechanism."""
    rows = [_row(hostname="sip.carrier.example")]
    monkeypatch.setattr(
        "api.db.db_client",
        SimpleNamespace(
            list_active_telephony_configurations_by_provider=_rows_returning(rows)
        ),
        raising=False,
    )
    reconciler = AsteriskGatewayReconciler(["siptrack"], conf_dir=tmp_path)
    await reconciler.reconcile()

    rows.clear()
    assert await reconciler.reconcile() is True
    assert "dograhst_abc123" not in (tmp_path / "pjsip-dograh.conf").read_text()


def _rows_returning(rows):
    async def _list(providers):
        return list(rows)

    return _list


def test_an_installation_without_a_gateway_reports_nothing_to_do(tmp_path):
    """A self-hoster driving their own PBX has no such volume and must not see
    errors for a feature they did not enable."""
    reconciler = AsteriskGatewayReconciler(["siptrack"], conf_dir=tmp_path / "absent")

    assert reconciler.available is False


# --------------------------------------------------------------------------
# The ARI manager
# --------------------------------------------------------------------------


def test_the_ari_manager_asks_the_registry_which_providers_it_serves():
    """A hardcoded list is how the second provider gets forgotten."""
    names = asterisk_driven_provider_names()

    assert "ari" in names
    assert "siptrack" in names
    # A carrier reached over its own call-control API has no ARI socket for
    # the manager to hold open.
    assert "twilio" not in names


@pytest.mark.asyncio
async def test_the_manager_connects_a_siptrack_configuration_as_siptrack(monkeypatch):
    """The events are identical to a customer's PBX; the run they mint is not."""
    from api.services.telephony import ari_manager

    rows = [
        _row(
            hostname="sip.carrier.example",
            ari_endpoint="http://asterisk:8088",
            app_name="dograh",
            app_password="secret",
            ws_client_name="dograh",
            stasis_app_name="dograhst_abc123",
        )
    ]
    monkeypatch.setattr(
        ari_manager,
        "db_client",
        SimpleNamespace(
            list_active_telephony_configurations_by_provider=_rows_returning(rows)
        ),
    )

    configs = await ari_manager.ARIManager()._load_ari_configs()

    assert [config["provider_name"] for config in configs] == ["siptrack"]
    assert configs[0]["stasis_app_name"] == "dograhst_abc123"