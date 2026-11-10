#!/usr/bin/env bash
# Ship Quest Log build artifacts into the vault plugin folder.
# Standing split (Micah): durable git tree stays at /workspace/Quest-Log-src;
# deployable plugin folder gets ONLY the three ship files (+ runtime data.json left alone).
# Standing: bump manifest.json (+ package.json) version on every push before ship.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_PLUGIN="/home/m1n1m0th/Documents/m0th Records/.obsidian/plugins/quest-log"
PLUGIN="${1:-${QUEST_LOG_PLUGIN:-$DEFAULT_PLUGIN}}"

PARENT="$(dirname "$PLUGIN")"
if [[ ! -d "$PARENT" ]]; then
  echo "No plugins folder at: $PARENT" >&2
  echo "Pass the plugin dir as \$1 or set QUEST_LOG_PLUGIN." >&2
  exit 1
fi

cd "$ROOT"

# Guardrail 1: the three version files must agree. Forgetting package-lock.json is how the
# repo ended up claiming 0.5.5 while shipping 0.6.52.
V_MANIFEST="$(node -p "require('./manifest.json').version")"
V_PKG="$(node -p "require('./package.json').version")"
V_LOCK="$(node -p "require('./package-lock.json').version")"
if [[ "$V_MANIFEST" != "$V_PKG" || "$V_MANIFEST" != "$V_LOCK" ]]; then
  echo "Version mismatch: manifest=$V_MANIFEST package=$V_PKG lock=$V_LOCK" >&2
  echo "Bump all three before shipping." >&2
  exit 1
fi
echo "Version $V_MANIFEST"

# Guardrail 2: tests before build. QUEST_LOG_SKIP_TESTS=1 bypasses for an emergency ship.
if [[ "${QUEST_LOG_SKIP_TESTS:-0}" != "1" ]]; then
  npm test
fi

npm run build

# Copy ONLY ship artifacts — never src/, node_modules/, .git/, or data.json.
# data.json is runtime state in the plugin dir; leave it untouched.
mkdir -p "$PLUGIN"
cp -a "$ROOT/main.js" "$ROOT/styles.css" "$ROOT/manifest.json" "$PLUGIN/"

echo "Shipped: main.js styles.css manifest.json → $PLUGIN"
echo "(data.json intentionally not copied/overwritten)"
