#!/bin/bash
# Post-build script to copy missing Next.js runtime files to standalone output.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_NEXT_PACKAGE="$PROJECT_DIR/node_modules/next"
PUBLIC_DIR="$PROJECT_DIR/public"
STANDALONE_ROOTS=(
    "$PROJECT_DIR/.next/standalone"
    "$PROJECT_DIR/.next/standalone/Projects/alogi"
)
NEXT_RUNTIME_PACKAGES=(
    "@next/env"
    "@swc/helpers"
    "baseline-browser-mapping"
    "caniuse-lite"
    "postcss"
    "react"
    "react-dom"
    "styled-jsx"
)

if [ ! -d "$SOURCE_NEXT_PACKAGE" ]; then
    echo "Error: Source Next.js package directory not found."
    exit 1
fi

echo "Patching standalone build with missing Next.js runtime files..."

patched=0

copy_package() {
    local package_name="$1"
    local target_node_modules="$2"
    local source_package="$PROJECT_DIR/node_modules/$package_name"
    local target_package="$target_node_modules/$package_name"
    local target_parent

    if [ ! -d "$source_package" ]; then
        return
    fi

    target_parent="$(dirname "$target_package")"
    mkdir -p "$target_parent"
    if [ -d "$target_package" ]; then
        cp -Rn "$source_package"/. "$target_package/"
    else
        cp -Rn "$source_package" "$target_package"
    fi
}

copy_public_assets() {
    local standalone_root="$1"
    local target_public="$standalone_root/public"

    if [ ! -d "$PUBLIC_DIR" ]; then
        return
    fi

    mkdir -p "$target_public"
    cp -R "$PUBLIC_DIR"/. "$target_public/"
}

for standalone_root in "${STANDALONE_ROOTS[@]}"; do
    standalone_node_modules="$standalone_root/node_modules"
    standalone_next_package="$standalone_root/node_modules/next"

    if [ ! -d "$standalone_next_package" ]; then
        continue
    fi

    echo "  Patching $standalone_root"
    patched=1

    cp -Rn "$SOURCE_NEXT_PACKAGE"/. "$standalone_next_package/"
    for package_name in "${NEXT_RUNTIME_PACKAGES[@]}"; do
        copy_package "$package_name" "$standalone_node_modules"
    done
    copy_public_assets "$standalone_root"
done

if [ "$patched" -eq 0 ]; then
    echo "No standalone Next.js runtime directories found; nothing to patch."
else
    echo "Done!"
fi
