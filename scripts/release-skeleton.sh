#!/bin/bash
set -euo pipefail

# ============================================================================
# RELEASE SCRIPT SKELETON
# Copy this file and fill in each TODO section for your project.
# Designed so an AI (or human) can quickly scaffold a full release pipeline.
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ============================================================================
# USER CONFIG
# ============================================================================

PROJECT_NAME="your-project"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
PACKAGE_DIR="$PROJECT_DIR/packaging"
REMOTE_REPO="your-org/your-project"
DEFAULT_BRANCH="main"

# Optional external publish targets
PACKAGE_REPO_DIR="$HOME/your-package-repo"

# Timing
STEP_START=0
TOTAL_START=0
VERSION=""
NEXT_VERSION=""

# ============================================================================
# UTILITIES
# ============================================================================

print_header() {
  clear
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║${NC}            ${BOLD}${CYAN}${PROJECT_NAME} Release Builder${NC}                    ${BLUE}║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

print_step() {
  local step=$1
  local total=$2
  local msg=$3
  STEP_START=$(date +%s)
  echo ""
  echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}[$step/$total]${NC} ${BOLD}$msg${NC}"
  echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_substep() { echo -e "  ${DIM}→${NC} $1"; }
print_success() { echo -e "  ${GREEN}✓${NC} $1 ${DIM}($(($(date +%s) - STEP_START))s)${NC}"; }
print_error() { echo -e "  ${RED}✗${NC} $1"; }
print_warning() { echo -e "  ${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

format_time() {
  local seconds=$1
  if [ "$seconds" -ge 60 ]; then
    echo "$((seconds / 60))m $((seconds % 60))s"
  else
    echo "${seconds}s"
  fi
}

print_file_size() {
  local file=$1
  [ -f "$file" ] || return 0
  echo -e "  ${GREEN}✓${NC} $(basename "$file") ${DIM}($(du -h "$file" | cut -f1))${NC}"
}

spinner() {
  local pid=$1
  local msg=$2
  local spin='|/-\'
  local i=0
  tput civis
  while kill -0 "$pid" 2>/dev/null; do
    i=$(((i + 1) % 4))
    printf "\r  ${CYAN}%s${NC} %s" "${spin:$i:1}" "$msg"
    sleep 0.1
  done
  tput cnorm
  printf "\r"
}

run_with_spinner() {
  local msg=$1
  shift
  "$@" >/tmp/release_skeleton_cmd.log 2>&1 &
  local pid=$!
  spinner "$pid" "$msg"
  wait "$pid" || {
    print_error "$msg"
    tail -20 /tmp/release_skeleton_cmd.log
    return 1
  }
  print_success "$msg"
}

# ============================================================================
# PREFLIGHT CHECKS
# ============================================================================

preflight_release() {
  print_substep "Running preflight checks..."

  # TODO: check required CLIs, auth, files, and branch state.
  # Example:
  # command -v gh >/dev/null || { print_error "gh not found"; return 1; }
  # gh auth status >/dev/null 2>&1 || { print_error "gh not authenticated"; return 1; }

  print_success "Preflight checks passed"
}

# ============================================================================
# VERSION MANAGEMENT
# ============================================================================

read_version() {
  # TODO: read version from your source of truth.
  # Example (Node):
  # VERSION=$(node -p "require('$PROJECT_DIR/package.json').version")
  # Example (Python):
  # VERSION=$(python -c "import tomllib;print(tomllib.load(open('pyproject.toml','rb'))['project']['version'])")

  VERSION="${VERSION:-0.0.0}"
}

suggest_next_patch() {
  NEXT_VERSION=""
  if [[ $VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    NEXT_VERSION="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
  fi
}

bump_version() {
  read_version
  suggest_next_patch
  echo -e "\n  Current version: ${GREEN}v$VERSION${NC}"
  [ -n "$NEXT_VERSION" ] && echo -e "  Suggested next:  ${CYAN}v$NEXT_VERSION${NC}"

  # TODO: replace with your version bump strategy.
  # Common pattern:
  # read -p "  Bump to suggested version? [Y/n] " -n 1 -r
  # npm -C "$PROJECT_DIR" version "$NEXT_VERSION" --no-git-tag-version

  print_success "Version bump step complete"
}

# ============================================================================
# BUILD FUNCTIONS
# ============================================================================

clean_builds() {
  print_substep "Cleaning build artifacts..."
  # TODO: remove old outputs.
  # Example:
  # rm -rf "$DIST_DIR"/*
  print_success "Clean complete"
}

build_app() {
  print_substep "Building application..."
  # TODO: your build command(s).
  # Example:
  # run_with_spinner "Running app build..." npm -C "$PROJECT_DIR" run build
  print_success "App build complete"
}

build_packages() {
  print_substep "Building release packages..."
  # TODO: create release artifacts (zip/deb/rpm/tar/etc).
  # Example:
  # run_with_spinner "Building package..." make package
  print_success "Package build complete"
}

# ============================================================================
# GIT & RELEASE FUNCTIONS
# ============================================================================

commit_changes() {
  if [ -z "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
    print_info "No changes to commit"
    return 0
  fi

  local default_msg="chore: release v$VERSION"
  read -p "  Commit message [$default_msg]: " msg
  msg=${msg:-$default_msg}

  git -C "$PROJECT_DIR" add -A
  git -C "$PROJECT_DIR" commit -m "$msg"
  print_success "Changes committed"
}

push_changes() {
  print_substep "Pushing to $DEFAULT_BRANCH..."
  run_with_spinner "Pushing commits..." git -C "$PROJECT_DIR" push origin "$DEFAULT_BRANCH"
}

create_remote_release() {
  # TODO: create tag + remote release (GitHub/GitLab/etc).
  # Example (GitHub CLI):
  # local tag="v$VERSION"
  # git -C "$PROJECT_DIR" tag -a "$tag" -m "Release $tag"
  # git -C "$PROJECT_DIR" push origin "$tag"
  # gh release create "$tag" --title "$PROJECT_NAME $tag" --repo "$REMOTE_REPO"
  print_success "Remote release step complete"
}

publish_packages() {
  # TODO: publish to package repo/registry (AUR, npm, PyPI, Docker, etc).
  # Example:
  # npm publish
  print_success "Package publish step complete"
}

# ============================================================================
# FULL RELEASE WORKFLOW
# ============================================================================

full_release() {
  TOTAL_START=$(date +%s)
  local total_steps=8

  print_step 1 $total_steps "Preflight checks"
  preflight_release

  print_step 2 $total_steps "Version bump"
  bump_version

  print_step 3 $total_steps "Clean old builds"
  clean_builds

  print_step 4 $total_steps "Build app"
  build_app

  print_step 5 $total_steps "Build packages"
  build_packages

  print_step 6 $total_steps "Commit and push"
  commit_changes
  push_changes

  print_step 7 $total_steps "Create remote release"
  create_remote_release

  print_step 8 $total_steps "Publish packages"
  publish_packages

  local total_time=$(($(date +%s) - TOTAL_START))
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${GREEN}  ✓ Release workflow complete${NC} ${DIM}($(format_time "$total_time"))${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================================================
# MENU
# ============================================================================

show_status() {
  read_version
  suggest_next_patch
  echo -e "  ${BOLD}Version:${NC}  ${GREEN}v$VERSION${NC}"
  [ -n "$NEXT_VERSION" ] && echo -e "  ${BOLD}Next:${NC}     ${DIM}v$NEXT_VERSION${NC}"
  echo ""
}

main_menu() {
  while true; do
    print_header
    show_status
    echo -e "  ${BOLD}${CYAN}Actions${NC}"
    echo -e "  ${DIM}─────────────────────────────${NC}"
    echo "   1) Preflight checks"
    echo "   2) Bump version"
    echo "   3) Clean builds"
    echo "   4) Build app"
    echo "   5) Build packages"
    echo "   6) Commit changes"
    echo "   7) Push changes"
    echo "   8) Create remote release"
    echo "   9) Publish packages"
    echo "  10) Full release"
    echo "   0) Exit"
    echo ""

    read -p "  Choose [0-10]: " choice
    case $choice in
    1) preflight_release ;;
    2) bump_version ;;
    3) clean_builds ;;
    4) build_app ;;
    5) build_packages ;;
    6) commit_changes ;;
    7) push_changes ;;
    8) create_remote_release ;;
    9) publish_packages ;;
    10) full_release ;;
    0) echo ""; exit 0 ;;
    *) print_error "Invalid choice" ;;
    esac
    echo ""
    read -p "  Press Enter to continue..." -r
  done
}

main_menu
