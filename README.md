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

## Proactive Intelligence

Mirror doesn't wait for you to ask. When any dimension trends 3 consecutive days in the same direction, your agent surfaces it automatically:

**Ascending** — *"Health has been rising 3 days straight — protect the streak."*

**Declining** — *"Social has been slipping. Isolation is sneaky. Even a short call counts."*

---

## Weekly Digest

Every Monday at 8:00 AM (configurable), Mirror pushes a digest directly to Telegram:

```
◈ Digital Mirror — Weekly

💰 Finance  ↑ Up
🏃 Health   ↑ Up
🚀 Career   → Stable
🤝 Social   ↓ Down
👨‍👩‍👧‍👦 Family  → Stable

Strongest: 🏃 health
Weakest: 🤝 social
```

Day, time, and timezone are fully configurable — from dashboard or by telling your agent.

---

## Context Mode

Tell your agent "I'm traveling this week" or "sick for 3 days" and Mirror stores that context. Direction calculations note the context period so anomalies don't skew your baseline.

---

## 5 Dimensions

| Dimension | What it captures |
|-----------|-----------------|
| 💰 **Finance** | Spending, income, saving patterns |
| 🏃 **Health** | Sleep, exercise, nutrition, energy |
| 🚀 **Career** | Meetings, projects, learning, output |
| 🤝 **Social** | Friends, networking, community |
| 👨‍👩‍👧‍👦 **Family** | Spouse, children, time together |

Family activates automatically when you mention family context.

---

## Install

```bash
# Clone and start the backend
git clone https://github.com/CristianAndrei01/digital-mirror.git
cd digital-mirror
cp _env.example .env    # edit .env with your config
npm install
npm start
```

Dashboard → `http://localhost:3000/dashboard`

```bash
# Install the OpenClaw skill
clawhub install digital-mirror
```

---

## Mirror Watcher (sidecar)

Mirror Watcher runs alongside your agent and forwards conversations + push notifications.

```bash
cp mirror-watcher_env.example /opt/mirror-watcher/.env
# Set MIRROR_ENDPOINT, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, USER_TIMEZONE
node mirror-watcher.js
```

For systemd: see `mirror-watcher.service`.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  OpenClaw Agent  │ ──→ │  Mirror Watcher   │ ──→ │  Digital Mirror   │
│  (any channel)   │     │  (sidecar v2.0)   │     │  Direction Engine │
└─────────────────┘     └──────────────────┘     └──────────────────┘
  Telegram, Discord,       Alert detection            Baseline scoring
  WhatsApp, Slack          Weekly digest push         REST API + dashboard
                           Timezone-aware             Proactive alerts
                           Telegram notifications     Settings API
```

---

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/entry` | Log a conversation entry |
| `GET /api/direction` | Weekly direction snapshot |
| `GET /api/dimension/:name` | Single dimension report |
| `GET /api/monthly` | Monthly reflection |
| `GET /api/alerts` | Active proactive alerts |
| `GET /api/proactive` | Alerts + context + summary (for agent) |
| `POST /api/alerts/ack` | Acknowledge alerts after surfacing |
| `GET /api/settings` | Get user settings |
| `POST /api/settings` | Update timezone, digest time, language |
| `GET/POST /api/context-mode` | Context mode management |
| `GET /api/status` | System status |

---

## Roadmap

### v1.1 — Now
- [x] 5-dimension scoring (Family auto-activates)
- [x] Adaptive direction thresholds (per-dimension σ)
- [x] Categorical output: Up / Stable / Down
- [x] Proactive streak alerts (3-day consecutive detection)
- [x] Weekly digest push (Telegram, timezone-aware)
- [x] Context Mode (vacation, illness, crunch periods)
- [x] Settings API (timezone, digest schedule, language)
- [x] Dashboard + REST API
- [x] Open source (MIT)

### v2 — Protocol

V1 is a tool you install for yourself. V2 is infrastructure other people build on.

- [ ] **Mirror SDK** — `npm install @digital-mirror/sdk`. Any agent, Mirror-compatible in five lines.
- [ ] **Agent Context Injection** — Mirror injects a live context summary into your agent at every conversation start. The agent knows who you are before you say anything.
- [ ] **Event Annotation** — mark significant moments (job change, loss, relocation). Mirror overlays them on the direction timeline. See how your life actually responded to each event.
- [ ] **Custom Dimensions** — athletes add Training Load. Students add Academic. Founders add Company Health. Open interface, extensible by design.
- [ ] **Multi-user** — two people, one server, separate baselines. Couples, business partners, coach and client.
- [ ] **Adaptive Context Mode** — detection thresholds adjust during flagged periods. Context mode becomes functional, not cosmetic.
- [ ] **Full Data Export** — complete JSON of everything Mirror knows about you. Your data, in full, on demand.
- [ ] **Daily Brief** — optional morning push. Two lines. What's moving.

### v3 — Upcoming

*We know what V3 is. We're not writing it down yet — not because it's a secret, but because two years of real data will teach us things that change how we build it.*

*What we can say: V3 is where Mirror stops being a direction engine and becomes something closer to a longitudinal understanding of a person's life. The kind of understanding that currently requires years of therapy, or a very good friend who has been paying close attention.*

*Watch the repo.*

---

## Privacy

- **Self-hosted** — runs on your machine
- **No cloud sync** — data stays local
- **No telemetry** — zero collection
- **Relative only** — direction is compared to YOU, not others

---

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

- 🐛 [Report a bug](https://github.com/CristianAndrei01/digital-mirror/issues/new)
- 💡 [Request a feature](https://github.com/CristianAndrei01/digital-mirror/issues/new)
- 🔧 [Submit a PR](https://github.com/CristianAndrei01/digital-mirror/pulls)

---

## Connect

- 🌐 [thedigitalmirror.ai](https://thedigitalmirror.ai)
- ✉️ [c@thedigitalmirror.ai](mailto:c@thedigitalmirror.ai)

---

MIT — see [LICENSE](LICENSE) · Built by [Cristian Andrei](https://github.com/CristianAndrei01)
