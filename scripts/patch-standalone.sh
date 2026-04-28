#!/bin/bash
# Post-build script to copy missing Next.js runtime files to standalone output.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_NEXT_DIST="$PROJECT_DIR/node_modules/next/dist"
STANDALONE_ROOTS=(
    "$PROJECT_DIR/.next/standalone"
    "$PROJECT_DIR/.next/standalone/Projects/alogi"
)

if [ ! -d "$SOURCE_NEXT_DIST" ]; then
    echo "Error: Source Next.js dist directory not found."
    exit 1
fi

echo "Patching standalone build with missing Next.js runtime files..."

patched=0

for standalone_root in "${STANDALONE_ROOTS[@]}"; do
    standalone_next_dist="$standalone_root/node_modules/next/dist"

    if [ ! -d "$standalone_root/node_modules/next" ]; then
        continue
    fi

    echo "  Patching $standalone_root"
    patched=1

    mkdir -p "$standalone_next_dist"
    cp -Rn "$SOURCE_NEXT_DIST"/. "$standalone_next_dist/"
done

if [ "$patched" -eq 0 ]; then
    echo "No standalone Next.js runtime directories found; nothing to patch."
else
    echo "Done!"
fi
