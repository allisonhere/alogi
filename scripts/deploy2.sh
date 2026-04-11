#!/bin/bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSH_REMOTE="git@github.com:allisonhere/alogi.git"
ARCH_DIR="$PROJECT_DIR/packaging/arch"
AUR_DIR="$HOME/aur-alogi"

print_step() {
  echo -e "\n${BOLD}${CYAN}[$1/$2]${NC} ${BOLD}$3${NC}"
}

print_success() {
  echo -e "  ${GREEN}✓${NC} $1"
}

print_error() {
  echo -e "  ${RED}✗${NC} $1"
}

print_info() {
  echo -e "  ${BLUE}ℹ${NC} $1"
}

print_warning() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

read_version() {
  VERSION=$(node -p "require('$PROJECT_DIR/package.json').version" 2>/dev/null) || {
    print_error "Unable to read version from package.json"
    exit 1
  }
}

# Ensure origin is SSH
ensure_ssh_remote() {
  local current_url
  current_url=$(git -C "$PROJECT_DIR" remote get-url origin 2>/dev/null || true)

  if [ "$current_url" != "$SSH_REMOTE" ]; then
    print_warning "Remote 'origin' is not SSH, updating..."
    git -C "$PROJECT_DIR" remote set-url origin "$SSH_REMOTE"
    print_success "Remote set to $SSH_REMOTE"
  else
    print_success "Remote is SSH: $SSH_REMOTE"
  fi
}

commit_changes() {
  if [ -z "$(git -C "$PROJECT_DIR" status --porcelain)" ]; then
    print_info "No changes to commit"
    return 0
  fi

  echo ""
  git -C "$PROJECT_DIR" status --short
  echo ""

  local default_msg="chore: release v$VERSION"
  read -p "  Commit message [$default_msg]: " msg
  msg=${msg:-$default_msg}

  git -C "$PROJECT_DIR" add -A
  git -C "$PROJECT_DIR" commit -m "$msg"
  print_success "Changes committed"
}

push_changes() {
  git -C "$PROJECT_DIR" push "$SSH_REMOTE" main
  print_success "Pushed to origin (SSH)"
}

create_tag() {
  local TAG="v$VERSION"

  if git -C "$PROJECT_DIR" rev-parse "$TAG" &>/dev/null; then
    print_warning "Tag $TAG already exists"
    read -p "  Delete and recreate? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      git -C "$PROJECT_DIR" tag -d "$TAG" >/dev/null
      git -C "$PROJECT_DIR" push "$SSH_REMOTE" --delete "$TAG" 2>/dev/null || true
      print_success "Old tag deleted"
    else
      return 1
    fi
  fi

  git -C "$PROJECT_DIR" tag -a "$TAG" -m "Release $TAG"
  git -C "$PROJECT_DIR" push "$SSH_REMOTE" "$TAG"
  print_success "Tag $TAG created and pushed"
}

