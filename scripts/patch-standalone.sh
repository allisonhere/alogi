#!/bin/bash
# Post-build script to copy missing Turbopack runtime files to standalone output
# This fixes the "Cannot find module app-route-turbo.runtime.prod.js" error

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STANDALONE_NEXT_SERVER="$PROJECT_DIR/.next/standalone/node_modules/next/dist/compiled/next-server"
SOURCE_NEXT_SERVER="$PROJECT_DIR/node_modules/next/dist/compiled/next-server"

if [ ! -d "$STANDALONE_NEXT_SERVER" ]; then
    echo "Error: Standalone next-server directory not found. Run 'npm run build' first."
    exit 1
fi

if [ ! -d "$SOURCE_NEXT_SERVER" ]; then
    echo "Error: Source next-server directory not found."
    exit 1
fi

echo "Patching standalone build with missing Turbopack runtime files..."

# Copy all turbo runtime prod files that are missing
for file in "$SOURCE_NEXT_SERVER"/*-turbo*.runtime.prod.js; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        if [ ! -f "$STANDALONE_NEXT_SERVER/$filename" ]; then
            echo "  Copying $filename"
            cp "$file" "$STANDALONE_NEXT_SERVER/"
        fi
    fi
done

echo "Done!"
