#!/bin/bash
# After-install script for .deb package
# Creates a wrapper script that detaches from terminal

INSTALL_DIR="/opt/Alogi"
BIN_LINK="/usr/bin/alogi"

# Fix chrome-sandbox permissions (required for Electron)
if [ -f "$INSTALL_DIR/chrome-sandbox" ]; then
    chown root:root "$INSTALL_DIR/chrome-sandbox"
    chmod 4755 "$INSTALL_DIR/chrome-sandbox"
fi

# Remove the symlink created by electron-builder
if [ -L "$BIN_LINK" ]; then
    rm "$BIN_LINK"
fi

# Create wrapper script
cat > "$BIN_LINK" << 'EOF'
#!/bin/bash
/opt/Alogi/alogi "$@" &>/dev/null & disown
EOF

chmod 755 "$BIN_LINK"
