#!/usr/bin/env bash
# ============================================================
# ERP 全家桶 — Release Script
# 用法: ./scripts/release.sh [patch|minor|major|x.y.z]
# 範例: ./scripts/release.sh patch      → 0.5.0 → 0.5.1
#       ./scripts/release.sh minor      → 0.5.0 → 0.6.0
#       ./scripts/release.sh major      → 0.5.0 → 1.0.0
#       ./scripts/release.sh 1.2.3      → 設定為指定版本
# ============================================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# ── 工具函式 ──────────────────────────────────────────────────
err()  { echo "❌ $*" >&2; exit 1; }
info() { echo "ℹ️  $*"; }
ok()   { echo "✅ $*"; }

# ── 前置檢查 ──────────────────────────────────────────────────
[[ $# -lt 1 ]] && err "請指定版本類型：patch | minor | major | x.y.z"

command -v node >/dev/null || err "需要 node"
command -v git  >/dev/null || err "需要 git"

# 確認工作目錄乾淨（只允許 package.json 與 CHANGELOG 有未提交變更）
DIRTY=$(git status --porcelain | grep -v '^\?\?' | grep -vE '(package\.json|CHANGELOG)' || true)
if [[ -n "$DIRTY" ]]; then
  echo "⚠️  工作目錄有未提交的變更："
  echo "$DIRTY"
  read -r -p "繼續發布？(y/N) " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || err "已取消"
fi

# ── 計算新版本 ────────────────────────────────────────────────
BUMP_TYPE="${1:-patch}"
CURRENT=$(node -p "require('./package.json').version")
info "目前版本: v$CURRENT"

bump_version() {
  local version=$1 type=$2
  IFS='.' read -r major minor patch <<< "$version"
  case "$type" in
    major) echo "$((major+1)).0.0" ;;
    minor) echo "$major.$((minor+1)).0" ;;
    patch) echo "$major.$minor.$((patch+1))" ;;
    *)     echo "$type" ;;  # 直接使用指定版本
  esac
}

if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEW_VERSION="$BUMP_TYPE"
else
  NEW_VERSION=$(bump_version "$CURRENT" "$BUMP_TYPE")
fi

# 驗證語意版本格式
[[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || err "無效的版本號: $NEW_VERSION"
info "新版本:    v$NEW_VERSION"

# ── 確認 ──────────────────────────────────────────────────────
read -r -p "確認發布 v$NEW_VERSION？(y/N) " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { info "已取消"; exit 0; }

# ── 更新 package.json ─────────────────────────────────────────
info "更新 package.json 版本號..."
for pkg in package.json apps/api/package.json apps/web/package.json; do
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('$pkg', 'utf8'));
    p.version = '$NEW_VERSION';
    fs.writeFileSync('$pkg', JSON.stringify(p, null, 2) + '\n');
  "
  ok "$pkg → $NEW_VERSION"
done

# ── 更新 API dist (重新 build) ────────────────────────────────
info "重新編譯 API..."
cd apps/api && node_modules/.bin/nest build 2>&1 | tail -3
cd "$PROJECT_DIR"
ok "API 已重新編譯"

# ── Git commit + tag ──────────────────────────────────────────
info "提交版本變更..."
git add package.json apps/api/package.json apps/web/package.json docs/CHANGELOG.md
# Stage any other tracked modified files
git add -u

git commit -m "chore: release v${NEW_VERSION}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
ok "已提交並標記 v${NEW_VERSION}"

# ── Push to GitHub ────────────────────────────────────────────
info "推送至 GitHub..."
git push origin main
git push origin "v${NEW_VERSION}"
ok "已推送至 GitHub (main + tag v${NEW_VERSION})"

echo ""
echo "🚀 v${NEW_VERSION} 發布完成！"
echo "   https://github.com/$(git remote get-url origin | sed 's|https://github.com/||;s|\.git$||')/releases/tag/v${NEW_VERSION}"
