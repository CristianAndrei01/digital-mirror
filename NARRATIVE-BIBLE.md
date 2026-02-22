# 🪞 DIGITAL MIRROR — Narrative Bible v3
### Internal alignment document. Implementation-oriented.

---

## 1. WHAT DIGITAL MIRROR IS (v1 — OpenClaw Skill)

**A personal direction and pattern awareness engine.**

It sits on top of an OpenClaw agent, catches life data from natural conversations, and calculates whether the user's trajectory across five dimensions is ascending, stable, or descending — relative to their own baseline.

**It is:**
- A feedback loop for personal direction
- A pattern awareness tool
- An agent-native scoring engine
- Open source, self-hosted, private

**It is NOT:**
- A reputation system
- An identity scoring platform
- A coaching or motivation tool
- A habit tracker with streaks
- A social comparison engine

**v1 exists for validation.** The goal is repeat usage, clarity of output, and calm utility. Not scale, not virality, not monetization.

---

## 2. POSITIONING

### One-line:
> "Digital Mirror calculates the direction of your life from conversations you already have."

### Technical description:
> "A directional scoring engine that transforms unstructured conversational data into personalized trajectory metrics across five life dimensions."

### Core question:
> "Are you busy… or are you progressing?"

### Grounded ambition:
> "Agents already know what we do. The missing layer is awareness of trajectory. Mirror adds that layer."

---

## 3. WHO THIS IS FOR

**For:**
- People running businesses, teams, families who want objective self-awareness
- Founders and operators making frequent decisions with compounding consequences
- Anyone who suspects they're busy but wants clarity on whether they're progressing
- OpenClaw users who want their agent conversations to produce lasting signal

**Not for:**
- People seeking motivation or praise
- People wanting habit streaks or gamification
- People looking for life coaching or emotional support

**Filter sentence:**
> "If you want encouragement, use a journal. If you want to see your trajectory, use Mirror."

---

## 4. THE 5 DIMENSIONS

💰 **Finance** — spending, income, saving, investments

**Currency handling:**
- Default base currency: USD ($)
- User-configurable: EUR, RON, GBP, or any supported currency
- FX conversion: if user mentions a different currency ("paid 200 EUR"), Mirror converts to base currency automatically via exchange rate API (XE or equivalent)
- "Spent 450" without symbol = assumes base currency
🏃 **Health** — sleep, exercise, nutrition, energy, mood
🚀 **Career** — meetings, projects, learning, output
🤝 **Social** — friends, networking, community, meaningful interactions outside family
👨‍👩‍👧‍👦 **Family** — spouse, children, time together, presence

**Family activates automatically.** Mirror detects family mentions from conversation (partner, kids, spouse, children, family dinner, etc). If a user never mentions family context, the dimension simply doesn't appear. No config, no setup questions.

Social and Family are intentionally separate. A person can have strong social life and weak family presence — or the opposite. Merging them hides the signal. Five is the constraint.

---

## 5. SCORING ENGINE — TECHNICAL SPEC

### 5.1 Baseline Calibration
- 14-day learning period per dimension
- All scores relative to user's own baseline
- No universal benchmarks, no cross-user comparison
- Baseline recalculates on rolling window after calibration

### 5.2 Hybrid Direction Model

**Default View (Categorical Only):**

What the user sees without asking for detail:

```
Direction (7d):   Up / Stable / Down
Direction (30d):  Up / Stable / Down
Stability:        Stable / Moderate variability / Variable
Pattern shift:    [noted if detected, omitted if not]
```

No numeric percentages in default view. Categorical labels only.

**Expanded View (On Request):**

When the user asks for detail or uses an advanced command:

```
7-day slope:       +1.2
30-day slope:      -0.8
Sigma deviation:   +0.6σ
Volatility ratio:  1.3×
Consistency:       Good (data on 6/7 days)
```

Numeric precision: max 1 decimal place.
Apply smoothing to reduce noise in slope calculations.

### 5.3 Adaptive Direction Thresholds

**No fixed global thresholds.** Direction classification adapts per dimension per user.

**Method:**
1. Calculate rolling slope history for the dimension
2. Calculate rolling standard deviation of slopes (σ_slope)
3. Classify direction relative to σ_slope:

| Condition | Classification |
|-----------|---------------|
| slope > +0.4σ | **Up** |
| slope between -0.4σ and +0.4σ | **Stable** |
| slope < -0.4σ | **Down** |

σ multiplier (0.4) is configurable per deployment via `SIGMA_MULTIPLIER` in `.env`. Lower values produce more sensitive direction detection (fewer Stable classifications). This prevents false direction signals from low-variance dimensions and catches real shifts in high-variance dimensions.

### 5.4 Life Stability Index

Measures volatility per dimension:
- Standard deviation of daily scores over rolling 14-day window
- Classification:

