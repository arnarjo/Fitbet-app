"""
Tool definitions and handler implementations for the FitBet Marketing Agent.
"""

import json
import os
from datetime import datetime
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
                        "match_preview",
                        "match_result",
                        "challenge_reveal",
                        "challenge_proof",
                        "app_demo",
                        "leaderboard",
                        "viral_hook",
                        "community",
                        "feature_highlight",
                        "seasonal_campaign",
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
                    "description": (
                        "Specific topic, match, challenge, or angle for the post. "
                        "E.g. 'Champions League final', 'burpees challenge', "
                        "'Strava auto-verify feature', etc."
                    ),
                },
                "tone": {
                    "type": "string",
                    "enum": ["funny", "motivational", "competitive", "educational", "hype"],
                    "description": "Emotional tone of the content",
                },
                "include_visual_brief": {
                    "type": "boolean",
                    "description": "Whether to include a detailed visual/image brief for this post",
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
                    "description": "Platforms to include in the calendar",
                },
                "focus_theme": {
                    "type": "string",
                    "description": (
                        "Optional theme or campaign focus. E.g. 'Champions League launch', "
                        "'app launch week', 'Icelandic football season start', etc."
                    ),
                },
                "language_split": {
                    "type": "string",
                    "enum": ["mostly_icelandic", "mostly_english", "equal_split"],
                    "description": "How to split language between posts",
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
            "and expected outcomes. Great for big moments like app launch, CL final, "
            "or Icelandic football season start."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "campaign_name": {
                    "type": "string",
                    "description": "Name or theme for the campaign",
                },
                "campaign_goal": {
                    "type": "string",
                    "enum": [
                        "app_downloads",
                        "brand_awareness",
                        "viral_reach",
                        "community_growth",
                        "feature_launch",
                    ],
                    "description": "Primary goal of the campaign",
                },
                "duration_days": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 30,
                    "description": "Campaign duration in days",
                },
                "platforms": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                    "description": "Platforms the campaign runs on",
                },
                "key_event": {
                    "type": "string",
                    "description": (
                        "The event or moment anchoring the campaign. "
                        "E.g. 'Champions League Final', 'App Store launch', "
                        "'Icelandic Premier League start', etc."
                    ),
                },
                "num_posts": {
                    "type": "integer",
                    "minimum": 3,
                    "maximum": 15,
                    "description": "Number of individual posts to generate in the campaign",
                    "default": 7,
                },
            },
            "required": ["campaign_name", "campaign_goal", "platforms"],
        },
    },
    {
        "name": "generate_hashtag_set",
        "description": (
            "Generate an optimized hashtag set for FitBet content on a specific platform. "
            "Returns primary, secondary, and niche hashtags with usage strategy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["tiktok", "instagram", "facebook"],
                    "description": "Target platform",
                },
                "content_theme": {
                    "type": "string",
                    "description": "Theme of the content (e.g. 'football match', 'fitness challenge', 'app launch')",
                },
                "language": {
                    "type": "string",
                    "enum": ["icelandic", "english", "mixed"],
                    "description": "Language for hashtags",
                    "default": "mixed",
                },
                "include_trending": {
                    "type": "boolean",
                    "description": "Whether to suggest checking for currently trending tags",
                    "default": True,
                },
            },
            "required": ["platform", "content_theme"],
        },
    },
    {
        "name": "generate_viral_hooks",
        "description": (
            "Generate 10 attention-grabbing opening hooks/lines for FitBet content. "
            "These are the critical first 1-3 seconds of a video or first line of a caption "
            "that determines whether someone stops scrolling."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["tiktok", "instagram", "facebook", "all"],
                    "description": "Target platform",
                },
                "hook_style": {
                    "type": "string",
                    "enum": ["pov", "shocking_stat", "question", "friend_drama", "countdown", "reveal"],
                    "description": "Style of hook to generate",
                },
                "language": {
                    "type": "string",
                    "enum": ["icelandic", "english", "both"],
                    "description": "Language for the hooks",
                    "default": "both",
                },
                "theme": {
                    "type": "string",
                    "description": "Optional specific theme (e.g. 'burpees', 'Champions League', 'Strava proof')",
                },
            },
            "required": ["platform", "hook_style"],
        },
    },
    {
        "name": "generate_story_sequence",
        "description": (
            "Generate a complete Instagram or Facebook Story sequence for FitBet. "
            "Returns slide-by-slide content with text, sticker suggestions, and interactive elements."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platform": {
                    "type": "string",
                    "enum": ["instagram", "facebook"],
                    "description": "Target platform for stories",
                },
                "story_type": {
                    "type": "string",
                    "enum": [
                        "match_day_hype",
                        "app_walkthrough",
                        "challenge_reveal",
                        "weekly_results",
                        "engagement_poll",
                        "feature_spotlight",
                    ],
                    "description": "Type of story to create",
                },
                "num_slides": {
                    "type": "integer",
                    "minimum": 3,
                    "maximum": 10,
                    "description": "Number of story slides",
                    "default": 5,
                },
                "language": {
                    "type": "string",
                    "enum": ["icelandic", "english", "bilingual"],
                    "description": "Language for the story",
                    "default": "icelandic",
                },
                "match_or_event": {
                    "type": "string",
                    "description": "Specific match or event to base story on (optional)",
                },
            },
            "required": ["platform", "story_type"],
        },
    },
    {
        "name": "generate_profile_bio",
        "description": (
            "Generate optimized social media profile bios for FitBet accounts. "
            "Returns bios for each platform with character count and link strategy."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "platforms": {
                    "type": "array",
                    "items": {"type": "string", "enum": ["tiktok", "instagram", "facebook"]},
                    "description": "Platforms to generate bios for",
                },
                "language": {
                    "type": "string",
                    "enum": ["icelandic", "english", "both"],
                    "description": "Language(s) for the bios",
                    "default": "both",
                },
            },
            "required": ["platforms"],
        },
    },
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
                    "description": (
                        "Filename without path or extension. Use descriptive names. "
                        "E.g. 'champions-league-campaign', 'weekly-tiktok-hooks', "
                        "'instagram-launch-posts'"
                    ),
                },
                "content": {
                    "type": "string",
                    "description": "The full content to save",
                },
                "content_type": {
                    "type": "string",
                    "enum": ["post", "campaign", "calendar", "hooks", "strategy", "bios", "stories"],
                    "description": "Type of content being saved",
                },
            },
            "required": ["filename", "content", "content_type"],
        },
    },
]


