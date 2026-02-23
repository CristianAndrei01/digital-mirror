# Digital Mirror

**Direction engine for life. Calculates if you're ascending or descending.**

Digital Mirror is an OpenClaw skill that silently captures life data from your natural conversations and calculates your weekly direction across 5 dimensions: Finance, Health, Career, Social, and Family.

No forms. No manual input. No behavior change required.

---

## Install

### 1. Deploy the Mirror API server

On a separate server (or the same machine):

```bash
git clone https://github.com/CristianAndrei01/digital-mirror.git
cd digital-mirror
npm install
cp .env.example .env
# Edit .env — set HOST=0.0.0.0 and optionally MIRROR_API_KEY
npm install -g pm2
pm2 start server.js --name digital-mirror
pm2 save && pm2 startup
```

### 2. Install the sidecar watcher on this OpenClaw server

```bash
git clone https://github.com/CristianAndrei01/digital-mirror.git
cd digital-mirror
sudo ./install.sh
```

Edit `/opt/mirror-watcher/mirror-watcher.env`:
```env
MIRROR_ENDPOINT=http://YOUR_MIRROR_SERVER_IP:3000/api/entry
# MIRROR_API_KEY=your_key_if_set
```

Restart:
```bash
sudo systemctl restart mirror-watcher
```

---

## How it works

Once installed, every message you send to this OpenClaw agent is silently forwarded to the Mirror API. Mirror parses it for life dimension signals and updates your direction engine.

Example conversation flow:

> You: "Had 3 meetings, shipped the feature, went to gym after"
> Agent: [responds normally]
> Mirror: silently logs Career (Up) + Health (Up)

---

## Check your direction

Ask your agent at any time:

- `"weekly direction"` — get your current trajectory across all dimensions
- `"finance direction"` — single dimension detail
- `"monthly reflection"` — 30-day overview

Or visit the dashboard: `http://YOUR_MIRROR_SERVER_IP:3000/dashboard`

---

## 5 Dimensions

| Dimension | What it captures |
|-----------|-----------------|
| 💰 Finance | Spending, income, saving patterns |
| 🏃 Health | Sleep, exercise, nutrition, energy |
| 🚀 Career | Meetings, projects, learning, output |
| 🤝 Social | Friends, networking, community |
| 👨‍👩‍👧‍👦 Family | Spouse, children, time together |

Family activates automatically when you mention family context.

---

## Output

```
◈ WEEKLY DIRECTION

💰 Finance       Direction: Stable  Stability: Moderate
🏃 Health        Direction: Up      Stability: Stable
🚀 Career        Direction: Up      Stability: Stable
🤝 Social        Direction: Stable  Stability: Low
```

Direction is always relative to YOUR baseline. Calibration takes 14 days.

---

## Privacy

- Self-hosted — runs on your server
- No cloud sync — your data stays local
- No telemetry — zero data collection

---

## Links

- GitHub: https://github.com/CristianAndrei01/digital-mirror
- Dashboard: `http://YOUR_MIRROR_SERVER_IP:3000/dashboard`
- Issues: https://github.com/CristianAndrei01/digital-mirror/issues