create_github_release() {
  local TAG="v$VERSION"

  if ! gh auth status &>/dev/null 2>&1; then
    print_error "Not logged into GitHub CLI. Run 'gh auth login'"
    return 1
  fi

  local NOTES=""
  if [ -f "$PROJECT_DIR/CHANGELOG.md" ]; then
    NOTES=$(awk -v ver="$VERSION" '
      $0 ~ "^## \\["ver"\\]" {found=1; next}
      found && $0 ~ "^## \\[" {exit}
      found {print}
    ' "$PROJECT_DIR/CHANGELOG.md")
  fi
  [ -z "$NOTES" ] && NOTES="Release $TAG"

  # Wait for CI release workflow
  local commit_sha
  commit_sha=$(git -C "$PROJECT_DIR" rev-list -n1 "$TAG")
  print_info "Waiting for release workflow (tag: $TAG, commit: ${commit_sha:0:8})..."

  local timeout=1800 poll=10 waited=0
  while [ $waited -lt $timeout ]; do
    local run_meta
    run_meta=$(gh run list \
      --repo allisonhere/alogi \
      --workflow release.yml \
      --commit "$commit_sha" \
      --event push \
      --limit 1 \
      --json databaseId,status,conclusion \
      --jq 'if length == 0 then "" else "\(.[0].databaseId) \(.[0].status) \(.[0].conclusion)" end' 2>/dev/null || true)

    if [ -n "$run_meta" ]; then
      local run_id status conclusion
      read -r run_id status conclusion <<<"$run_meta"
      if [ "$status" = "completed" ]; then
        if [ "$conclusion" = "success" ]; then
          print_success "Release workflow succeeded (run: $run_id)"
          break
        fi
        print_error "Release workflow failed (run: $run_id, conclusion: $conclusion)"
        return 1
      fi
    fi

    sleep "$poll"
    waited=$((waited + poll))
  done

  if [ $waited -ge $timeout ]; then
    print_error "Timed out waiting for release workflow"
    return 1
  fi

  gh release edit "$TAG" \
    --title "Alogi $TAG" \
    --notes "$NOTES" \
    --repo allisonhere/alogi
  print_success "Release metadata updated"
  echo -e "\n  ${GREEN}→${NC} https://github.com/allisonhere/alogi/releases/tag/$TAG"
}

update_aur() {
  if [ ! -d "$AUR_DIR" ]; then
    print_error "AUR directory not found at $AUR_DIR"
    print_info "Clone it first: git clone ssh://aur@aur.archlinux.org/alogi.git $AUR_DIR"
    return 1
  fi

  # Fetch SHA from GitHub release tarball
  local GITHUB_TARBALL="https://github.com/allisonhere/alogi/releases/download/v${VERSION}/alogi-${VERSION}-linux-unpacked.tar.gz"

  print_info "Fetching SHA256 from GitHub release..."
  local tmp_tarball
  tmp_tarball=$(mktemp)
  if ! curl -fsSL "$GITHUB_TARBALL" -o "$tmp_tarball"; then
    rm -f "$tmp_tarball"
    print_error "Failed to download release tarball"
    print_info "Make sure the release exists: $GITHUB_TARBALL"
    return 1
  fi
  local SHA256
  SHA256=$(sha256sum "$tmp_tarball" | awk '{print $1}')
  rm -f "$tmp_tarball"
  print_success "SHA256: ${SHA256:0:16}..."

  print_info "Pulling latest from AUR..."
  cd "$AUR_DIR"
  if [ -n "$(git status --porcelain)" ]; then
    print_warning "AUR repo has local changes, stashing before pull"
    git stash -u -m "alogi-release-auto-stash"
  fi
  git pull
  print_success "AUR repo updated"

  # Ensure we're on a branch (not detached HEAD)
  if ! git symbolic-ref -q HEAD >/dev/null; then
    if git show-ref --verify --quiet refs/remotes/origin/master; then
      git checkout -B master origin/master
    elif git show-ref --verify --quiet refs/remotes/origin/main; then
      git checkout -B main origin/main
    elif git show-ref --verify --quiet refs/heads/master; then
      git checkout master
    elif git show-ref --verify --quiet refs/heads/main; then
      git checkout main
    else
      git checkout -B master
    fi
    print_success "Checked out AUR branch"
  fi

  print_info "Syncing AUR packaging files..."
  local AUR_SRC="$PROJECT_DIR/packaging/arch/aur"
  [ -f "$AUR_SRC/PKGBUILD" ] && cp -f "$AUR_SRC/PKGBUILD" "$AUR_DIR/PKGBUILD"
  [ -f "$AUR_SRC/README.md" ] && cp -f "$AUR_SRC/README.md" "$AUR_DIR/README.md"
  if [ -f "$AUR_SRC/alogi.desktop" ]; then
    cp -f "$AUR_SRC/alogi.desktop" "$AUR_DIR/alogi.desktop"
  elif [ -f "$ARCH_DIR/alogi.desktop" ]; then
    cp -f "$ARCH_DIR/alogi.desktop" "$AUR_DIR/alogi.desktop"
  fi
  [ -f "$AUR_SRC/icon.png" ] && cp -f "$AUR_SRC/icon.png" "$AUR_DIR/icon.png"
  print_success "AUR packaging files synced"

  print_info "Updating PKGBUILD..."
  sed -i "s/^pkgver=.*/pkgver=$VERSION/" PKGBUILD
  SHA256="$SHA256" python3 - <<'PY'
import os
import re
from pathlib import Path

path = Path("PKGBUILD")
text = path.read_text()
sha = os.environ["SHA256"]

def replace_first_sha(match: re.Match) -> str:
    return f'{match.group(1)}  "{sha}"'

new_text = re.sub(r'(sha256sums=\(\s*)\"[^\"]*\"', replace_first_sha, text, count=1)
if new_text == text:
    raise SystemExit("Failed to update sha256sums in PKGBUILD")
path.write_text(new_text)
PY
  print_success "PKGBUILD updated"

  print_info "Generating .SRCINFO..."
  makepkg --printsrcinfo >.SRCINFO
  print_success ".SRCINFO generated"

  print_info "Committing and pushing..."
  if git diff --quiet; then
    print_info "No AUR changes to publish"
    return 0
  fi
  local add_files=(PKGBUILD .SRCINFO)
  [ -f alogi.desktop ] && add_files+=(alogi.desktop)
  [ -f icon.png ] && add_files+=(icon.png)
  [ -f README.md ] && add_files+=(README.md)
  git add "${add_files[@]}"
  git commit -m "Update to $VERSION"
  git push
  print_success "Pushed to AUR"

  echo -e "\n  ${GREEN}→${NC} https://aur.archlinux.org/packages/alogi"
}

# ============================================================================
# MAIN
# ============================================================================

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}             ${BOLD}${CYAN}Alogi Deploy (SSH)${NC}                              ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

read_version
echo -e "\n  Version: ${GREEN}v$VERSION${NC}"

total=6

print_step 1 $total "Verifying SSH remote"
ensure_ssh_remote

print_step 2 $total "Committing changes"
commit_changes

print_step 3 $total "Pushing via SSH"
push_changes

print_step 4 $total "Creating tag"
create_tag

print_step 5 $total "GitHub release"
create_github_release

print_step 6 $total "Updating AUR"
update_aur

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✓ Deploy v$VERSION complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}→${NC} GitHub: https://github.com/allisonhere/alogi/releases/tag/v$VERSION"
echo -e "  ${CYAN}→${NC} AUR:    https://aur.archlinux.org/packages/alogi"
echo ""
