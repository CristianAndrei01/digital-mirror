# Digital Mirror — Vision

## The problem

AI agents are stateless by design. Every conversation starts from zero. Your agent doesn't know that you've been in the best stretch of your career for six weeks, or that your social life has been declining for three months, or that every time you take on more work your family dimension drops within a month.

It knows what you told it today.

This is a fundamental limitation, not a technical one. The data exists. It's in the conversations you already have, in the wearables you already wear, in the apps you already use. The problem is that nobody built the calculation layer that sits between raw conversation data and a meaningful signal about the direction of someone's life.

Habit trackers ask you to change your behavior. Journaling apps ask you to write. Dashboards ask you to update them. None of them work at scale because they all require a new habit — and the people who most need to understand their life's direction are exactly the people who don't have time to build new habits.

Digital Mirror is the layer that doesn't ask anything of you. It reads what already exists and calculates direction.

---

## What direction means

Not a score. Not a percentage. Not a comparison to anyone else.

Direction is whether you are ascending or descending relative to your own baseline — calculated per dimension, adaptive to your personal variance, updated continuously from natural conversation.

The output is categorical: **Up**, **Stable**, or **Down**.

This is intentional. The goal is signal, not noise. A 6.4 out of 10 in Health means nothing. "Health has been ascending for 11 days, stable variance, high confidence" means something.

Direction is calculated over 7 days using linear regression on daily aggregated scores. Thresholds are adaptive — derived from your own historical standard deviation, not from global constants. A person with high natural variance in Finance needs a wider threshold to detect real movement. A person who is consistently flat in Career needs a narrower one.

---

## Why this is an open source project

We could have built this as a SaaS. The economic case is obvious.

We didn't because the data Mirror works with is deeply personal. Sleep patterns, spending habits, social frequency, family time. This data should not live on someone else's server. It should not fund a recommendation algorithm. It should not be cross-referenced with other users to generate benchmarks you're compared against.

Mirror is self-hosted by design. Your data doesn't leave your machine. There is no telemetry, no analytics pipeline, no user database. The only person who benefits from your data is you.

Open source also means the calculation is auditable. If Mirror tells you your Health is descending, you can read exactly how that conclusion was reached. No black box. No trust required.

---

## The architecture is the thesis

Mirror's core architecture is a statement about what we believe:

**Agents should understand the people they work with.**

The Mirror Watcher sidecar reads conversation data from disk — or accepts it via webhook from any framework — and forwards it to the Mirror API. No changes to the agent. No API calls from inside the LLM context. No extra tokens. The agent keeps working exactly as it did. Mirror runs alongside it, silently, and builds a model of the person's life direction from the data stream.

The agent then becomes Mirror-aware. It checks `/api/proactive` at the start of each conversation. If there are alerts — a dimension declining for three consecutive days, or ascending — it surfaces them naturally, in its own voice. Not as a notification. As a thing a thoughtful agent would say.

This is a different model than "give your agent memory." Memory stores what was said. Mirror calculates what is happening.

```
Conversation stream
      ↓
Mirror Watcher (adapter)
      ↓
Parser + Scorer
      ↓
Baseline Engine
      ↓
Direction Signal
      ↓
Agent context at conversation start
```

The adapter pattern means any agent framework can connect. OpenClaw is the reference implementation. LangChain, CrewAI, AutoGen, or a custom agent can POST to `/ingest` and be Mirror-compatible in ten lines of code.

---

## Where this goes

### V1.1 — Now

The foundation is built and running. Direction engine, adaptive baseline, proactive streak alerts, weekly digest, context mode, settings API, dashboard, REST API. Self-hosted, MIT licensed, zero telemetry.

This version proves the thesis: you can calculate meaningful direction from conversation data without asking the user to change anything.

---

### V2 — Mirror as Protocol

V1 is a tool you install for yourself. V2 is infrastructure other people build on.

**Mirror SDK** — `npm install @digital-mirror/sdk`. Five lines of code and any agent is Mirror-compatible. Without this, Mirror is a personal project. With this, it becomes a protocol.