# ─── Tool Handlers ────────────────────────────────────────────────────────────

def handle_save_to_file(filename: str, content: str, content_type: str) -> dict[str, Any]:
    """Save content to the output directory."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = filename.lower().replace(" ", "-").replace("/", "-")
    filepath = OUTPUT_DIR / f"{timestamp}_{safe_name}.md"

    header = f"""# FitBet Marketing Content
**Type:** {content_type}
**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M")}
**File:** {safe_name}

---

"""
    filepath.write_text(header + content, encoding="utf-8")
    return {
        "success": True,
        "filepath": str(filepath),
        "message": f"Content saved to {filepath.name}",
    }


def process_tool_call(tool_name: str, tool_input: dict) -> str:
    """Route tool calls to their handlers. Most tools are handled by Claude itself;
    save_to_file is the only one with a real side effect."""
    if tool_name == "save_to_file":
        result = handle_save_to_file(
            filename=tool_input["filename"],
            content=tool_input["content"],
            content_type=tool_input["content_type"],
        )
        if result["success"]:
            return f"✅ Saved to: output/{Path(result['filepath']).name}"
        return f"❌ Save failed: {result.get('message', 'Unknown error')}"

    # For all other tools (create_post, create_campaign, etc.), Claude generates
    # the content inline — we just acknowledge the tool call was received.
    return f"Tool '{tool_name}' acknowledged. Generate the content now."


def list_saved_files() -> list[dict]:
    """Return a list of all saved output files with metadata."""
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
