name: digital-mirror
description: Direction engine for life. Tracks whether the user is ascending or descending across 5 dimensions. Use when user asks about direction, weekly report, monthly reflection, life status, or when proactive alerts need surfacing.
metadata: {"clawdbot":{"emoji":"🪞"}}
---
# Digital Mirror

Direction engine. Not a tracker — a signal. Shows whether your life is ascending or descending across 5 dimensions. Data captured automatically via Mirror Watcher sidecar. No manual logging needed.

---

## 🔁 CHECK THIS AT THE START OF EVERY CONVERSATION

Before responding to anything, silently check for proactive alerts:

```bash
curl -s http://209.38.220.211:3000/api/proactive
```

**If `hasAlerts: true`:**
- Surface alerts naturally at the start of your reply — do not ignore them
- Ascending alert → brief motivational observation ("Health has been rising 3 days straight.")
- Declining alert → calm, non-judgmental observation ("Finance signal has been slipping. Worth a look.")
- Then acknowledge: `curl -s -X POST http://209.38.220.211:3000/api/alerts/ack`
- Continue with whatever the user asked

**If `hasAlerts: false`:** say nothing, continue normally.

---

## When user asks about direction

Triggers: "what's my direction?", "weekly report", "how am I doing?", "direction?", "cum merg lucrurile?", "raport saptamanal", "status", "weekly direction", "mirror"

```bash
curl -s http://209.38.220.211:3000/api/direction | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('formatted','No data yet — still calibrating.'))
"
```

---

## When user asks about a specific dimension

Triggers: "how's my health?", "finance status", "career direction", "social life?", "cum e sanatatea mea?"

```bash
curl -s "http://209.38.220.211:3000/api/dimension/DIMENSION?expanded=true"
```

Replace DIMENSION with: `finance`, `health`, `career`, `social`, or `family`

---

## When user asks for monthly reflection

Triggers: "monthly report", "monthly reflection", "how was my month?", "raport lunar", "luna asta"

```bash
curl -s http://209.38.220.211:3000/api/monthly
```

---

## When user mentions context mode

Triggers: "I'm traveling", "I'm sick", "on vacation", "big project this week", "sunt in vacanta", "sunt bolnav", "ignora aceasta saptamana"

```bash
curl -s -X POST http://209.38.220.211:3000/api/context-mode \
  -H "Content-Type: application/json" \
  -d '{"reason": "REASON_HERE", "days": 5}'
```

- `days` = how long to flag this context (1–14). Default: 5.
- `dimension` = optional — leave out to apply to all dimensions.
- Tell the user: context mode is stored. Direction calculations note this context.

---

## When user wants to change notification time or timezone

Triggers: "change my weekly digest to Friday", "set timezone to Bucharest", "send digest at 9am", "notifica-ma la 7", "schimba ora"

```bash
# View current settings
curl -s http://209.38.220.211:3000/api/settings

# Update settings
curl -s -X POST http://209.38.220.211:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"weeklyDigestHour": 8, "weeklyDigestDay": "monday", "timezone": "Europe/Bucharest"}'
```

Valid fields:
- `timezone` — IANA timezone string (e.g. `"Europe/Bucharest"`, `"America/New_York"`)
- `weeklyDigestHour` — 0–23
- `weeklyDigestDay` — monday / tuesday / wednesday / thursday / friday / saturday / sunday
- `notificationsEnabled` — true / false
- `language` — "en", "ro", etc.

Confirm to user after updating: "Weekly digest set to Monday at 8:00 AM Bucharest time."

---

## Output format

Tone: observational, calm, curious. Never praise. Never judge. Never say "great job". Just observe.

- Default output: Up / Stable / Down. No numbers unless user explicitly asks for detail.
- Calibrating = not enough data yet (needs 7+ days). Say: "Still calibrating — check back in a few days."
- Ascending alerts: motivational, one sentence. "Three days of momentum in Health — protect the streak."
- Declining alerts: calm, one sentence. "Social has been slipping. Even a short call counts."

---

## Dimensions

- 💰 **Finance** — spending, income, saving
- 🏃 **Health** — sleep, exercise, nutrition
- 🚀 **Career** — meetings, projects, learning
- 🤝 **Social** — friends, networking, connection
- 👨‍👩‍👧‍👦 **Family** — auto-activates when mentioned

---

## Notes

- Data captured automatically via Mirror Watcher sidecar — no manual logging needed.
- Direction calibrates after 7+ days of conversations. Before that: "Calibrating."
- Weekly digest pushes automatically via Telegram at configured time.
- Proactive alerts push when any dimension trends 3 consecutive days in same direction.
