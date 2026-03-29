#!/usr/bin/env bash
# ============================================================
# ERP 全家桶 — 服務守護程序 (Watchdog)
# 每分鐘由 cron 執行，偵測服務是否存活；若死亡則重啟
# 日誌: logs/watchdog.log
# ============================================================

set -uo pipefail

# ── 設定 ────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/watchdog.log"
LOCK_FILE="/tmp/erp-watchdog.lock"
PM2=/opt/homebrew/lib/node_modules/pm2/bin/pm2
export PM2_HOME=/Users/marchmuffin/.pm2
export PATH=/opt/homebrew/Cellar/node/25.8.1_1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

API_URL="http://localhost:4001/api/v1/tenants"
WEB_URL="http://localhost:4000"
MAX_LOG_LINES=2000

# ── 工具函式 ─────────────────────────────────────────────────
ts()  { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }

trim_log() {
  if [[ -f "$LOG_FILE" ]]; then
    local lines
    lines=$(wc -l < "$LOG_FILE")
    if (( lines > MAX_LOG_LINES )); then
      tail -n $MAX_LOG_LINES "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
  fi
}

check_process() {
  local name=$1
  local status
  status=$($PM2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p.get('name') == '$name':
            print(p.get('pm2_env', {}).get('status', 'unknown'))
            sys.exit(0)
    print('missing')
except Exception as e:
    print('unknown')
" 2>/dev/null || echo "unknown")
  echo "$status"
}

restart_service() {
  local name=$1
  log "WARNING  $name 狀態異常，嘗試重啟..."
  if $PM2 restart "$name" --update-env 2>&1 | tee -a "$LOG_FILE"; then
    log "OK  $name 已重啟"
  else
    log "ERROR  重啟 $name 失敗，嘗試 start..."
    cd "$PROJECT_DIR" && $PM2 start ecosystem.config.js --only "$name" 2>&1 | tee -a "$LOG_FILE" || true
  fi
}

check_http() {
  local url=$1
  # curl returns "000" on connection failure; -S ensures we only get the code string
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000"
}

mkdir -p "$PROJECT_DIR/logs"

# ── 並發鎖（避免兩個 cron 實例同時執行，macOS 用 mkdir 原子鎖）
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  # 另一個實例正在執行，靜默退出
  exit 0
fi
trap 'rm -rf "$LOCK_FILE"' EXIT

# ── 確保 pm2 daemon 運行 ─────────────────────────────────────
if ! $PM2 ping 2>/dev/null | grep -q "pong"; then
  log "RECOVER  pm2 daemon 未運行，正在恢復..."
  $PM2 resurrect 2>&1 | tee -a "$LOG_FILE" || true
  sleep 5
fi

# ── 檢查 Redis ────────────────────────────────────────────────
if ! redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
  log "WARNING  Redis 離線，嘗試重啟..."
  /opt/homebrew/bin/brew services restart redis 2>&1 | tee -a "$LOG_FILE" || true
  sleep 3
else
  log "OK  redis online"
fi

# ── 檢查 PostgreSQL ───────────────────────────────────────────
if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  log "WARNING  PostgreSQL 離線，嘗試重啟..."
  /opt/homebrew/bin/brew services restart "postgresql@16" 2>&1 | tee -a "$LOG_FILE" || true
  sleep 5
else
  log "OK  postgresql online"
fi

# ── 檢查 erp-api ──────────────────────────────────────────────
API_STATUS=$(check_process "erp-api")
if [[ "$API_STATUS" != "online" ]]; then
  log "erp-api pm2 status=$API_STATUS"
  restart_service "erp-api"
else
  HTTP_CODE=$(check_http "$API_URL")
  if [[ "$HTTP_CODE" == "000" ]]; then
    log "WARNING  erp-api HTTP 無回應 (code=000)，重啟中..."
    restart_service "erp-api"
  else
    log "OK  erp-api online (HTTP $HTTP_CODE)"
  fi
fi

# ── 檢查 erp-web ──────────────────────────────────────────────
WEB_STATUS=$(check_process "erp-web")
if [[ "$WEB_STATUS" != "online" ]]; then
  log "erp-web pm2 status=$WEB_STATUS"
  restart_service "erp-web"
else
  HTTP_CODE=$(check_http "$WEB_URL")
  if [[ "$HTTP_CODE" == "000" ]]; then
    log "WARNING  erp-web HTTP 無回應 (code=000)，重啟中..."
    restart_service "erp-web"
  else
    log "OK  erp-web online (HTTP $HTTP_CODE)"
  fi
fi

# ── 儲存 pm2 快照 ─────────────────────────────────────────────
$PM2 save --force 2>/dev/null || true

trim_log
