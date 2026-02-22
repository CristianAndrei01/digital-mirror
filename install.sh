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

# Check openclaw user exists
if ! id "openclaw" &> /dev/null; then
  echo "  ✗ User 'openclaw' not found. Is OpenClaw installed?"
  exit 1
fi

echo "  ✓ User openclaw exists"

# Check OpenClaw sessions directory exists
OPENCLAW_HOME="/home/openclaw/.openclaw"
SESSIONS_DIR="$OPENCLAW_HOME/agents/main/sessions"
if [ ! -d "$SESSIONS_DIR" ]; then
  echo "  ✗ Sessions dir not found: $SESSIONS_DIR"
  echo "    Is the OpenClaw agent running and has it created at least one session?"
  exit 1
fi

echo "  ✓ OpenClaw sessions found"
echo ""

mkdir -p /opt/mirror-watcher
cp mirror-watcher.js /opt/mirror-watcher/

# Copy env file if not already present (don't overwrite existing config)
if [ ! -f /opt/mirror-watcher/mirror-watcher.env ]; then
  cp mirror-watcher.env.example /opt/mirror-watcher/mirror-watcher.env
  echo "  ◈ Edit /opt/mirror-watcher/mirror-watcher.env before starting"
  echo "    Set MIRROR_ENDPOINT to your Digital Mirror server IP"
  echo ""
fi

chown -R openclaw:openclaw /opt/mirror-watcher

cp mirror-watcher.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable mirror-watcher
systemctl start mirror-watcher

echo ""
echo "  ✓ Installed and running"
echo ""
echo "  systemctl status mirror-watcher"
echo "  journalctl -u mirror-watcher -f"
echo ""

systemctl status mirror-watcher --no-pager
