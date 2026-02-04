#!/bin/bash
# After-install script for .deb package
# Creates a wrapper script that detaches from terminal

INSTALL_DIR="/opt/Alogi"
BIN_LINK="/usr/bin/alogi"

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
