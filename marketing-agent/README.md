# FitBet Marketing Agent 🚀⚽

An AI-powered social media marketing agent for FitBet, built with Claude.
Generates viral, bilingual (Icelandic 🇮🇸 + English 🇬🇧) content for
**TikTok**, **Instagram**, and **Facebook** — focused on organic reach.

---

## What it does

The agent understands FitBet's brand deeply and can generate:

| Content Type | Description |
|---|---|
| **Posts** | Platform-native captions, hooks, hashtags for TikTok / Instagram / Facebook |
| **Campaigns** | Full multi-post viral campaigns (e.g. Champions League launch) |
| **Content Calendars** | Day-by-day post plans for 1 week, 2 weeks, or 1 month |
| **Viral Hooks** | 10 attention-grabbing opening lines per session |
| **Story Sequences** | Instagram + Facebook story slide-by-slide scripts |
| **Hashtag Sets** | Platform-optimized hashtag research per content theme |
| **Profile Bios** | Optimized bios for all three platforms, both languages |

All content is bilingual, brand-aware, and tuned for organic virality — not paid ads.

---

## Quick Start

### 1. Prerequisites
- Python 3.10+
- An [Anthropic API key](https://console.anthropic.com)

### 2. Setup

```bash
cd marketing-agent

# Copy and fill in your API key
cp .env.example .env
# Edit .env → set ANTHROPIC_API_KEY=sk-ant-...

# Start the agent
./run.sh
```

### 3. Usage

**Interactive mode** (recommended):
```bash
./run.sh
```

**One-shot generation:**
```bash
./run.sh --quick "Create a TikTok post in Icelandic about someone losing a Champions League bet"
```

**Demo mode:**
```bash
./run.sh --demo
```

**List saved content:**
```bash
./run.sh --files
# or from inside the agent: type 'files'
```

---

## Example Prompts

```
Create a TikTok post in Icelandic about a Champions League bet gone wrong
```
```
Generate a 1-week content calendar for Instagram and TikTok
```
```
Create a full launch campaign for the Icelandic football season start
```
```
Give me 10 viral hook variations for TikTok about fitness challenges
```
```
Generate Instagram Story sequences for match day hype
```
```
Write profile bios for all platforms in both languages
```
```
Create a bilingual Facebook post about the FitBet leaderboard feature
```

---

## Content Pillars

The agent follows FitBet's 5 core content themes:

1. **The Bet** 🎯 — Match previews, predictions, stakes (30%)
2. **The Challenge** 💪 — Fitness challenge reveals and humor (25%)
3. **The Proof** 📸 — Strava verification, accountability moments (20%)
4. **The Leaderboard** 🏆 — Rankings, friend competition (15%)
5. **FitBet Culture** 🇮🇸 — Iceland-specific, behind the scenes (10%)

---

## Output Files

Generated content is automatically saved to `output/` as timestamped Markdown files.
Each file is copy-paste ready for your social media scheduler.

```
output/
├── 20260101_120000_champions-league-campaign.md
├── 20260102_090000_weekly-tiktok-hooks.md
└── 20260103_143000_instagram-launch-posts.md
```

---

## Models

Default: `claude-sonnet-4-6` (fast + smart, ideal for content generation)

Override in `.env`:
```
FITBET_MARKETING_MODEL=claude-opus-4-7   # Most creative, slowest
FITBET_MARKETING_MODEL=claude-sonnet-4-6 # Best balance (default)
```

---

## Platform Strategy Summary

| Platform | Priority | Content Focus |
|---|---|---|
| **TikTok** | 🔴 First | Viral hooks, POV format, challenge videos, 15-30s |
| **Instagram** | 🟠 Second | Reels + Carousels, visual brand, community |
| **Facebook** | 🟡 Third | Icelandic community, longer posts, events |

**Posting cadence:**
- TikTok: 3-4x/week (daily during CL/World Cup)
- Instagram: Reels 4-5x/week + daily Stories
- Facebook: 5-7x/week + events for major matches

---

## Architecture

```
marketing-agent/
├── agent.py        # Main CLI agent with Claude conversation loop
├── brand.py        # FitBet brand identity, voice, content pillars
├── platforms.py    # Platform-specific strategies (TikTok/IG/FB)
├── tools.py        # Tool definitions + file save handler
├── requirements.txt
├── .env.example
├── run.sh          # Quick start script
└── output/         # Generated content (auto-saved)
```

The agent uses Claude's tool use API — it calls tools like `create_post`,
`create_campaign`, `generate_viral_hooks`, and `save_to_file` as part of
an agentic loop, producing structured, ready-to-use marketing content.
