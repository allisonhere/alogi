#!/bin/bash
# After-install script for .deb package
# Creates a wrapper script that detaches from terminal

INSTALL_DIR="/opt/alogi"
BIN_LINK="/usr/bin/alogi"

# Fix chrome-sandbox permissions (required for Electron)
if [ ! -d "$INSTALL_DIR" ] && [ -d "/opt/Alogi" ]; then
    INSTALL_DIR="/opt/Alogi"
fi

if [ -f "$INSTALL_DIR/chrome-sandbox" ]; then
    chown root:root "$INSTALL_DIR/chrome-sandbox"
    chmod 4755 "$INSTALL_DIR/chrome-sandbox"
fi

# Remove the symlink created by electron-builder
if [ -L "$BIN_LINK" ]; then
    rm "$BIN_LINK"
fi

# Create wrapper script
cat > "$BIN_LINK" << EOF
#!/bin/bash
BIN="$INSTALL_DIR/alogi"
if [ ! -x "$BIN" ] && [ -x "/opt/Alogi/alogi" ]; then
  BIN="/opt/Alogi/alogi"
fi
if [ ! -x "$BIN" ] && [ -x "/opt/alogi/alogi" ]; then
  BIN="/opt/alogi/alogi"
fi

for arg in "\$@"; do
  case "\$arg" in
    --web|--desktop|--help|-h)
      exec "\$BIN" "\$@"
      ;;
  esac
done

"\$BIN" "\$@" &>/dev/null & disown
EOF

chmod 755 "$BIN_LINK"