**Agent Context Injection** — Mirror stops waiting to be asked. At the start of every conversation, it injects a context summary into the agent's understanding: where you are across dimensions, what's moving, what's been stable. The agent knows who you are before you say anything.

**Event Annotation** — you mark significant moments: job change, relocation, loss, major decision. Mirror overlays them on the direction timeline. For the first time you can see how your life actually responded to each event — not how you remember it responded.

**Custom Dimensions** — Mirror ships with five. An athlete adds Training Load. A student adds Academic Performance. A founder adds Company Health. The dimension interface is defined and open. Mirror is extensible by design.

**Multi-user** — two people, one server, separate baselines. Couples who want to understand if they're moving in the same direction. Business partners. A coach and a client.

**Adaptive Context Mode** — context mode currently stores context but doesn't adjust calculations. V2 makes it functional: if you're sick for five days, the detection threshold adjusts. Anomalies during flagged periods are weighted accordingly.

**Full Data Export** — complete JSON dump of everything Mirror knows about you. ✓ Shipped in v1.1. Available at `GET /api/export`.

**Daily Brief** — optional morning push. Two lines. What's ascending, what's descending. Configurable frequency. Some people want weekly. Some want to feel the daily pulse.

---

### V3 — Upcoming

*We know what V3 is. We're not publishing the spec yet — not because it's a secret, but because V2 will teach us things that change how we build it.*

*What we can say: V3 is where Mirror stops being a direction engine and becomes something closer to a longitudinal understanding of a person's life. The kind of understanding that currently requires years of therapy, or a very good friend who has been paying close attention.*

*If V2 is infrastructure, V3 is what you build on top of infrastructure when you have two years of real data and the patterns start to speak.*

*Watch the repo.*

---

## What we need from contributors

### Adapters

The highest-value contribution right now is adapters. Each adapter connects a new agent framework to Mirror. The interface is simple and documented. If you work with LangChain, CrewAI, AutoGen, Botpress, or any other framework, building an adapter means every user of that framework can become Mirror-compatible.

The reference implementation is in `mirror-watcher.js`. The OpenClaw adapter is ~90 lines. The Webhook adapter is ~60 lines.

### Parsers

The current parser is rule-based — keyword matching with sentiment scoring. It works, but it's limited. A better parser would use structured extraction to identify not just dimension relevance but causal relationships, temporal markers, and intensity signals from natural language.

This is a well-defined problem with a clear interface: `parseConversation(text) → [{ dimension, score, metadata }]`. The test suite defines what correct output looks like. Improving this improves every Mirror installation.

### Dimension definitions

The five dimensions are a starting point. Some domains have obvious additional dimensions — academic performance for students, athletic training load for athletes, creative output for writers. Mirror's dimension system is configurable. New dimensions need keyword sets, sentiment signals, and scoring logic.

### Integrations

Mirror works from conversation text. But structured data — wearable exports, banking transactions, calendar data — would make the signal dramatically more accurate. Building an integration means writing a parser that translates structured data into Mirror entries.

---

## What we are not building

**A social platform.** Direction is personal and relative. Comparing your direction to other users' direction produces the exact perverse incentives that make social media harmful. Mirror will not have leaderboards, public profiles, or social features.

**A judgment engine.** Mirror observes and reports. It does not tell you what your numbers mean about you as a person, what you should do, or what a good score looks like. "Down" in Finance this week means your spending increased relative to your baseline. It does not mean you are failing.

**A replacement for professional support.** Direction data can be a useful input to conversations with a therapist, coach, or financial advisor. It is not a substitute for any of them.

---

## The right question

The question that drives Mirror's development is not "what features should we add?" It's:

**What would it mean for an AI agent to genuinely understand the person it works with?**

Not to remember their name. Not to recall the last conversation. To understand where they are in their life — what's working, what's declining, what patterns repeat, what moments were significant. And to use that understanding to be actually useful, not just responsive.

Mirror is the infrastructure for that. Everything else follows.

---

*Digital Mirror is MIT licensed. Built by [Vanguard](https://vanguardxyz.ai) & Cristian Andrei.*  
*github.com/CristianAndrei01/digital-mirror*
