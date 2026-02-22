# Contributing to Digital Mirror

First off — thank you for being here. Digital Mirror is open source because building in public makes better products. Every contribution matters.

---

## Ways to Contribute

**You don't need to write code to contribute.** Here's how you can help:

- 🐛 **Report bugs** — something broken? [Open an issue](https://github.com/CristianAndrei01/digital-mirror/issues/new)
- 💡 **Suggest features** — have an idea? We want to hear it
- 📝 **Improve docs** — fix a typo, clarify an explanation, add examples
- 🧪 **Test and give feedback** — install it, use it, tell us what's missing
- 🔧 **Write code** — fix a bug, add a feature, improve the scoring engine
- 🌍 **Translations** — help us reach more people

---

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/digital-mirror.git
   cd digital-mirror
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes**
5. **Test** that everything works
6. **Commit** with a clear message:
   ```bash
   git commit -m "add: weekly snapshot export to CSV"
   ```
7. **Push** and open a **Pull Request**

---

## Commit Messages

Keep them short and clear. Use prefixes:

- `add:` — new feature
- `fix:` — bug fix
- `docs:` — documentation change
- `refactor:` — code restructure (no behavior change)
- `style:` — formatting, spacing (no logic change)
- `test:` — adding or updating tests

Example: `fix: adaptive threshold calculation for low-variance dimensions`

---

## Pull Request Guidelines

- **One PR = one change.** Don't bundle unrelated fixes.
- **Describe what and why.** Not just what you changed, but why it matters.
- **Keep it small.** Smaller PRs get reviewed faster.
- **Test your code.** Make sure nothing breaks.
- **Be patient.** We review everything, but it may take a few days.

---

## Good First Issues

New here? Look for issues labeled **`good first issue`** — these are specifically picked for newcomers.

Not sure where to start? Drop a message in [Discord](https://discord.gg/digitalmirror) and we'll point you in the right direction.

---

## Code Style

- **JavaScript/Node.js** — the codebase uses standard JS conventions
- Use **meaningful variable names** — `directionSlope` not `ds`
- **Comment the why**, not the what — code should explain itself, comments explain decisions
- No unused imports, no console.logs left behind
- Run `npm audit` before submitting if you add dependencies

---

## Scoring Engine Contributions

The scoring engine is the heart of Digital Mirror. If you want to contribute here:

- Read the **Narrative Bible** in `/docs/NARRATIVE-BIBLE.md` first — it explains the philosophy behind every scoring decision
- Direction output is **categorical by default** (Up / Stable / Down) — don't add numeric outputs to default view
- Thresholds are **adaptive per dimension** — no fixed global thresholds
- Tone is **observational** — Mirror observes, it doesn't judge, praise, or shame
- Test with real conversational data, not synthetic edge cases

---

## What We're Looking For

### v2 Priorities (help wanted)
- Expanded numeric view (slopes, σ, volatility ratios — on request from user)
- Directional Deviation Score implementation
- Context Mode (temporary baseline adjustment with neutral notifications)
- Monthly Reflection Snapshot
- Healthy Variance Ceiling notifications
- Currency conversion via exchange rate API
- Dashboard UI improvements (calibration progress, direction charts)

### Already in v1 (not needed):
- Life Stability Index — implemented in `src/scoring.js`
- Consistency Score with confidence flagging — implemented
- Weekly Strategic Snapshot — implemented
- Adaptive thresholds per dimension — implemented (σ multiplier: 0.4)

### Always Welcome
- Performance improvements
- Better conversation parsing
- New dimension detection patterns
- Dashboard UI improvements
- Documentation and examples

---

## Community

- 💬 **Discord** — [Digital Mirror Community](https://discord.gg/digitalmirror) — discussions, feedback, ideas
- 🐛 **GitHub Issues** — bugs, features, technical discussion
- ✉️ **Email** — [c@thedigitalmirror.ai](mailto:c@thedigitalmirror.ai) — direct line

---

## Code of Conduct

Be respectful. Be constructive. We're building something useful together.

- No personal attacks
- No spam or self-promotion
- Disagree with ideas, not people
- Help newcomers feel welcome

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for making Digital Mirror better. Every issue, every PR, every idea counts.

— Cristian & Vanguard
