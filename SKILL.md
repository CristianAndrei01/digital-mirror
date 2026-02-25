name: digital-mirror
description: Direction engine for life. Tracks whether the user is ascending or descending across 5 dimensions. Use when user asks about direction, weekly report, monthly reflection, life status, or when proactive alerts need surfacing. Also use when user mentions being sick, traveling, on vacation, overwhelmed, stressed, or any life context change that could affect their patterns — activate context mode automatically in these cases.
metadata: {"clawdbot":{"emoji":"🪞"}}
---
# Digital Mirror

Direction engine. Not a tracker — a signal. Shows whether your life is ascending or descending across 5 dimensions. Data captured automatically via Mirror Watcher sidecar. No manual logging needed.

---

## 🔁 CHECK THIS AT THE START OF EVERY CONVERSATION

Before responding to anything, silently check for proactive alerts:

```bash
curl -s http://localhost:3000/api/proactive
```

**If `hasAlerts: true`:**
- Surface alerts naturally at the start of your reply — do not ignore them
- Ascending alert → brief motivational observation ("Health has been rising 3 days straight.")
- Declining alert → calm, non-judgmental observation ("Finance signal has been slipping. Worth a look.")
- Then acknowledge: `curl -s -X POST http://localhost:3000/api/alerts/ack`
- Continue with whatever the user asked

**If `hasAlerts: false`:** say nothing, continue normally.

---

## 🚨 ACTIVATE CONTEXT MODE AUTOMATICALLY

**This is mandatory.** Whenever the user mentions ANY of the following in ANY message — not just explicit requests — immediately activate context mode silently before responding:

| Signal | Examples |
|--------|---------|
| Illness | "I'm sick", "I have a cold", "not feeling well", "fever", "sunt bolnav", "răcit", "mă doare" |
| Travel | "I'm traveling", "on a trip", "flying to", "sunt în vacanță", "plec din țară" |
| Vacation | "on vacation", "holiday", "taking time off", "concediu" |
| High stress | "crazy week", "overwhelmed", "burnout", "săptămână nebună" |
| Major event | "moving", "new job", "surgery", "loss", "baby", "wedding" |

**Action — run silently, do not mention it to the user unless they ask:**

```bash
curl -s -X POST http://localhost:3000/api/context-mode \
  -H "Content-Type: application/json" \
  -d '{"reason": "REASON_HERE", "days": DAYS_HERE}'
```

- Illness → days: 4
- Travel/vacation → days: duration mentioned or 7
- High stress → days: 5
- Major event → days: 7

Example for "I'm sick for 3 days":
```bash
curl -s -X POST http://localhost:3000/api/context-mode \
  -H "Content-Type: application/json" \
  -d '{"reason": "sick - cold", "days": 3}'
```

---

## When user asks about direction

Triggers: "what's my direction?", "weekly report", "how am I doing?", "direction?", "cum merg lucrurile?", "raport saptamanal", "status", "weekly direction", "mirror"

```bash
curl -s http://localhost:3000/api/direction | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('formatted','No data yet — still calibrating.'))
"
```

---

## When user asks about a specific dimension

Triggers: "how's my health?", "finance status", "career direction", "social life?", "cum e sanatatea mea?"

```bash
curl -s "http://localhost:3000/api/dimension/DIMENSION?expanded=true"
```

Replace DIMENSION with: `finance`, `health`, `career`, `social`, or `family`

---

## When user asks for monthly reflection

Triggers: "monthly report", "monthly reflection", "how was my month?", "raport lunar", "luna asta"

```bash
curl -s http://localhost:3000/api/monthly
```

---

## When user asks to see or change context mode

Triggers: "what context modes are active?", "cancel context mode", "remove sick mode"

```bash
# View active
curl -s http://localhost:3000/api/context-mode

# Deactivate by ID
curl -s -X DELETE http://localhost:3000/api/context-mode/ID_HERE
```

---

## When user wants to export their data

Triggers: "export my data", "download my mirror data", "get my data", "exporta datele"

Tell the user their data is available at: `http://localhost:3000/api/export`

---

## When user wants to change notification time or timezone

Triggers: "change my weekly digest to Friday", "set timezone to Bucharest", "send digest at 9am", "notifica-ma la 7", "schimba ora"

```bash
# View current settings
curl -s http://localhost:3000/api/settings

# Update settings
curl -s -X POST http://localhost:3000/api/settings \
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
- Context mode silences anomaly alerts during unusual life periods — always activate it when context signals appear.
