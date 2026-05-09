"""
Tool definitions and handler implementations for the FitBet Marketing Agent.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


# ─── Tool Definitions (passed to Claude API) ─────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "create_post",
        "description": (
            "Generate a complete social media post for FitBet. Produces platform-optimized "
            "copy in Icelandic, English, or both, including captions, hashtags, visual "
            "descriptions, and posting tips. Use this for individual posts."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["tiktok", "instagram", "facebook", "all"],
                    "description": "Target platform(s) for the post",
                },
                "content_type": {
                    "type": "string",
                    "enum": [
                        "match_preview", "match_result", "challenge_reveal",
                        "challenge_proof", "app_demo", "leaderboard",
                        "viral_hook", "community", "feature_highlight", "seasonal_campaign",
                    ],
                    "description": "Type of content to create",
                },
                "language": {
                    "type": "string",
                    "enum": ["icelandic", "english", "bilingual"],
                    "description": "Language(s) for the post",
                },
                "topic": {
                    "type": "string",
                    "description": "Specific topic, match, challenge, or angle for the post.",
                },
                "tone": {
                    "type": "string",
                    "enum": ["funny", "motivational", "competitive", "educational", "hype"],
                    "description": "Emotional tone of the content",
                },
                "include_visual_brief": {
                    "type": "boolean",
                    "description": "Whether to include a detailed visual/image brief",
                    "default": True,
                },
            },
            "required": ["platform", "content_type", "language"],
        },
    },
    {
        "name": "create_content_calendar",
        "description": (
            "Generate a structured content calendar for FitBet across platforms. "
            "Returns a day-by-day or week-by-week plan with post ideas, themes, "
            "and timing recommendations."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "duration": {
                    "type": "string",
                    "enum": ["1_week", "2_weeks", "1_month"],
                    "description": "Duration of the content calendar",
                },
                "platforms": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                    "description": "Platforms to include",
                },
                "focus_theme": {
                    "type": "string",
                    "description": "Optional campaign theme (e.g. 'app launch week')",
                },
                "language_split": {
                    "type": "string",
                    "enum": ["mostly_icelandic", "mostly_english", "equal_split"],
                    "default": "mostly_icelandic",
                },
            },
            "required": ["duration", "platforms"],
        },
    },
    {
        "name": "create_campaign",
        "description": (
            "Generate a complete viral marketing campaign for FitBet including campaign "
            "concept, multiple coordinated posts across platforms, a launch strategy, "
            "and expected outcomes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_name":  {"type": "string", "description": "Name or theme for the campaign"},
                "campaign_goal": {
                    "type": "string",
                    "enum": ["app_downloads", "brand_awareness", "viral_reach", "community_growth", "feature_launch"],
                },
                "duration_days":  {"type": "integer", "minimum": 1, "maximum": 30},
                "platforms": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                },
                "key_event": {
                    "type": "string",
                    "description": "Event anchoring the campaign (e.g. 'Champions League Final')",
                },
                "num_posts": {"type": "integer", "minimum": 3, "maximum": 15, "default": 7},
            },
            "required": ["campaign_name", "campaign_goal", "platforms"],
        },
    },
    {
        "name": "generate_hashtag_set",
        "description": "Generate an optimized hashtag set for FitBet content on a specific platform.",
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                "content_theme": {"type": "string"},
                "language": {"type": "string", "enum": ["icelandic", "english", "mixed"], "default": "mixed"},
                "include_trending": {"type": "boolean", "default": True},
            },
            "required": ["platform", "content_theme"],
        },
    },
    {
        "name": "generate_viral_hooks",
        "description": (
            "Generate 10 attention-grabbing opening hooks for FitBet content — "
            "the critical first sentence that stops the scroll."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform":   {"type": "string", "enum": ["tiktok", "instagram", "facebook", "all"]},
                "hook_style": {"type": "string", "enum": ["pov", "shocking_stat", "question", "friend_drama", "countdown", "reveal"]},
                "language":   {"type": "string", "enum": ["icelandic", "english", "both"], "default": "both"},
                "theme":      {"type": "string", "description": "Optional theme (e.g. 'burpees', 'Champions League')"},
            },
            "required": ["platform", "hook_style"],
        },
    },
    {
        "name": "generate_story_sequence",
        "description": "Generate a complete Instagram or Facebook Story sequence with slide-by-slide content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "platform":       {"type": "string", "enum": ["instagram", "facebook"]},
                "story_type":     {"type": "string", "enum": ["match_day_hype", "app_walkthrough", "challenge_reveal", "weekly_results", "engagement_poll", "feature_spotlight"]},
                "num_slides":     {"type": "integer", "minimum": 3, "maximum": 10, "default": 5},
                "language":       {"type": "string", "enum": ["icelandic", "english", "bilingual"], "default": "icelandic"},
                "match_or_event": {"type": "string"},
            },
            "required": ["platform", "story_type"],
        },
    },
    {
        "name": "generate_profile_bio",
        "description": "Generate optimized social media profile bios for FitBet accounts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "platforms": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                },
                "language": {"type": "string", "enum": ["icelandic", "english", "both"], "default": "both"},
            },
            "required": ["platforms"],
        },
    },
    # ── New: Scheduling & Posting ──────────────────────────────────────────────
    {
        "name": "schedule_post",
        "description": (
            "Schedule a FitBet post to be automatically published at a specific date and time. "
            "The post is saved to the queue and will be sent by the scheduler daemon. "
            "Call this after generating post content to queue it for publication."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["facebook", "instagram", "tiktok"],
                    "description": "Platform to post to",
                },
                "caption": {
                    "type": "string",
                    "description": "The post caption (without hashtags)",
                },
                "hashtags": {
                    "type": "string",
                    "description": "Space-separated hashtags, e.g. '#FitBet #Football'",
                },
                "scheduled_at": {
                    "type": "string",
                    "description": (
                        "ISO 8601 datetime in UTC when to publish. "
                        "E.g. '2026-05-10T08:00:00+00:00' for Saturday 8am UTC. "
                        "Iceland is UTC year-round (no DST)."
                    ),
                },
                "image_prompt": {
                    "type": "string",
                    "description": (
                        "If set, an image will be generated with DALL-E for this post. "
                        "Describe the scene vividly. Leave empty for text-only posts."
                    ),
                },
            },
            "required": ["platform", "caption", "scheduled_at"],
        },
    },
    {
        "name": "post_now",
        "description": (
            "Immediately publish a post to a social media platform without scheduling. "
            "Use this when the user wants to post something right away."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {"type": "string", "enum": ["facebook", "instagram", "tiktok"]},
                "caption":  {"type": "string"},
                "hashtags": {"type": "string"},
                "image_prompt": {
                    "type": "string",
                    "description": "Generate an image for this post (optional)",
                },
            },
            "required": ["platform", "caption"],
        },
    },
    {
        "name": "generate_image_for_post",
        "description": (
            "Generate a social media image using DALL-E 3 for a FitBet post. "
            "Returns the image URL and local file path. "
            "Requires OPENAI_API_KEY in .env."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "scene_description": {
                    "type": "string",
                    "description": "Vivid description of what the image should show",
                },
                "platform": {
                    "type": "string",
                    "enum": ["tiktok", "instagram", "facebook"],
                    "description": "Determines aspect ratio (portrait for TikTok/Stories, square for feed)",
                },
                "content_type": {
                    "type": "string",
                    "enum": ["feed", "story", "reel"],
                    "default": "feed",
                },
                "quality": {
                    "type": "string",
                    "enum": ["standard", "hd"],
                    "default": "standard",
                    "description": "standard = faster/cheaper, hd = more detailed",
                },
            },
            "required": ["scene_description", "platform"],
        },
    },
    {
        "name": "view_queue",
        "description": "Show the current post queue — scheduled, posted, and failed posts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 20,
                    "description": "Number of posts to show",
                },
            },
            "required": [],
        },
    },
    {
        "name": "show_weekly_schedule",
        "description": "Show the default weekly posting schedule (days, times, platforms, themes).",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    # ── Existing utility ───────────────────────────────────────────────────────
    {
        "name": "save_to_file",
        "description": (
            "Save generated marketing content to a file in the output directory. "
            "Always call this after generating content the user wants to keep."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "Filename without path or extension",
                },
                "content": {"type": "string"},
                "content_type": {
                    "type": "string",
                    "enum": ["post", "campaign", "calendar", "hooks", "strategy", "bios", "stories", "schedule"],
                },
            },
            "required": ["filename", "content", "content_type"],
        },
    },
]


# ─── Tool Handlers ────────────────────────────────────────────────────────────

def handle_save_to_file(filename: str, content: str, content_type: str) -> dict[str, Any]:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = filename.lower().replace(" ", "-").replace("/", "-")
    filepath  = OUTPUT_DIR / f"{timestamp}_{safe_name}.md"
    header    = (
        f"# FitBet Marketing Content\n"
        f"**Type:** {content_type}  |  "
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n---\n\n"
    )
    filepath.write_text(header + content, encoding="utf-8")
    return {"success": True, "filepath": str(filepath), "name": filepath.name}


def handle_schedule_post(
    platform: str,
    caption: str,
    scheduled_at: str,
    hashtags: str = "",
    image_prompt: str = "",
) -> str:
    import database as db_mod
    db_mod.init_db()

    image_url   = ""
    image_local = ""

    if image_prompt:
        try:
            from image_gen import generate_and_host, size_for_platform
            size   = size_for_platform(platform)
            result = generate_and_host(image_prompt, size=size)
            image_url   = result["public_url"]
            image_local = result["local_path"] or ""
        except Exception as e:
            return f"⚠️ Image generation failed ({e}). Post scheduled without image."

    post_id = db_mod.add_post(
        platform=platform,
        caption=caption,
        hashtags=hashtags,
        image_url=image_url,
        image_local=image_local,
        scheduled_at=scheduled_at,
    )
    return (
        f"✅ Scheduled post #{post_id} on {platform.upper()} at {scheduled_at} UTC\n"
        f"{'📸 Image generated and attached.' if image_url else '📝 Text post.'}\n"
        f"Run `python scheduler.py` to start the posting daemon."
    )


def handle_post_now(
    platform: str,
    caption: str,
    hashtags: str = "",
    image_prompt: str = "",
) -> str:
    image_url   = ""
    image_local = ""

    if image_prompt:
        try:
            from image_gen import generate_and_host, size_for_platform
            size   = size_for_platform(platform)
            result = generate_and_host(image_prompt, size=size)
            image_url   = result["public_url"]
            image_local = result["local_path"] or ""
        except Exception as e:
            return f"⚠️ Image generation failed ({e}). Posting without image."

    from poster import post_to_platform
    success, result = post_to_platform(
        platform=platform,
        caption=caption,
        hashtags=hashtags,
        image_url=image_url,
        image_local=image_local,
    )

    if success:
        import database as db_mod
        db_mod.init_db()
        db_mod.add_post(
            platform=platform, caption=caption, hashtags=hashtags,
            image_url=image_url, image_local=image_local,
            scheduled_at=datetime.now(timezone.utc).isoformat(),
        )
        return f"✅ Posted to {platform.upper()}! Platform ID: {result}"
    return f"❌ Failed to post to {platform.upper()}: {result}"


def handle_generate_image(
    scene_description: str,
    platform: str,
    content_type: str = "feed",
    quality: str = "standard",
) -> str:
    try:
        from image_gen import generate_and_host, size_for_platform
        size   = size_for_platform(platform, content_type)
        result = generate_and_host(scene_description, size=size, quality=quality)
        return (
            f"✅ Image generated!\n"
            f"Public URL: {result['public_url']}\n"
            f"Local file: {result['local_path']}\n"
            f"Revised prompt: {result['revised_prompt'][:200]}..."
        )
    except EnvironmentError as e:
        return f"⚠️ {e}"
    except Exception as e:
        return f"❌ Image generation failed: {e}"


def handle_view_queue(limit: int = 20) -> str:
    try:
        import database as db_mod
        db_mod.init_db()
        posts = db_mod.get_all_posts(limit=limit)
        if not posts:
            return "No posts in queue yet."

        lines = [f"{'ID':4} {'PLATFORM':12} {'STATUS':10} {'SCHEDULED':20} {'CAPTION'}"]
        lines.append("-" * 80)
        for p in posts:
            sched = p["scheduled_at"][:16] if p["scheduled_at"] else "—"
            cap   = (p["caption"] or "")[:40]
            lines.append(f"{p['id']:<4} {p['platform']:<12} {p['status']:<10} {sched:<20} {cap}")
        return "\n".join(lines)
    except Exception as e:
        return f"Could not load queue: {e}"


def handle_show_weekly_schedule() -> str:
    try:
        import database as db_mod
        db_mod.init_db()
        slots = db_mod.get_weekly_slots()
        days  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        lines = ["Weekly Posting Schedule (UTC = Iceland time)\n", f"{'DAY':12} {'PLATFORM':12} {'TIME':8} {'THEME'}"]
        lines.append("-" * 55)
        for s in slots:
            day_name = days[s["day_of_week"]]
            lines.append(f"{day_name:<12} {s['platform']:<12} {s['hour']:02d}:{s['minute']:02d}    {s['theme'] or '—'}")
        return "\n".join(lines)
    except Exception as e:
        return f"Could not load schedule: {e}"


def process_tool_call(tool_name: str, tool_input: dict) -> str:
    if tool_name == "save_to_file":
        result = handle_save_to_file(
            filename=tool_input["filename"],
            content=tool_input["content"],
            content_type=tool_input["content_type"],
        )
        return f"✅ Saved: output/{result['name']}" if result["success"] else "❌ Save failed"

    if tool_name == "schedule_post":
        return handle_schedule_post(
            platform=tool_input["platform"],
            caption=tool_input["caption"],
            scheduled_at=tool_input["scheduled_at"],
            hashtags=tool_input.get("hashtags", ""),
            image_prompt=tool_input.get("image_prompt", ""),
        )

    if tool_name == "post_now":
        return handle_post_now(
            platform=tool_input["platform"],
            caption=tool_input["caption"],
            hashtags=tool_input.get("hashtags", ""),
            image_prompt=tool_input.get("image_prompt", ""),
        )

    if tool_name == "generate_image_for_post":
        return handle_generate_image(
            scene_description=tool_input["scene_description"],
            platform=tool_input["platform"],
            content_type=tool_input.get("content_type", "feed"),
            quality=tool_input.get("quality", "standard"),
        )

    if tool_name == "view_queue":
        return handle_view_queue(limit=tool_input.get("limit", 20))

    if tool_name == "show_weekly_schedule":
        return handle_show_weekly_schedule()

    # All other tools (create_post, create_campaign, etc.) are handled inline by Claude
    return f"Tool '{tool_name}' acknowledged — generate content now."


def list_saved_files() -> list[dict]:
    files = []
    for f in sorted(OUTPUT_DIR.glob("*.md"), reverse=True):
        stat = f.stat()
        files.append({
            "name": f.name,
            "path": str(f),
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
        })
    return files