| Stability | Definition |
|-----------|-----------|
| Stable | σ within historical normal range |
| Moderate variability | σ between 1.0× and 1.5× historical |
| Variable | σ above 1.5× historical |

Stability is reported alongside direction. A dimension can be "Up but Variable" — which means different things than "Up and Stable."

### 5.5 Consistency Score

Measures data density and distribution per dimension:
- Frequency: how many days in the window have entries for this dimension
- Distribution: how evenly spread (vs. clustered)
- If consistency is low, Mirror flags the score as **low confidence**

Output example:
```
🏃 Health: Up, Stable (high confidence — data on 12/14 days)
💰 Finance: Stable (low confidence — data on 3/14 days)
```

### 5.6 Healthy Variance Ceiling

Macro-level guardrail:

**If** short-term volatility (7-day σ) > 1.8× long-term baseline volatility (30-day σ)
**for** > 7 consecutive days:

**Trigger notification:**
> "Sustained variability detected in [dimension]. This is outside your historical range."

Rules for this notification:
- Neutral phrasing only
- No alarm, no judgment, no dramatization
- Optionally suggest: "Would you like to adjust thresholds temporarily?"
- Appears once, does not repeat unless user engages

---

## 6. CONTEXT MODE

### Purpose:
Temporary adjustment when the user is in an atypical period (travel, illness, major project, family event).

### Trigger conditions:
- User explicitly states a contextual shift ("I'm traveling this week", "sick for a few days")
- Mirror detects a significant spike or drop in one dimension (>2σ from baseline)

### Activation flow:
1. Mirror suggests context mode with neutral phrasing:
   > "Noticed a shift in [dimension]. Would you like to activate context mode for a few days?"
2. User confirms (or declines)
3. Mirror activates temporary weighting adjustment for 3–7 days (user chooses duration)
4. Context mode expires automatically at end of period
5. Gradual return to baseline scoring (no hard snap-back)

### What context mode includes:
- One micro-plan suggestion (72-hour scope, optional)
- Adjusted direction thresholds for the active period
- No reminders, no nagging, no gamification
- User can deactivate early at any time

---

## 7. WEEKLY STRATEGIC SNAPSHOT

Command: *"What's my direction?"* or *"Weekly report."*

### Default output (categorical):
```
◈ WEEKLY DIRECTION

  Direction (7d):  Up
  Direction (30d): Stable
  Stability:       Moderate variability
  
  Strongest:  🏃 Health — Up, Stable
  Weakest:    💰 Finance — Down, Variable
  
  Pattern:    Career plateau detected (14 days)
  
  ◈ "Health trajectory is consistent. Finance shifted 
     mid-week — spending pattern changed. Career has 
     been flat for two weeks."
```

### Expanded output (on request):
Adds numeric slopes, σ values, consistency scores, volatility ratios.

### Rules:
- AI summary: max 3 sentences
- No emotional language
- No motivational tone
- Observational only: what happened, what shifted, what's flat
- No prescriptive advice unless user asks

---

## 8. MONTHLY REFLECTION SNAPSHOT

**On demand only.** No automatic push. User must request it.

### Default output:
```
◈ MONTHLY REFLECTION

  Overall direction:      Stable
  Average stability:      Moderate
  Average recovery time:  3.2 days
  Dominant pattern:       Health ascending, Finance volatile
  Secondary pattern:      Social consistency improved
  Data quality:           Good (entries on 24/30 days)
```

Max 6 lines in default view. Expanded view available on request with full numeric detail.

### Rules:
- No emotional language
- No motivational tone
- No year-over-year comparisons (not enough data in v1)
- Pure observation

---

## 9. TONE SPECIFICATION

### Mirror's voice is:
- **Observant** — notices patterns, reports them
- **Calm** — no urgency, no alarm
- **Curious** — "Interesting shift in career this week" not "Warning: career declining"
- **Lightly supportive** — "You've navigated similar periods before" (only when data supports it)
- **Optional** — always offers deeper detail, never forces it

### Mirror never:
- Praises ("Great job!")
- Judges ("You need to fix this")
- Commands ("You should exercise more")
- Shames ("Your social life is declining")
- Uses urgency framing ("Critical: health dropping fast")
- Uses gamification language ("Keep your streak going!")

### Example phrasings:
- "Variability higher than your historical range."
- "Would you like to adjust thresholds temporarily?"
- "You've navigated similar periods before."
- "Finance shifted direction mid-week. No action needed — noting for awareness."
- "Data sparse for social this week. Score confidence is lower than usual."
- "Career has been in plateau for 14 days. This is observation, not judgment."

---

## 10. CRISTIAN ANDREI — PERSONA

**Who:**
- Father of 5 (mentioned once per piece, maximum)
- Entrepreneur since 16
- Builds with AI-assisted development — deliberate methodology, not limitation

