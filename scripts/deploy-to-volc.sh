#!/usr/bin/env bash
# 本地交叉构建 amd64 镜像,经 ssh 直接灌到火山服务器(voiceworker.cn)并重启对应服务。
# 服务器被墙访问不了 DockerHub/GitHub,不走任何 registry。
#
# 用法:
#   scripts/deploy-to-volc.sh ui        # 只发 ui(默认)
#   scripts/deploy-to-volc.sh api       # 只发 api
#   scripts/deploy-to-volc.sh asterisk  # 只发 SIP Track 网关(asterisk,sip-trunk profile)
#
# 注意:服务器 watcher 监的是上游 dograhai 摘要,上游发版会 pull 官方镜像覆盖本脚本灌入的
# 自定义 :latest(品牌/中文 provider 会回退),届时重跑本脚本即可。
set -euo pipefail

SERVICE="${1:-ui}"
SSH_HOST="volc"
REMOTE_DIR="/opt/dograh"
LOCAL_TAG="voiceworker-${SERVICE}:amd64"
REMOTE_TAG="dograhai/dograh-${SERVICE}:latest"
PUBLIC_HEALTH="https://voiceworker.cn/api/v1/health"

# The asterisk gateway builds from its own directory (its Dockerfile COPYs a file
# from alongside itself); the application images build from the repo root.
case "$SERVICE" in
  api)      DOCKERFILE="api/Dockerfile";              CONTEXT="." ;;
  ui)       DOCKERFILE="ui/Dockerfile";               CONTEXT="." ;;
  asterisk) DOCKERFILE="deploy/asterisk/Dockerfile";  CONTEXT="deploy/asterisk" ;;
  *) echo "usage: $0 [api|ui|asterisk]" >&2; exit 1 ;;
esac

# The gateway is gated behind a profile, so compose refuses the service name
# without it — every compose call below for this service has to carry the flag.
COMPOSE_PROFILE=""
[ "$SERVICE" = "asterisk" ] && COMPOSE_PROFILE="--profile sip-trunk"

cd "$(dirname "$0")/.."

echo "==> [1/4] buildx build linux/amd64 (${SERVICE})"
BUILD_ARGS=()
if [ "$SERVICE" = "ui" ]; then
  # ui 构建拉 Google Fonts 在 IPv6 下会超时,强制 IPv4(见 ui/Dockerfile 注释)
  BUILD_ARGS+=(--build-arg "EXTRA_NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection")
fi
# ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} rather than a bare "${BUILD_ARGS[@]}": macOS
# ships bash 3.2, where expanding an empty array under `set -u` aborts with
# "BUILD_ARGS[@]: unbound variable" — i.e. on the `api` path, which adds no args.
docker buildx build --platform linux/amd64 -f "$DOCKERFILE" ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} -t "$LOCAL_TAG" --load "$CONTEXT"

echo "==> [2/4] docker save | ssh ${SSH_HOST} docker load"
# Remote output redirected to /dev/null: if left attached to the ssh streams,
# ssh lingers after docker load finishes (remote fds kept open) and the
# pipeline hangs forever.
docker save "$LOCAL_TAG" | gzip | ssh "$SSH_HOST" 'gunzip | docker load >/dev/null 2>&1 && echo "remote load ok"'

echo "==> [3/4] retag -> ${REMOTE_TAG} + recreate ${SERVICE}"
ssh "$SSH_HOST" "docker tag '$LOCAL_TAG' '$REMOTE_TAG' && cd '$REMOTE_DIR' && docker compose $COMPOSE_PROFILE up -d --no-deps '$SERVICE'"

echo "==> [4/4] health check"
if [ "$SERVICE" = "api" ]; then
  for i in $(seq 1 15); do
    sleep 5
    RESP="$(curl -s --max-time 10 "$PUBLIC_HEALTH" || true)"
    if [[ "$RESP" == *'"status":"ok"'* ]]; then
      echo "api healthy: $RESP" | head -c 200; echo
      echo "==> deploy done"
      exit 0
    fi
    echo "  waiting for api... ($i/15)"
  done
  echo "!! api health check timed out" >&2
  exit 1
elif [ "$SERVICE" = "asterisk" ]; then
  # The gateway has no HTTP surface to poll, and the failure worth catching is
  # invisible from outside it: an image missing a module the media path needs
  # answers calls and then carries no audio, which from the carrier's side looks
  # the same as a working gateway. So check the modules rather than trusting the
  # container's status. The log is filtered to the gateway's own lines — the
  # base image emits unrelated errors about codecs and CDR backends it has
  # always emitted.
  sleep 15
  ssh "$SSH_HOST" "docker ps --filter name=dograh-asterisk --format '{{.Status}}'"
  ssh "$SSH_HOST" "docker logs dograh-asterisk 2>&1 | grep '\[dograh-gateway\]' | tail -10"

  MISSING=""
  for module in chan_pjsip chan_websocket res_websocket_client res_ari.so; do
    count="$(ssh "$SSH_HOST" "docker exec dograh-asterisk asterisk -rx 'module show like $module' 2>/dev/null | grep -c Running" || echo 0)"
    [ "${count:-0}" -ge 1 ] || MISSING="$MISSING $module"
  done
  if [ -n "$MISSING" ]; then
    echo "!! gateway is running but missing modules:$MISSING" >&2
    exit 1
  fi
  echo "modules ok: chan_pjsip chan_websocket res_websocket_client res_ari"
  echo "==> deploy done"
else
  ssh "$SSH_HOST" "docker ps --filter name=dograh-ui-1 --format '{{.Status}}'"
  curl -sL --max-time 20 https://voiceworker.cn -o /dev/null -w 'voiceworker.cn HTTP %{http_code}\n'
  echo "==> deploy done"
fi
