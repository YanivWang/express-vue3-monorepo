#!/usr/bin/env bash
set -euo pipefail

# 对齐 deer-flow-vue3/scripts/docker.sh：compose 拉起后在 IDE 控制台打印各入口 URL。

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
cd "$ROOT"

COMPOSE_EXTRA=()
DEBUG_MODE=0
for arg in "$@"; do
  case "$arg" in
    --debug)
      DEBUG_MODE=1
      COMPOSE_EXTRA+=(-f docker/docker-compose.debug.yaml)
      ;;
  esac
done

gateway_port="${GATEWAY_HOST_PORT:-2026}"
if [[ -f .env.development ]]; then
  line=""
  while IFS= read -r l || [[ -n "$l" ]]; do
    [[ "$l" =~ ^[[:space:]]*GATEWAY_HOST_PORT= ]] && line="$l"
  done < .env.development
  if [[ -n "$line" ]]; then
    val="${line#*=}"
    val="$(printf '%s' "$val" | sed -e "s/^['\"]//; s/['\"]\$//" | xargs)"
    if [[ -n "$val" ]]; then
      gateway_port="$val"
    fi
  fi
fi

export APP_ENV=development

docker compose \
  --env-file .env.development \
  -f docker/docker-compose.base.yaml \
  -f docker/docker-compose.dev.yaml \
  "${COMPOSE_EXTRA[@]}" \
  up -d --build

echo ""
echo "=========================================="
echo "  Docker 开发栈已启动（vue3-express-monorepo）"
echo "=========================================="
echo ""
echo -e "  ${GREEN}浏览器统一入口（网关 → pc-portal / pc-admin Vite + rest-api）：${NC}"
echo -e "    门户：  http://127.0.0.1:${gateway_port}/"
echo -e "    管理后台：http://127.0.0.1:${gateway_port}/pc-admin/"
echo ""
echo -e "  ${GREEN}REST API（经网关）：${NC}"
echo -e "    http://127.0.0.1:${gateway_port}/api/"
echo ""
echo -e "  ${GREEN}健康与文档：${NC}"
echo -e "    http://127.0.0.1:${gateway_port}/health"
echo -e "    http://127.0.0.1:${gateway_port}/ready"
echo -e "    http://127.0.0.1:${gateway_port}/openapi.yaml"
echo -e "    http://127.0.0.1:${gateway_port}/api-docs"
echo ""
echo -e "  ${GREEN}Node 调试端口（宿主 → 容器 9229）：${NC}"
echo -e "    127.0.0.1:9229  （需在 VS Code/Cursor 中 Attach Node）"
if [[ "$DEBUG_MODE" -eq 1 ]]; then
  echo ""
  echo -e "  ${YELLOW}调试模式：已加载 docker-compose.debug.yaml；可使用仓库内「Attach to Docker rest-api」类配置附加。${NC}"
fi
echo ""
echo -e "  ${BLUE}MySQL 默认仅在 Docker 网格内可达；若在 compose 中映射 3306:3306，可用 127.0.0.1:3306。${NC}"
echo ""
echo -e "  查看日志: ${YELLOW}docker compose --env-file .env.development -f docker/docker-compose.base.yaml -f docker/docker-compose.dev.yaml logs -f${NC}"
echo -e "  停止栈:   ${YELLOW}pnpm docker:dev:down${NC}"
echo ""
