#!/usr/bin/env bash
# Ship Quest Log build artifacts into the vault plugin folder.
# Standing split (Micah): durable git tree stays at /workspace/Quest-Log-src;
# deployable plugin folder gets ONLY the three ship files (+ runtime data.json left alone).
# Standing: bump manifest.json (+ package.json) version on every push before ship.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="/home/box/vaults/Mothball Studios/.obsidian/plugins/quest-log"

cd "$ROOT"
npm run build

# Copy ONLY ship artifacts — never src/, node_modules/, .git/, or data.json.
# data.json is runtime state in the plugin dir; leave it untouched.
mkdir -p "$PLUGIN"
cp -a "$ROOT/main.js" "$ROOT/styles.css" "$ROOT/manifest.json" "$PLUGIN/"

echo "Shipped: main.js styles.css manifest.json → $PLUGIN"
echo "(data.json intentionally not copied/overwritten)"