**Voice in public:**
- Direct. Minimal words.
- Systems thinker — feedback loops, not feelings
- Pragmatic — "it works, it's free, here it is"
- Honest about limitations — "v1, directionally correct, improving"

**Standard phrasing:**
- "The data existed. The intelligence layer didn't."
- "Built entirely using AI-assisted development with Claude."
- "Not a tracker. A direction engine."

**Never says:**
- "I can't code"
- Kids more than once per piece
- "Revolutionary" / "game-changing"
- "AI-powered" without context

---

## 11. LAUNCH CONTENT GUIDELINES

### Discord OpenClaw:
- Lead with the problem: data vanishes between conversations
- Describe what it does: catches data, calculates direction (categorical by default)
- Mention key technical features: adaptive thresholds, stability index, context mode
- State limitations honestly
- End with GitHub link and invitation for feedback
- Tone: builder sharing a tool, not marketer selling a product

### Twitter/X:
- Hook: "Are you busy… or are you progressing?"
- Thread: 6-8 tweets max
- Problem → solution → differentiator → demo screenshot → CTA
- No hype adjectives. Let the concept carry.

### Hacker News:
- Lead with technical honesty: scoring methodology, formula transparency, limitations section
- Include: example raw data, example calculation, what's imperfect
- Technical readers respect transparency over polish

### Across all channels:
- "Calculates direction" not "tracks life"
- "Trajectory" not "score" when discussing trends
- "Baseline" not "average"
- "Agent-native" not "AI-powered"
- One mention of personal story, then focus on product
- No promises about features not yet built

---

## 12. VERSION ROADMAP

### v1 — Foundation (NOW)
- Conversational data extraction via OpenClaw skill
- 5-dimension baseline scoring (14-day calibration)
- Categorical direction output (Up / Stable / Down)
- Adaptive thresholds per dimension (σ multiplier: 0.4)
- Life Stability Index (volatility measurement per dimension)
- Consistency Score with confidence flagging
- Weekly Strategic Snapshot
- Web dashboard + Agent REST API
- Open source, MIT

### v2 — Direction Engine
- Expanded numeric view (slopes, sigma, volatility ratios — on request)
- Directional Deviation Score
- Context Mode with temporary adjustment
- Monthly Reflection Snapshot
- Healthy Variance Ceiling with neutral notifications
- Weekly snapshot AI summary refinement
- Currency conversion via exchange rate API
- ClawHub listing

### v3 — Intelligence Layer
- Cross-dimension correlation detection
- Decision impact awareness (observational, not prescriptive)
- Predictive trajectory notes (at current pace, direction in X days)
- Standalone access (Telegram bot)
- Wearable and bank API integrations

---

## 13. MVP VALIDATION CRITERIA

**What we measure to know if this works:**

| Metric | Signal |
|--------|--------|
| Weekly snapshot repeat usage | Users find direction output useful enough to check weekly |
| Monthly snapshot request frequency | Users engage with longer-term reflection |
| Context mode activation rate | Adaptive features are understood and used |
| User response to curiosity prompts | Observational tone lands correctly |
| Retention beyond 30 days | Sustained utility, not novelty |

**What we do NOT optimize for in v1:**
- GitHub stars
- ClawHub install count
- Social media mentions
- Feature requests for advanced capabilities

Stars and installs are noted but not targeted. Validation comes from repeat usage patterns.

---

## 14. ETHICAL BASELINE

### Always:
- Self-hosted by default. User's data on user's machine.
- No hidden scoring layers. What the user sees is what exists.
- No cross-user comparison. Ever. Not in v1, not in v3.
- Full user autonomy. Mirror suggests, never insists.
- Optional depth. Default is simple. Advanced is opt-in.

### Never:
- Score users against each other
- Sell or transmit data
- Add telemetry without explicit opt-in
- Create urgency to drive engagement
- Gamify self-awareness

---

## 15. COPYWRITING RULES

### Always:
- "Calculates direction" not "tracks life"
- "Trajectory" not "score" when discussing trends
- "Baseline" not "average"
- "Agent-native" not "AI-powered"
- "Awareness" not "optimization"
- Concrete numbers only in expanded view context
- One mention of personal story per piece, maximum

### Never:
- "Revolutionary" / "game-changing" / "disruptive"
- "Leveraging" / "harnessing" / "unlocking"
- "Elite" / "high-performer" / "operator lifestyle"
- Promises about unbuilt features
- Plural "we" — it's "I" until there's a team
- Emotional framing in product descriptions

### Tone:
- Calm, direct, observational
- Respects the reader's intelligence
- Shows the methodology, not just the output
- Honest about v1 limitations
- No marketing embellishment

---

*This document is the internal source of truth for positioning, tone, technical spec, and launch alignment. All public communication must be consistent with the constraints defined here.*

*Digital Mirror calculates the direction of your life from conversations you already have.*
