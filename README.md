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

```bash
# Clone and start the backend
git clone https://github.com/CristianAndrei01/digital-mirror.git
cd digital-mirror
npm install
npm start

# Install the OpenClaw skill
clawhub install digital-mirror
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  OpenClaw Agent  │ ──→ │  Digital Mirror   │ ──→ │     You     │
│  (any channel)   │     │  Direction Engine │     │  Dashboard  │
└─────────────────┘     └──────────────────┘     │  Agent Chat │
  Telegram, Discord,      Baseline, Scoring,      │  REST API   │
  WhatsApp, Slack         Stability, Trends        └─────────────┘
```

---

## Roadmap

### v1 — Now
- [x] 5-dimension scoring (Family auto-activates)
- [x] 14-day baseline calibration
- [x] Adaptive direction thresholds
- [x] Categorical output (Up / Stable / Down)
- [x] Agent REST API + dashboard
- [x] Open source (MIT)

### v2 — Next
- [ ] Directional Deviation Score
- [ ] Life Stability Index
- [ ] Consistency Score
- [ ] Weekly Strategic Snapshot
- [ ] Monthly Reflection Snapshot
- [ ] Context Mode

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
