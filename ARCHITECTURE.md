# Digital Mirror — Architecture v1.1

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         AGENT LAYER                              │
│                                                                  │
│  OpenClaw    LangChain    CrewAI    AutoGen    Custom            │
│     │           │           │         │          │              │
│     ▼           ▼           ▼         ▼          ▼              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Mirror Watcher v2.0 (sidecar)               │   │
│  │                                                          │   │
│  │  • OpenClaw Adapter — reads JSONL sessions from disk     │   │
│  │  • Webhook Adapter  — accepts POSTs from any framework   │   │
│  │  • Proactive alerts — checks /api/proactive every 30m    │   │
│  │  • Weekly digest    — timezone-aware cron, Telegram push │   │
│  │  • Settings sync    — pulls /api/settings every hour     │   │
│  └───────────────────────────┬──────────────────────────────┘   │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                POST /api/entry │         Telegram push ↑
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                      MIRROR ENGINE                               │
│                                                                  │
│  parser.js      → Categorize + score conversation text           │
│  scoring.js     → Baseline, direction, stability, alerts         │
│  api.js         → REST endpoints                                 │
│  database.js    → SQLite (entries, baselines, state, context)    │
│                                                                  │
│  Endpoints:                                                      │
│  POST /api/entry           GET /api/direction                    │
│  GET  /api/dimension/:name GET /api/monthly                      │
│  GET  /api/alerts          GET /api/proactive                    │
│  POST /api/alerts/ack      GET/POST /api/settings                │
│  GET/POST /api/context-mode GET /api/status
│  GET  /api/export                                  │
│                                                                  │
│  dashboard/dashboard.html  → Served at /dashboard               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Mirror Watcher v2.0 — What's new

### Proactive Alert Flow
```
Every 30 minutes:
  GET /api/proactive
    → hasAlerts: true?
      → for each alert: send Telegram message
      → POST /api/alerts/ack  (prevents re-sending)
    → hasAlerts: false → silent
```

### Weekly Digest Flow
```
Every 60 seconds — scheduler tick:
  nowInTimezone(user_timezone)
    → weekday === weeklyDigestDay AND hour === weeklyDigestHour AND minute < 2
      → weeklyDigestSentDate !== today?
        → GET /api/direction
        → format + send Telegram
        → save weeklyDigestSentDate = today
```

### Settings Sync
```
On startup + every hour:
  GET /api/settings
    → update config.userTimezone
    → update config.weeklyDigestHour
    → update config.weeklyDigestDay
```

---

## Alert Detection — scoring.js

```
detectAlerts(db, dimensions):
  for each dimension:
    take last 3 daily scores
    allDown? → push declining alert
    allUp?   → push ascending alert

Alert types:
  declining → severity: high (drop > 2) or moderate
  ascending → severity: positive (motivational message)
```

---

## Settings API — api.js

```
GET  /api/settings   → { timezone, weeklyDigestHour, weeklyDigestDay, notificationsEnabled, language }
POST /api/settings   → update any field, return updated settings

Fields stored in db.setState():
  user_timezone        → IANA timezone string
  weekly_digest_hour   → 0-23
  weekly_digest_day    → monday–sunday
  notifications_enabled → true/false
  user_language        → en, ro, etc.
```

---

## Context Mode — api.js + database.js

```
POST /api/context-mode  { reason, days, dimension? }
  → db.activateContextMode(dimension, reason, duration)

GET  /api/context-mode
  → db.getActiveContextModes()

DELETE /api/context-mode/:id
  → db.deactivateContextMode(id)
```

Context mode is stored and returned in API responses.
Adaptive threshold adjustment during context mode is a v2 feature.

---

## v1.1 Adapter: OpenClaw (current)

File-based sidecar reads JSONL session files from disk.

```
MIRROR_ADAPTER=openclaw
OPENCLAW_HOME=/home/openclaw/.openclaw
```

Sessions path: `$OPENCLAW_HOME/agents/main/sessions/`

---

## v1.1 Adapter: Webhook (any agent)

HTTP server accepts POSTs from any framework.

```
MIRROR_ADAPTER=webhook
WEBHOOK_PORT=3100
```

Any agent can POST:
```bash
curl -X POST http://mirror:3100/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "went to gym, paid bills", "source": "myagent"}'
```

---

## Data Flow

```
User conversation
    ↓
Mirror Watcher (adapter reads / receives message)
    ↓
POST /api/entry { text }
    ↓
parser.js — detect dimensions, calculate score, extract metadata
    ↓
database.js — store entry, update daily aggregates
    ↓
scoring.js — updateBaseline() if calibration threshold met
    ↓
GET /api/direction — calculateDirection() using 7-day slope vs adaptive threshold
    ↓
Up / Stable / Down per dimension
```

---

## Environment Variables

### Server (.env)
```
PORT=3000
HOST=localhost
DB_PATH=./data/mirror.db
SIGMA_MULTIPLIER=0.4
CALIBRATION_DAYS=14
ALERT_STREAK_DAYS=3
MIRROR_API_KEY=optional
```

### Mirror Watcher (/opt/mirror-watcher/.env)
```
MIRROR_ENDPOINT=http://localhost:3000/api/entry
MIRROR_API_BASE=http://localhost:3000/api
MIRROR_API_KEY=optional
MIRROR_ADAPTER=openclaw
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
ALERT_CHECK_MINS=30
WEEKLY_DIGEST_DAY=monday
WEEKLY_DIGEST_HOUR=8
USER_TIMEZONE=Europe/Bucharest
```

---

## File Structure

```
digital-mirror/
├── server.js              — Express server, routes
├── src/
│   ├── api.js             — REST endpoints (rate limiting, validation)
├── parser.js              — Conversation parser, scorer
├── scoring.js             — Direction engine, alert detection
├── mirror-watcher.js      — Sidecar: forwarding + push notifications
├── dashboard/
│   └── dashboard.html     — Operational dashboard
├── index.html             — Landing page (thedigitalmirror.ai)
├── src/
│   └── database.js        — SQLite abstraction
├── _env.example           — Server env template
├── mirror-watcher_env.example — Watcher env template
└── SKILL.md               — OpenClaw skill definition
```
