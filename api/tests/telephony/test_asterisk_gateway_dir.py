"""The shared directory the API and the bundled gateway meet in.

The two containers mount one named volume and never read each other's
databases, so the contract between them is entirely this directory: the API
writes the trunk files, the gateway reads them. Docker creates a named volume's
root owned by root, mode 0755, and the API writes as an unprivileged user — so
"the directory exists" and "the directory can be written to" are different
questions, and only the second one describes a working gateway.

These cover that distinction, because getting it wrong is not visible in a unit
test that only ever runs as root: in production it is a permission error logged
once a minute for the life of a gateway-less deployment.
"""

import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from api.services.telephony.asterisk import AsteriskGatewayReconciler

TRUNK_ROW = SimpleNamespace(
    id=7,
    name="Carrier",
    credentials={
        "hostname": "sip.carrier.example",
        "port": 5060,
        "transport": "udp",
        "stasis_app_name": "dograhst_1a2b3c4d5e6f",
    },
)


def _reconciler(conf_dir: Path) -> AsteriskGatewayReconciler:
    return AsteriskGatewayReconciler("siptrack", conf_dir=conf_dir)


def test_a_missing_directory_is_not_available(tmp_path):
    """No gateway has ever run: compose creates the volume, not this path."""
    assert _reconciler(tmp_path / "dograh").available is False


@pytest.mark.skipif(
    os.geteuid() == 0,
    reason="root ignores directory permissions, so this cannot be observed",
)
def test_an_unwritable_directory_is_not_available(tmp_path):
    """The gateway's volume root before it chmods it: present, but root-owned.

    0555 rather than the 0755 Docker actually creates, because the test owns the
    directory it just made — the property under test is "this process cannot
    write here", and stripping the owner's write bit is how you produce it
    without a second user.
    """
    conf_dir = tmp_path / "dograh"
    conf_dir.mkdir()
    conf_dir.chmod(0o555)

    assert _reconciler(conf_dir).available is False


def test_a_writable_directory_is_available(tmp_path):
    """What the gateway leaves behind once it has started."""
    conf_dir = tmp_path / "dograh"
    conf_dir.mkdir()
    conf_dir.chmod(0o777)

    assert _reconciler(conf_dir).available is True


async def test_reconcile_does_nothing_while_unavailable(tmp_path, monkeypatch):
    """An installation with no gateway must not query, write, or log an error.

    The directory is present and read-only, which is exactly the shape a
    deployment that never opted into SIP Track has. Nothing should reach the
    database and nothing should land on disk.
    """
    conf_dir = tmp_path / "dograh"
    conf_dir.mkdir()
    conf_dir.chmod(0o555)

    async def _explode(*args, **kwargs):
        raise AssertionError("reconcile queried the database with no gateway up")

    monkeypatch.setattr(
        "api.db.db_client.list_active_telephony_configurations_by_provider",
        _explode,
    )

    assert await _reconciler(conf_dir).reconcile() is False
    assert list(conf_dir.iterdir()) == []


async def test_reconcile_writes_the_trunks_once_available(tmp_path, monkeypatch):
    """The other half of the contract: a prepared directory gets the files.

    Two files, always both of them — an empty one loads as "no trunks" in
    Asterisk, where a missing one is an error on every reload.
    """
    conf_dir = tmp_path / "dograh"
    conf_dir.mkdir()
    conf_dir.chmod(0o777)

    async def _rows(provider_names):
        assert list(provider_names) == ["siptrack"]
        return [TRUNK_ROW]

    monkeypatch.setattr(
        "api.db.db_client.list_active_telephony_configurations_by_provider",
        _rows,
    )

    assert await _reconciler(conf_dir).reconcile() is True

    written = sorted(path.name for path in conf_dir.iterdir())
    assert written == ["extensions-dograh.conf", "pjsip-dograh.conf"]

    pjsip = (conf_dir / "pjsip-dograh.conf").read_text()
    assert "sip.carrier.example" in pjsip
    assert "dograhst_1a2b3c4d5e6f" in pjsip

    # A second poll with the same trunks has nothing to do, which is what keeps
    # a timer-driven reconcile off the disk.
    assert await _reconciler(conf_dir).reconcile() is False