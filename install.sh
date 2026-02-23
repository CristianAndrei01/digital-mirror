#!/bin/bash
# Digital Mirror — Session Watcher Install
# Run as root on the OpenClaw bot server

set -e

echo ""
echo "  ◈ Installing Digital Mirror Session Watcher"
echo ""

# Check running as root
if [ "$EUID" -ne 0 ]; then
  echo "  ✗ Must run as root (sudo ./install.sh)"
  exit 1
fi

# Check Node.js installed
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install with:"
  echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "    apt install -y nodejs"
  exit 1
fi

NODE_VER=$(node -e "console.log(process.versions.node)")
echo "  ✓ Node.js $NODE_VER"

# Check OpenClaw sessions directory exists
OPENCLAW_HOME=${OPENCLAW_HOME:-/home/openclaw/.openclaw}
SESSIONS_DIR="$OPENCLAW_HOME/agents/main/sessions"

if [ ! -d "$SESSIONS_DIR" ]; then
  echo "  ✗ Sessions dir not found: $SESSIONS_DIR"
  echo "    Is the OpenClaw agent running and has it created at least one session?"
  echo "    If OpenClaw home is in a different location, set OPENCLAW_HOME before running:"
  echo "    OPENCLAW_HOME=/path/to/.openclaw sudo ./install.sh"
  exit 1
fi

echo "  ✓ OpenClaw sessions found at $SESSIONS_DIR"
echo ""

# Determine which user runs OpenClaw (default: openclaw, fallback: root)
if id "openclaw" &> /dev/null; then
  WATCHER_USER="openclaw"
  WATCHER_GROUP="openclaw"
else
  WATCHER_USER="root"
  WATCHER_GROUP="root"
  echo "  ⚠ User 'openclaw' not found — running watcher as root"
fi

echo "  ✓ Watcher will run as: $WATCHER_USER"

# Create install directory
mkdir -p /opt/mirror-watcher

# Copy watcher script
cp mirror-watcher.js /opt/mirror-watcher/

# Copy env file if not already present (don't overwrite existing config)
if [ ! -f /opt/mirror-watcher/mirror-watcher.env ]; then
  cp mirror-watcher.env.example /opt/mirror-watcher/mirror-watcher.env
  echo ""
  echo "  ◈ ACTION REQUIRED: Edit /opt/mirror-watcher/mirror-watcher.env"
  echo "    Set MIRROR_ENDPOINT to your Digital Mirror server IP:"
  echo "    MIRROR_ENDPOINT=http://YOUR_MIRROR_SERVER_IP:3000/api/entry"
  echo ""
else
  echo "  ✓ Config already exists — skipping (not overwriting)"
fi

chown -R $WATCHER_USER:$WATCHER_GROUP /opt/mirror-watcher

# Install systemd service (with correct user)
sed "s/User=openclaw/User=$WATCHER_USER/; s/Group=openclaw/Group=$WATCHER_GROUP/" \
  mirror-watcher.service > /etc/systemd/system/mirror-watcher.service

systemctl daemon-reload
systemctl enable mirror-watcher

# Only start if config has been edited (MIRROR_ENDPOINT is set)
if grep -q "YOUR_MIRROR_SERVER_IP" /opt/mirror-watcher/mirror-watcher.env; then
  echo ""
  echo "  ⚠ MIRROR_ENDPOINT not configured yet."
  echo "    Edit /opt/mirror-watcher/mirror-watcher.env, then run:"
  echo "    systemctl start mirror-watcher"
  echo ""
else
  systemctl start mirror-watcher
  echo ""
  echo "  ✓ Installed and running"
  echo ""
  echo "  systemctl status mirror-watcher"
  echo "  journalctl -u mirror-watcher -f"
  echo ""
  systemctl status mirror-watcher --no-pager
fi
