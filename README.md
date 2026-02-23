# 🪞 Digital Mirror

**Direction engine for life. Calculates if you're ascending or descending.**

Digital Mirror sits on top of your OpenClaw agent, catches life data from natural conversations, and calculates whether your trajectory across five dimensions is ascending, stable, or descending — relative to your own baseline.

Not a tracker. Not a habit app. A direction engine.

---

## How it works

You talk to your agent like you normally do:

> "Spent $450 on new tires. Had 3 meetings today, gym after work. Helped kids with homework tonight."

Mirror catches the data silently and calculates direction:

```
◈ WEEKLY DIRECTION

💰 Finance       Direction: Down    Stability: Moderate
🏃 Health        Direction: Up      Stability: Stable
🚀 Career        Direction: Stable  Stability: Stable
🤝 Social        Direction: Up      Stability: Stable
👨‍👩‍👧‍👦 Family       Direction: Stable  Stability: Stable
```

No forms. No manual input. No behavior change required.

---

## 5 Dimensions

| Dimension | What it captures |
|-----------|-----------------|
| 💰 **Finance** | Spending, income, saving patterns |
| 🏃 **Health** | Sleep, exercise, nutrition, energy |
| 🚀 **Career** | Meetings, projects, learning, output |
| 🤝 **Social** | Friends, networking, community |
| 👨‍👩‍👧‍👦 **Family** | Spouse, children, time together |

Family activates automatically when you mention family context. If you don't have family data, the dimension simply doesn't appear.

---

## Output

**Default: Categorical** — Up / Stable / Down per dimension. No percentages, no scores.

**Expanded (on request):** Numeric detail — 7-day slope, 30-day slope, volatility, consistency.

Direction is always relative to **your own baseline**, calculated during a 14-day calibration period. Adaptive thresholds per dimension.

---

## Install

### 1. Backend (Mirror API)

```bash
git clone https://github.com/CristianAndrei01/digital-mirror.git
cd digital-mirror
npm install
cp .env.example .env
```

Edit `.env` to configure your server:

```env
PORT=3000
HOST=0.0.0.0        # use 0.0.0.0 to accept external connections
DB_PATH=./data/mirror.db
BASE_CURRENCY=USD
SIGMA_MULTIPLIER=0.4
CALIBRATION_DAYS=14
```

Start the server:

```bash
# With pm2 (recommended for production)
npm install -g pm2
pm2 start server.js --name digital-mirror
pm2 save
pm2 startup

# Or directly
npm start
```

Dashboard: `http://YOUR_SERVER_IP:3000/dashboard`  
Health check: `http://YOUR_SERVER_IP:3000/health`

---

### 2. Sidecar Watcher (OpenClaw integration)

The sidecar watcher runs on the same server as your OpenClaw bot. It monitors OpenClaw session files and silently forwards user messages to the Mirror API.

**Deploy on your OpenClaw bot server:**

```bash
mkdir -p /opt/mirror-watcher

# Copy from this repo
cp mirror-watcher.js /opt/mirror-watcher/
cp mirror-watcher.env.example /opt/mirror-watcher/.env
```

Edit `/opt/mirror-watcher/.env`:

```env
MIRROR_ADAPTER=openclaw
MIRROR_ENDPOINT=http://YOUR_MIRROR_SERVER_IP:3000/api/entry
OPENCLAW_HOME=/home/openclaw/.openclaw
POLL_INTERVAL=2000
STATE_FILE=/opt/mirror-watcher/watcher-state.json
```

**Install as a systemd service:**

```bash
cp mirror-watcher.service /etc/systemd/system/mirror-watcher.service
systemctl daemon-reload
systemctl enable mirror-watcher
systemctl start mirror-watcher
```

**Verify it's running:**

```bash
journalctl -u mirror-watcher -f
```

You should see:
```
◈ Digital Mirror — Session Watcher v1.1
Adapter:   openclaw
Endpoint:  http://YOUR_MIRROR_SERVER_IP:3000/api/entry
Watching…
```

From this point, every message you send to your OpenClaw bot is automatically captured by Mirror.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OpenClaw Agent  │     │  Mirror Watcher   │     │  Digital Mirror  │
│  (any channel)   │ ──→ │  (sidecar)        │ ──→ │  Direction API   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
  Telegram, Discord,       Polls session files      Baseline, Scoring,
  WhatsApp, Slack          every 2 seconds          Dashboard, REST API
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/entry` | Log a user message `{"text": "..."}` |
| `GET` | `/api/direction` | Weekly direction across all dimensions |
| `GET` | `/api/dimension/:name` | Single dimension detail (`?expanded=true`) |
| `GET` | `/api/monthly` | Monthly reflection snapshot |
| `GET` | `/api/dashboard` | Dashboard data |
| `GET` | `/health` | Health check |

---

## Roadmap

### v1 — Now
- [x] 5-dimension scoring (Family auto-activates)
- [x] 14-day baseline calibration
- [x] Adaptive direction thresholds (per-dimension, σ multiplier: 0.4)
- [x] Categorical output (Up / Stable / Down)
- [x] Life Stability Index (volatility per dimension)
- [x] Consistency Score with confidence flagging
- [x] Weekly Strategic Snapshot
- [x] Agent REST API + dashboard
- [x] OpenClaw sidecar watcher
- [x] Open source (MIT)

### v2 — Next
- [ ] Expanded numeric view (slopes, σ values, volatility ratios on request)
- [ ] Directional Deviation Score
- [ ] Context Mode (temporary baseline adjustment)
- [ ] Monthly Reflection Snapshot
- [ ] Healthy Variance Ceiling notifications
- [ ] ClawHub listing
- [ ] Currency conversion via exchange rate API

### v3 — Future
- [ ] Cross-dimension correlation
- [ ] Decision impact awareness
- [ ] Predictive direction notes
- [ ] Direct chat (Telegram)
- [ ] Wearable integrations
- [ ] Bank API connections

---

## Currency

Default base currency is USD ($). Configurable to any currency. If you mention a different currency in conversation ("paid 200 EUR"), Mirror converts automatically via exchange rate API.

---

## Privacy

- **Self-hosted** — runs on your machine
- **No cloud sync** — your data stays local
- **No telemetry** — zero data collection
- **No cross-user comparison** — direction is relative to YOU
- **Full autonomy** — you control depth, frequency, and what gets tracked

---

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- 🐛 [Report a bug](https://github.com/CristianAndrei01/digital-mirror/issues/new)
- 💡 [Request a feature](https://github.com/CristianAndrei01/digital-mirror/issues/new)
- 🔧 [Submit a PR](https://github.com/CristianAndrei01/digital-mirror/pulls)

---

## Connect

- 🌐 [thedigitalmirror.ai](https://thedigitalmirror.ai)
- 💬 [Discord — Digital Mirror Community](https://discord.gg/digitalmirror)
- ✉️ [c@thedigitalmirror.ai](mailto:c@thedigitalmirror.ai)

---

## License

MIT — see [LICENSE](LICENSE)

---

Built by [Vanguard](https://vanguardxyz.ai) & [Cristian](https://github.com/CristianAndrei01)
