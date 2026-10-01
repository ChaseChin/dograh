#!/usr/bin/env bash
# 本地交叉构建 amd64 镜像,经 ssh 直接灌到火山服务器(voice.kidmuse.cn)并重启对应服务。
# 服务器被墙访问不了 DockerHub/GitHub,不走任何 registry。
#
# 用法:
#   scripts/deploy-to-volc.sh ui     # 只发 ui(默认)
#   scripts/deploy-to-volc.sh api    # 只发 api
#
# 注意:服务器 watcher 监的是上游 dograhai 摘要,上游发版会 pull 官方镜像覆盖本脚本灌入的
# 自定义 :latest(品牌/中文 provider 会回退),届时重跑本脚本即可。
set -euo pipefail

SERVICE="${1:-ui}"
SSH_HOST="volc"
REMOTE_DIR="/opt/dograh"
LOCAL_TAG="voiceworker-${SERVICE}:amd64"
REMOTE_TAG="dograhai/dograh-${SERVICE}:latest"
PUBLIC_HEALTH="https://voice.kidmuse.cn/api/v1/health"

case "$SERVICE" in
  api) DOCKERFILE="api/Dockerfile" ;;
  ui)  DOCKERFILE="ui/Dockerfile" ;;
  *) echo "usage: $0 [api|ui]" >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

echo "==> [1/4] buildx build linux/amd64 (${SERVICE})"
BUILD_ARGS=()
if [ "$SERVICE" = "ui" ]; then
  # ui 构建拉 Google Fonts 在 IPv6 下会超时,强制 IPv4(见 ui/Dockerfile 注释)
  BUILD_ARGS+=(--build-arg "EXTRA_NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection")
fi
docker buildx build --platform linux/amd64 -f "$DOCKERFILE" "${BUILD_ARGS[@]}" -t "$LOCAL_TAG" --load .

echo "==> [2/4] docker save | ssh ${SSH_HOST} docker load"
# Remote output redirected to /dev/null: if left attached to the ssh streams,
# ssh lingers after docker load finishes (remote fds kept open) and the
# pipeline hangs forever.
docker save "$LOCAL_TAG" | gzip | ssh "$SSH_HOST" 'gunzip | docker load >/dev/null 2>&1 && echo "remote load ok"'

echo "==> [3/4] retag -> ${REMOTE_TAG} + recreate ${SERVICE}"
ssh "$SSH_HOST" "docker tag '$LOCAL_TAG' '$REMOTE_TAG' && cd '$REMOTE_DIR' && docker compose up -d --no-deps '$SERVICE'"

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
else
  ssh "$SSH_HOST" "docker ps --filter name=dograh-ui-1 --format '{{.Status}}'"
  curl -sL --max-time 20 https://voice.kidmuse.cn -o /dev/null -w 'voice.kidmuse.cn HTTP %{http_code}\n'
  echo "==> deploy done"
fi
