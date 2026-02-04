#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist-electron"
ARCH_DIR="$PROJECT_DIR/packaging/arch"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Alogi Release Builder            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get version from package.json
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found${NC}"
    exit 1
fi
if ! VERSION=$(node -p "require('$PROJECT_DIR/package.json').version" 2>/dev/null); then
    echo -e "${RED}Error: Unable to read version from package.json${NC}"
    exit 1
fi
if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: package.json version is empty${NC}"
    exit 1
fi
echo -e "Current version: ${GREEN}v$VERSION${NC}"
echo ""

# Check disk space
AVAIL=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
echo -e "Available disk space: ${AVAIL}GB"
if [ "$AVAIL" -lt 5 ]; then
    echo -e "${RED}WARNING: Less than 5GB free. Build may fail.${NC}"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi
echo ""

# Check for uncommitted changes
if [ -n "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
    echo -e "${YELLOW}WARNING: You have uncommitted changes${NC}"
    git -C "$PROJECT_DIR" status --short
    echo ""
fi

# Menu
echo -e "${BLUE}What would you like to do?${NC}"
echo "  1) Build all packages (AppImage + deb + Arch)"
echo "  2) Build AppImage only"
echo "  3) Build deb only"
echo "  4) Build Arch package only"
echo "  5) Clean old builds"
echo "  6) Create GitHub release"
echo "  7) Full release (build all + GitHub release)"
echo "  8) Exit"
echo ""
read -p "Choose [1-8]: " choice

BUILD_NEXTJS_DONE=0

run_electron_builder() {
    local eb_cmd=""
    if [ -x "$PROJECT_DIR/node_modules/.bin/electron-builder" ]; then
        eb_cmd="$PROJECT_DIR/node_modules/.bin/electron-builder"
    elif command -v electron-builder &> /dev/null; then
        eb_cmd="electron-builder"
    else
        echo -e "${RED}Error: electron-builder not found. Run npm install first.${NC}"
        return 1
    fi

    "$eb_cmd" "$@"
}

update_pkgbuild_version() {
    if sed --version &> /dev/null; then
        sed -i "s/^pkgver=.*/pkgver=$VERSION/" "$ARCH_DIR/PKGBUILD"
    else
        sed -i '' "s/^pkgver=.*/pkgver=$VERSION/" "$ARCH_DIR/PKGBUILD"
    fi
}

clean_builds() {
    echo -e "${YELLOW}Cleaning old builds...${NC}"
    rm -rf "$DIST_DIR/linux-unpacked"
    rm -f "$DIST_DIR"/*.AppImage
    rm -f "$DIST_DIR"/*.deb
    rm -f "$DIST_DIR"/*.tar.gz
    rm -f "$DIST_DIR"/*.pkg.tar.zst
    rm -f "$ARCH_DIR"/*.pkg.tar.zst
    rm -f "$ARCH_DIR/linux-unpacked.tar.gz"
    rm -rf "$ARCH_DIR/pkg" "$ARCH_DIR/src"
    echo -e "${GREEN}Cleaned!${NC}"
}

build_nextjs() {
    echo -e "${BLUE}Building Next.js...${NC}"
    cd "$PROJECT_DIR"
    npm run build:desktop
    BUILD_NEXTJS_DONE=1
}

build_appimage() {
    echo -e "${BLUE}Building AppImage...${NC}"
    cd "$PROJECT_DIR"
    run_electron_builder --linux AppImage --publish never
    echo -e "${GREEN}AppImage built: $DIST_DIR/Alogi-x86_64.AppImage${NC}"
}

build_deb() {
    echo -e "${BLUE}Building .deb package...${NC}"
    cd "$PROJECT_DIR"
    run_electron_builder --linux deb --publish never
    echo -e "${GREEN}Deb built: $DIST_DIR/Alogi-amd64.deb${NC}"
}

build_arch() {
    echo -e "${BLUE}Building Arch package...${NC}"

    if [ "$BUILD_NEXTJS_DONE" -eq 0 ]; then
        build_nextjs
    fi

    echo "Building linux-unpacked..."
    cd "$PROJECT_DIR"
    run_electron_builder --linux dir --publish never

    # Create tarball
    echo "Creating tarball..."
    tar -C "$DIST_DIR" -czf "$ARCH_DIR/linux-unpacked.tar.gz" linux-unpacked

    # Update PKGBUILD version
    update_pkgbuild_version

    # Clean previous build artifacts
    rm -rf "$ARCH_DIR/pkg" "$ARCH_DIR/src"

    # Build package
    cd "$ARCH_DIR"
    makepkg -f

    # Copy to dist-electron
    cp "$ARCH_DIR"/alogi-*.pkg.tar.zst "$DIST_DIR/" 2>/dev/null || true

    echo -e "${GREEN}Arch package built!${NC}"
}

create_github_release() {
    echo -e "${BLUE}Creating GitHub release...${NC}"

    # Check if gh is installed
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}Error: GitHub CLI (gh) not installed${NC}"
        return 1
    fi

    # Check if logged in
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}Error: Not logged into GitHub CLI. Run 'gh auth login'${NC}"
        return 1
    fi

    TAG="v$VERSION"

    # Require a clean working tree before tagging
    if [ -n "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
        echo -e "${YELLOW}WARNING: Working tree has uncommitted changes.${NC}"
        echo -e "${YELLOW}Tagging will not include those changes.${NC}"
        read -p "Continue anyway? [y/N] " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && return 1
    fi

    # Check if tag exists
    if git -C "$PROJECT_DIR" rev-parse "$TAG" &> /dev/null; then
        echo -e "${YELLOW}Tag $TAG already exists${NC}"
        read -p "Delete and recreate? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git -C "$PROJECT_DIR" tag -d "$TAG"
            git -C "$PROJECT_DIR" push origin --delete "$TAG" 2>/dev/null || true
        else
            return 1
        fi
    fi

    # Create tag
    git -C "$PROJECT_DIR" tag -a "$TAG" -m "Release $TAG"
    git -C "$PROJECT_DIR" push origin "$TAG"

    # Get changelog entry for this version
    if [ ! -f "$PROJECT_DIR/CHANGELOG.md" ]; then
        echo -e "${RED}Error: CHANGELOG.md not found${NC}"
        return 1
    fi
    NOTES=$(awk -v ver="$VERSION" '
        $0 ~ "^## \\["ver"\\]" {found=1; next}
        found && $0 ~ "^## \\[" {exit}
        found {print}
    ' "$PROJECT_DIR/CHANGELOG.md")
    if [ -z "$NOTES" ]; then
        echo -e "${YELLOW}WARNING: No changelog entry found for version $VERSION${NC}"
        read -p "Continue without changelog notes? [y/N] " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && return 1
        NOTES="Release $TAG"
    fi

    # Create release
    echo "Creating release $TAG..."
    gh release create "$TAG" \
        --title "Alogi $TAG" \
        --notes "$NOTES" \
        --repo allisonhere/alogi

    # Upload assets
    echo "Uploading assets..."
    [ -f "$DIST_DIR/Alogi-x86_64.AppImage" ] && gh release upload "$TAG" "$DIST_DIR/Alogi-x86_64.AppImage" --repo allisonhere/alogi
    [ -f "$DIST_DIR/Alogi-amd64.deb" ] && gh release upload "$TAG" "$DIST_DIR/Alogi-amd64.deb" --repo allisonhere/alogi

    # Upload Arch package with standardized name
    ARCH_PKG=$(ls "$DIST_DIR"/alogi-*.pkg.tar.zst 2>/dev/null | head -1)
    if [ -n "$ARCH_PKG" ]; then
        gh release upload "$TAG" "$ARCH_PKG#alogi-arch.pkg.tar.zst" --repo allisonhere/alogi
    fi

    echo -e "${GREEN}GitHub release created: https://github.com/allisonhere/alogi/releases/tag/$TAG${NC}"
}

case $choice in
    1)
        clean_builds
        build_nextjs
        build_appimage
        build_deb
        build_arch
        echo ""
        echo -e "${GREEN}All packages built!${NC}"
        ls -lh "$DIST_DIR"/*.AppImage "$DIST_DIR"/*.deb "$DIST_DIR"/*.pkg.tar.zst 2>/dev/null
        ;;
    2)
        clean_builds
        build_nextjs
        build_appimage
        ;;
    3)
        clean_builds
        build_nextjs
        build_deb
        ;;
    4)
        build_arch
        ;;
    5)
        clean_builds
        ;;
    6)
        create_github_release
        ;;
    7)
        clean_builds
        build_nextjs
        build_appimage
        build_deb
        build_arch
        echo ""
        echo -e "${GREEN}All packages built!${NC}"
        ls -lh "$DIST_DIR"/*.AppImage "$DIST_DIR"/*.deb "$DIST_DIR"/*.pkg.tar.zst 2>/dev/null
        echo ""
        create_github_release
        ;;
    8)
        echo "Bye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
