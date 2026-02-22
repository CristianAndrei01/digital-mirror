---
name: digital-mirror
description: Direction engine for life. Catches life data from conversations and calculates whether you're ascending or descending across 5 dimensions.
version: 1.0.0
author: Cristian Andrei
homepage: https://thedigitalmirror.ai
repository: https://github.com/CristianAndrei01/digital-mirror
license: MIT
metadata:
  openclaw:
    requires:
      bins:
        - node
    primaryEnv: null
---

# Digital Mirror

Direction engine for life. Calculates if you're ascending or descending.

## What it does

Digital Mirror sits on top of your agent, catches life data from natural conversations, and calculates direction across 5 dimensions:

- 💰 **Finance** — spending, income, saving
- 🏃 **Health** — sleep, exercise, nutrition, energy
- 🚀 **Career** — meetings, projects, learning, output
- 🤝 **Social** — friends, networking, community
- 👨‍👩‍👧‍👦 **Family** — spouse, children (auto-activates when mentioned)

## How it works

After every conversation, send the text to Digital Mirror's API. It parses dimension data automatically and scores it against your personal baseline.

**You don't change anything about how you talk.** Mirror catches the signals.

## Setup

```bash
# Install and start
clawhub install digital-mirror
cd ~/.openclaw/skills/digital-mirror
cp .env.example .env
npm install
npm start
```

The server runs on `http://localhost:3000` by default.

## Agent Integration

Add this to your agent's system prompt or post-conversation hook:

```
After each conversation, send the user's messages to Digital Mirror:

POST http://localhost:3000/api/entry
Content-Type: application/json
{"text": "<user message>"}
```

## Commands

The user can ask:

- **"What's my direction?"** → `GET /api/direction` — Weekly categorical snapshot
- **"Show me detail"** → `GET /api/direction?expanded=true` — Numeric detail
- **"How's my health?"** → `GET /api/dimension/health` — Single dimension
- **"Monthly reflection"** → `GET /api/monthly` — 30-day overview
- **"I'm traveling this week"** → `POST /api/context-mode` — Temporary threshold adjustment

## Output Format

Default output is categorical — no numbers unless asked:

```
◈ WEEKLY DIRECTION

  💰 Finance       Direction: Down    Stability: Moderate
  🏃 Health        Direction: Up      Stability: Stable
  🚀 Career        Direction: Stable  Stability: Stable
  🤝 Social        Direction: Up      Stability: Stable
  👨‍👩‍👧‍👦 Family       Direction: Stable  Stability: Stable

  Strongest:  🏃 Health — Up, Stable
  Weakest:    💰 Finance — Down, Moderate variability
```

## Configuration

Edit `.env`:

```
PORT=3000              # Server port
BASE_CURRENCY=USD      # Default currency
SIGMA_MULTIPLIER=0.75  # Direction sensitivity
CALIBRATION_DAYS=14    # Baseline learning period
```

## Privacy

- Self-hosted — runs on your machine
- No cloud sync
- No telemetry
- SQLite local database
