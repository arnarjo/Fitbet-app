#!/usr/bin/env python3
"""
FitBet Marketing Scheduler — Autonomous posting daemon.

Runs continuously, checks the post queue every minute, and fires posts
at their scheduled times. Also runs an auto-pilot mode that generates
fresh content for empty time slots using Claude.

Usage:
    python scheduler.py              # Run scheduler (auto-pilot ON by default)
    python scheduler.py --no-autopilot   # Only post manually queued content
    python scheduler.py --dry-run    # Log what would be posted, don't actually post
    python scheduler.py --status     # Show queue status and exit
"""

import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import anthropic
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

import database as db
from poster import post_to_platform, configured_platforms
from brand import BRAND_SUMMARY
from platforms import ALL_PLATFORMS

# ─── Logging ──────────────────────────────────────────────────────────────────

LOG_PATH = Path(__file__).parent / "output" / "scheduler.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("fitbet-scheduler")

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL   = os.getenv("FITBET_MARKETING_MODEL", "claude-sonnet-4-6")
DRY_RUN = False

AUTOPILOT_SYSTEM = f"""
You are the FitBet auto-pilot content generator. Generate ONE short social media post
for the given platform and theme. Output ONLY a JSON object — no other text.

Schema:
{{
  "caption": "The post caption (without hashtags)",
  "hashtags": "#tag1 #tag2 #tag3"
}}

Rules:
- TikTok: max 150 chars caption, punchy hook in first sentence, 3-5 hashtags
- Instagram: max 300 chars caption, engaging CTA, 10-15 hashtags
- Facebook: max 400 chars caption, question or share prompt, 3-5 hashtags
- Alternate language: mostly Icelandic on Facebook, mix on TikTok/Instagram
- Be creative, funny, and on-brand

{BRAND_SUMMARY}
"""

# ─── Core posting job ─────────────────────────────────────────────────────────

def run_pending_posts() -> None:
    """Check the DB for posts due right now and fire them."""
    due = db.get_pending_posts()
    if not due:
        return

    for post in due:
        post_id  = post["id"]
        platform = post["platform"]
        caption  = post["caption"]
        hashtags = post["hashtags"] or ""
        image_url   = post["image_url"]   or ""
        image_local = post["image_local"] or ""

        log.info(f"Posting [{platform.upper()}] post #{post_id}: {caption[:60]}...")

        if DRY_RUN:
            log.info(f"  DRY-RUN — would post to {platform}")
            db.mark_posted(post_id, "dry-run")
            continue

        success, result = post_to_platform(
            platform=platform,
            caption=caption,
            hashtags=hashtags,
            image_url=image_url,
            image_local=image_local,
        )

        if success:
            log.info(f"  ✅ Posted. Platform ID: {result}")
            db.mark_posted(post_id, result)
        else:
            log.error(f"  ❌ Failed: {result}")
            db.mark_failed(post_id, result)


# ─── Auto-pilot content generation ───────────────────────────────────────────

def run_autopilot(client: anthropic.Anthropic) -> None:
    """
    For each weekly slot in the next 24 hours that has no post queued,
    generate content with Claude and schedule it.
    """
    now     = datetime.now(timezone.utc)
    cutoff  = now + timedelta(hours=24)
    slots   = db.get_weekly_slots()
    pending = db.get_pending_posts(before=cutoff.isoformat())

    # Build set of (platform, hour) already covered
    covered = set()
    for p in pending:
        sched = datetime.fromisoformat(p["scheduled_at"].replace("Z", "+00:00"))
        covered.add((p["platform"], sched.weekday(), sched.hour))

    platforms = configured_platforms()
    if not platforms:
        log.debug("Auto-pilot: no platforms configured, skipping")
        return

    for slot in slots:
        platform = slot["platform"]
        if platform not in platforms:
            continue

        # Find the next occurrence of this slot within 24h
        slot_dt = _next_slot_time(slot["day_of_week"], slot["hour"], slot["minute"])
        if slot_dt > cutoff:
            continue

        key = (platform, slot_dt.weekday(), slot_dt.hour)
        if key in covered:
            continue

        theme = slot["theme"] or "match_preview"
        log.info(f"Auto-pilot: generating {platform} post for {slot_dt.strftime('%a %H:%M')} UTC (theme: {theme})")

        try:
            post_data = _generate_post_content(client, platform, theme)
            post_id   = db.add_post(
                platform=platform,
                caption=post_data["caption"],
                hashtags=post_data["hashtags"],
                scheduled_at=slot_dt.isoformat(),
            )
            covered.add(key)
            log.info(f"  ✅ Scheduled post #{post_id}")
        except Exception as e:
            log.error(f"  ❌ Auto-pilot generation failed: {e}")


def _generate_post_content(client: anthropic.Anthropic, platform: str, theme: str) -> dict:
    """Call Claude to generate a single post. Returns {"caption": ..., "hashtags": ...}."""
    import json

    prompt = (
        f"Platform: {platform}\n"
        f"Theme: {theme}\n"
        f"Current UTC time: {datetime.now(timezone.utc).strftime('%A %H:%M')}\n"
        f"Generate a post."
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=AUTOPILOT_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text)


def _next_slot_time(day_of_week: int, hour: int, minute: int) -> datetime:
    """Return the next datetime (UTC) for a given weekday + time."""
    now     = datetime.now(timezone.utc)
    days_ahead = (day_of_week - now.weekday()) % 7
    candidate  = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=days_ahead)
    if candidate <= now:
        candidate += timedelta(weeks=1)
    return candidate


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    global DRY_RUN

    parser = argparse.ArgumentParser(description="FitBet Marketing Scheduler")
    parser.add_argument("--no-autopilot", action="store_true", help="Disable auto content generation")
    parser.add_argument("--dry-run",      action="store_true", help="Log only, do not post")
    parser.add_argument("--status",       action="store_true", help="Print queue status and exit")
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("❌ ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)

    db.init_db()

    if args.status:
        print(db.get_queue_summary())
        return

    DRY_RUN = args.dry_run
    if DRY_RUN:
        log.info("DRY-RUN mode — posts will be logged but not sent")

    client = anthropic.Anthropic()

    scheduler = BlockingScheduler(timezone="UTC")

    # Check and fire due posts every minute
    scheduler.add_job(
        run_pending_posts,
        trigger=IntervalTrigger(minutes=1),
        id="post_runner",
        name="Post due content",
        replace_existing=True,
    )

    # Auto-pilot: fill empty slots every 30 minutes
    if not args.no_autopilot:
        scheduler.add_job(
            lambda: run_autopilot(client),
            trigger=IntervalTrigger(minutes=30),
            id="autopilot",
            name="Auto-generate content for empty slots",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc),  # run immediately on start
        )

    log.info("=" * 60)
    log.info("FitBet Marketing Scheduler started")
    log.info(f"Configured platforms: {configured_platforms() or ['none — check .env']}")
    log.info(f"Auto-pilot: {'ON' if not args.no_autopilot else 'OFF'}")
    log.info(f"Model: {MODEL}")
    log.info("=" * 60)

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
