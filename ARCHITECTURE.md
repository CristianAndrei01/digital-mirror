# Digital Mirror — Integration Architecture

## How agents connect to Mirror

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT LAYER                          │
│                                                         │
│  OpenClaw    LangChain    CrewAI    AutoGen    Custom   │
│     │           │           │         │          │      │
│     ▼           ▼           ▼         ▼          ▼      │
│  ┌──────┐  ┌────────┐  ┌───────┐  ┌──────┐  ┌──────┐  │
│  │OpenClaw│ │LangChain│ │CrewAI │ │AutoGen│ │Webhook│  │
│  │Adapter│  │Adapter │  │Adapter│  │Adapter│ │Adapter│  │
│  └───┬───┘  └───┬────┘  └───┬───┘  └───┬──┘  └───┬──┘  │
│      │          │            │          │         │      │
│      ▼          ▼            ▼          ▼         ▼      │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Mirror Standard Message Format           │   │
│  │  { text, timestamp, source, metadata }            │   │
│  └──────────────────┬───────────────────────────────┘   │
└─────────────────────┼───────────────────────────────────┘
                      │
                      ▼  POST /api/entry
┌─────────────────────────────────────────────────────────┐
│                 MIRROR ENGINE                            │
│                                                         │
│  Parser → Categorizer → Scorer → Direction Calculator   │
│                                                         │
│  GET /api/direction    GET /api/dimension/:name          │
│  GET /api/monthly      GET /api/dashboard                │
└─────────────────────────────────────────────────────────┘
```

## V1 — Now (Our OpenClaw)

**Adapter:** File-based sidecar reads OpenClaw JSONL sessions from disk.
**Deploy:** systemd service on same machine as OpenClaw.
**Validates:** Full pipeline works end-to-end.

```
MIRROR_ADAPTER=openclaw
OPENCLAW_HOME=/home/openclaw/.openclaw
```

## V2 — Next (Any AI Agent)

**Adapter:** Webhook HTTP server accepts POSTs from any framework.
**Deploy:** Runs alongside Mirror backend or as separate microservice.
**SDK:** npm/pip packages for easy integration.

```
MIRROR_ADAPTER=webhook
WEBHOOK_PORT=3100
```

Any agent can POST:
```bash
curl -X POST http://mirror:3100/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "Spent $200 on groceries", "source": "langchain"}'
```

Planned adapters (not yet built — contributions welcome):
- `@digital-mirror/langchain` — LangChain callback handler
- `@digital-mirror/crewai` — CrewAI tool wrapper
- `@digital-mirror/sdk` — Universal JS/Python SDK

## V3 — Future (Mirror's Own Agent)

Mirror runs its own conversational agent. No external framework needed.

```
User downloads app
  → Mirror Agent: "Hi. Let's get to know each other."
  → 10-15 onboarding questions (finance, health, career, social, family)
  → Generates personal baseline
  → "Talk to me normally from now on. I'll calculate your direction."
  → Daily conversations → Engine scores → Weekly direction report
```

**Built on:** OpenClaw core (MIT licensed) — forked as Mirror Agent runtime.
**Channels:** Telegram, WhatsApp, Discord, Web, iOS, Android.
**Differentiator:** Zero-config. No manual tracking. Just talk.

## Adapter Interface

Every adapter must implement:

```javascript
{
  name: 'adapter-name',
  
  // Called once at startup
  init(config) { },
  
  // Called every poll interval
  // Returns { messages: MirrorMessage[], newState: {} }
  getNewMessages(currentState) { }
}
```

MirrorMessage format:
```javascript
{
  text: "Spent 450 on new tires, had 3 meetings today",
  timestamp: "2026-02-22T19:36:34.043Z",
  source: "openclaw",          // adapter name
  metadata: {
    sessionId: "23013bc3",     // optional
    userId: "1307455607",      // optional
    channel: "telegram"        // optional
  }
}
```
