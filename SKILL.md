name: digital-mirror
description: Direction engine for life. Shows life direction across 5 dimensions when user asks. Use when user asks about direction, weekly report, monthly reflection, or life status.
metadata: {"clawdbot":{"emoji":"🪞"}}
---
# Digital Mirror

Direction engine. Tracks whether the user is ascending or descending across 5 life dimensions. Data is captured automatically in the background — no manual logging needed.

## When user asks about direction

Triggers: "what's my direction?", "weekly report", "how am I doing?", "direction?", "cum merg lucrurile?", "raport saptamanal", "status", "weekly direction"

```bash
curl -s http://209.38.220.211:3000/api/direction | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d.get('formatted','No data yet — still calibrating.'))
"
```

## When user asks about a specific dimension

Triggers: "how's my health?", "finance status", "career direction", "social life?"

```bash
curl -s "http://209.38.220.211:3000/api/dimension/DIMENSION?expanded=true"
```

Replace DIMENSION with: finance, health, career, social, or family

## When user asks for monthly reflection

Triggers: "monthly report", "monthly reflection", "how was my month?", "raport lunar"

```bash
curl -s http://209.38.220.211:3000/api/monthly
```

## When user mentions context mode

Triggers: "I'm traveling", "I'm sick", "on vacation", "big project this week"

```bash
curl -s -X POST http://209.38.220.211:3000/api/context-mode \
  -H "Content-Type: application/json" \
  -d '{"reason": "REASON_HERE", "days": 5}'
```

## Output format

Tone: observational, calm, curious. Never praise. Never judge. Just observe and report.
Default: Up / Stable / Down. No numbers unless user asks for detail.

## Dimensions

- Finance — spending, income, saving
- Health — sleep, exercise, nutrition
- Career — meetings, projects, learning
- Social — friends, networking
- Family — auto-activates when mentioned

## Note

Data is captured automatically via Mirror Watcher sidecar. No manual logging needed.
