#!/usr/bin/env python3
"""
FitBet Social Media Marketing Agent
Powered by Claude AI

Generates viral, bilingual (IS/EN) content for FitBet across
TikTok, Instagram, and Facebook — focused on organic reach.
Also supports scheduling and auto-posting via social media APIs.

Usage:
    python agent.py                    # Interactive chat mode
    python agent.py --quick "prompt"   # One-shot generation
    python agent.py --files            # List saved content files
    python agent.py --queue            # Show the post queue
    python agent.py --schedule         # Show weekly posting schedule
    python agent.py --demo             # Run a quick demo
"""

import argparse
import json
import os
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import anthropic

from brand import BRAND_SUMMARY
from platforms import ALL_PLATFORMS
from tools import TOOL_DEFINITIONS, process_tool_call, list_saved_files
import database as db

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL      = os.getenv("FITBET_MARKETING_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8096
OUTPUT_DIR = Path(__file__).parent / "output"

# ─── Rich UI ──────────────────────────────────────────────────────────────────

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.table import Table
    from rich.text import Text
    from rich.prompt import Prompt
    from rich.rule import Rule
    from rich.columns import Columns

    console  = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console  = None


def print_info(msg: str) -> None:
    if HAS_RICH:
        console.print(f"[dim]{msg}[/dim]")
    else:
        print(f"  {msg}")


def print_success(msg: str) -> None:
    if HAS_RICH:
        console.print(f"[bold green]{msg}[/bold green]")
    else:
        print(f"✅ {msg}")


def print_error(msg: str) -> None:
    if HAS_RICH:
        console.print(f"[bold red]ERROR: {msg}[/bold red]")
    else:
        print(f"❌ ERROR: {msg}")


def print_response(text: str) -> None:
    if HAS_RICH:
        try:
            console.print(Markdown(text))
        except Exception:
            console.print(text)
    else:
        print(text)


def print_tool_use(tool_name: str, inputs: dict) -> None:
    summary = {k: v for k, v in inputs.items() if k not in ("content",) and v is not None}
    if HAS_RICH:
        console.print(
            f"[bold cyan]⚙  {tool_name}[/bold cyan] "
            f"[dim]{json.dumps(summary, ensure_ascii=False)}[/dim]"
        )
    else:
        print(f"  [{tool_name}] {json.dumps(summary, ensure_ascii=False)}")


def print_tool_result(result: str) -> None:
    if HAS_RICH:
        console.print(f"[green]   → {result}[/green]")
    else:
        print(f"   → {result}")


def print_banner() -> None:
    if HAS_RICH:
        banner = Panel(
            Text.assemble(
                ("⚽  FitBet Marketing Agent\n", "bold white"),
                ("Powered by Claude AI — Organic social media content\n", "dim"),
                ("TikTok · Instagram · Facebook · Íslensku & English\n\n", "cyan"),
                ("Type ", "dim"),
                ("help", "bold white"),
                (" for commands  ·  ", "dim"),
                ("queue", "bold white"),
                (" to see scheduled posts  ·  ", "dim"),
                ("quit", "bold white"),
                (" to exit", "dim"),
            ),
            border_style="bold blue",
            padding=(1, 4),
        )
        console.print(banner)
        console.print()
    else:
        print("=" * 60)
        print("  ⚽  FitBet Marketing Agent — Powered by Claude AI")
        print("  TikTok · Instagram · Facebook · IS & EN")
        print("=" * 60)
        print()


def print_help() -> None:
    help_text = """
## Content Generation

| Command | Description |
|---------|-------------|
| `post tiktok` | TikTok post (Icelandic or English) |
| `post instagram` | Instagram feed post or Reel script |
| `post facebook` | Facebook post |
| `post all` | Same post adapted for all three platforms |
| `hooks` | 10 viral opening hooks |
| `calendar week` | 1-week content calendar |
| `calendar month` | 1-month content calendar |
| `campaign [name]` | Full viral campaign |
| `stories instagram` | Instagram Story sequence |
| `stories facebook` | Facebook Story sequence |
| `bios` | Profile bios for all platforms |
| `hashtags [platform]` | Optimized hashtag set |
| `image [description]` | Generate an image with DALL-E 3 |

## Scheduling & Posting

| Command | Description |
|---------|-------------|
| `schedule` | View the weekly posting schedule |
| `queue` | View the post queue (pending / posted / failed) |
| `post now [platform]` | Generate + post immediately |
| `schedule post` | Generate content and add it to the queue |

## Utility

| Command | Description |
|---------|-------------|
| `files` | List saved content files |
| `status` | Show which platforms are connected |
| `help` | Show this help |
| `quit` | Exit |

## Example prompts
```
Create a TikTok post in Icelandic about the Champions League final
Generate a 2-week content calendar for our app launch
Give me 10 viral hooks for burpee challenge content
Create a full campaign for the start of Icelandic football season
Schedule a Facebook post for tomorrow at 9am
Post to Instagram now — match day hype, Icelandic
Generate an image of a person reluctantly doing push-ups at 6am
```
"""
    print_response(help_text)


def show_status() -> None:
    """Show which platforms are connected and which features are active."""
    from poster import configured_platforms
    from image_gen import is_image_gen_configured

    platforms = configured_platforms()
    img_ok    = is_image_gen_configured()

    if HAS_RICH:
        table = Table(title="FitBet Agent Status", border_style="blue", show_lines=True)
        table.add_column("Feature", style="bold")
        table.add_column("Status")
        table.add_column("Env variable needed")

        for p in ["facebook", "instagram", "tiktok"]:
            ok    = p in platforms
            icon  = "[green]✅ Connected[/green]" if ok else "[red]❌ Not configured[/red]"
            needs = {
                "facebook":  "FACEBOOK_PAGE_ACCESS_TOKEN + FACEBOOK_PAGE_ID",
                "instagram": "FACEBOOK_PAGE_ACCESS_TOKEN + INSTAGRAM_USER_ID",
                "tiktok":    "TIKTOK_ACCESS_TOKEN",
            }[p]
            table.add_row(p.capitalize(), icon, needs if not ok else "—")

        table.add_row(
            "Image gen (DALL-E 3)",
            "[green]✅ Active[/green]" if img_ok else "[red]❌ Not configured[/red]",
            "OPENAI_API_KEY" if not img_ok else "—",
        )
        table.add_row(
            "Content scheduler",
            "[cyan]Run scheduler.py separately[/cyan]",
            "—",
        )
        console.print(table)
    else:
        print("\n--- FitBet Agent Status ---")
        for p in ["facebook", "instagram", "tiktok"]:
            status = "✅" if p in platforms else "❌"
            print(f"  {status} {p.capitalize()}")
        print(f"  {'✅' if img_ok else '❌'} DALL-E 3 Image Generation")


# ─── System Prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""
You are the FitBet Marketing Agent — an expert social media strategist and copywriter
specializing in viral, bilingual (Icelandic and English) content for FitBet.

FitBet is a social fitness betting app built in Iceland. Friends bet on football match
outcomes — the loser completes a fitness challenge (proven via photo or Strava).
No real money. Just sweat, humor, and friendly competition.

Your job: Create outstanding, platform-native marketing content that gets organic reach,
makes people laugh, tag their friends, and download FitBet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{BRAND_SUMMARY}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLATFORM STRATEGIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{ALL_PLATFORMS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POSTING & SCHEDULING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have tools to schedule posts and post immediately:
- schedule_post: Adds a post to the database queue (scheduler.py delivers it)
- post_now: Posts immediately via the social media API
- generate_image_for_post: Creates a DALL-E 3 image for a post
- view_queue: Shows all queued/posted/failed posts
- show_weekly_schedule: Shows the default posting times per platform

Iceland is UTC year-round (no daylight saving time).
Optimal posting times (UTC): TikTok 7am/12pm/7pm · Instagram 8am/12pm/8pm · Facebook 9am/1pm/8pm

When a user asks to schedule content, use schedule_post with a specific ISO 8601 timestamp.
When generating images, use generate_image_for_post and attach the URL to the post.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always use the appropriate tool(s). After generating, present content as:

## [Content Type] — [Platform] — [Language]

### Caption / Script
[Ready to copy-paste]

### Hashtags
[Optimized set]

### Visual Brief
[What the image/video should show]

### Posting Tips
[Best time, format specs, one engagement tip]

QUALITY STANDARDS:
- Icelandic must be natural and authentic — not translated English
- Every post needs a CTA (question, tag prompt, or download link)
- TikTok: hook in the FIRST SENTENCE, max 150 chars caption
- Instagram carousels: save-worthy structure, 10-15 hashtags
- Facebook: longer form OK, Icelanders read on Facebook, 3-5 hashtags
- Always ask yourself: would a 24-year-old Icelander who loves football share this?

After generating substantial content, call save_to_file automatically.
"""


# ─── Agent Core ───────────────────────────────────────────────────────────────

def run_agent_turn(
    client: anthropic.Anthropic,
    conversation: list[dict],
    user_message: str,
) -> str:
    """Run one full agentic turn: user message → tool loop → final text response."""
    conversation.append({"role": "user", "content": user_message})
    full_text = ""

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=conversation,
        )

        response_text = ""
        tool_uses     = []

        for block in response.content:
            if block.type == "text":
                response_text += block.text
            elif block.type == "tool_use":
                tool_uses.append(block)

        if response_text:
            full_text += response_text

        if response.stop_reason == "end_turn" or not tool_uses:
            conversation.append({"role": "assistant", "content": response.content})
            break

        # Execute tools
        tool_results = []
        for tu in tool_uses:
            print_tool_use(tu.name, tu.input)
            result = process_tool_call(tu.name, tu.input)
            print_tool_result(result)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": result,
            })

        conversation.append({"role": "assistant", "content": response.content})
        conversation.append({"role": "user",      "content": tool_results})

    return full_text


# ─── CLI helpers ──────────────────────────────────────────────────────────────

def show_files() -> None:
    files = list_saved_files()
    if not files:
        print_info("No saved files yet. Generate some content first!")
        return
    if HAS_RICH:
        table = Table(title="Saved Marketing Content", border_style="blue")
        table.add_column("File", style="cyan")
        table.add_column("Modified", style="dim")
        table.add_column("Size", justify="right", style="dim")
        for f in files:
            table.add_row(f["name"], f["modified"], f"{f['size']/1024:.1f} KB")
        console.print(table)
    else:
        print("\nSaved files in output/:")
        for f in files:
            print(f"  {f['name']}  ({f['modified']})")


def show_queue() -> None:
    db.init_db()
    summary = db.get_queue_summary()
    if HAS_RICH:
        console.print(Panel(summary, title="Post Queue", border_style="blue"))
    else:
        print(summary)


def run_demo(client: anthropic.Anthropic) -> None:
    print_info("Running demo...\n")
    conversation: list[dict] = []
    prompt = (
        "Create a punchy TikTok post in Icelandic about someone losing a Champions League "
        "bet and having to do 200 burpees at 6am. Then give me 5 viral hook variations. "
        "Save the results."
    )
    if HAS_RICH:
        console.print(Panel(prompt, title="Demo Prompt", border_style="cyan"))
    else:
        print(f"Demo: {prompt}\n")
    response = run_agent_turn(client, conversation, prompt)
    print_response(response)


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="FitBet Social Media Marketing Agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
            Examples:
              python agent.py
              python agent.py --quick "Create a Champions League TikTok post in Icelandic"
              python agent.py --demo
              python agent.py --files
              python agent.py --queue
              python agent.py --schedule
        """),
    )
    parser.add_argument("--quick",    "-q", metavar="PROMPT", help="One-shot prompt, then exit")
    parser.add_argument("--demo",           action="store_true")
    parser.add_argument("--files",    "-f", action="store_true", help="List saved content files")
    parser.add_argument("--queue",          action="store_true", help="Show post queue")
    parser.add_argument("--schedule",       action="store_true", help="Show weekly schedule")
    parser.add_argument("--status",         action="store_true", help="Show platform connection status")
    parser.add_argument("--model",    "-m", default=MODEL)
    args = parser.parse_args()

    if not os.getenv("ANTHROPIC_API_KEY"):
        print_error(
            "ANTHROPIC_API_KEY not set.\n"
            "  1. cp .env.example .env\n"
            "  2. Edit .env → add your key\n"
            "  3. Run again"
        )
        sys.exit(1)

    db.init_db()
    client = anthropic.Anthropic()

    if args.files:    show_files();    return
    if args.queue:    show_queue();    return
    if args.status:   show_status();   return
    if args.schedule:
        from tools import handle_show_weekly_schedule
        print(handle_show_weekly_schedule())
        return

    print_banner()

    if args.demo:
        run_demo(client)
        return

    if args.quick:
        conversation: list[dict] = []
        response = run_agent_turn(client, conversation, args.quick)
        print_response(response)
        return

    # ── Interactive loop ───────────────────────────────────────────────────────
    conversation: list[dict] = []

    welcome = run_agent_turn(
        client, conversation,
        "Introduce yourself briefly in 2-3 sentences in a mix of Icelandic and English. "
        "List 5 things you can help with right now. Be energetic and on-brand."
    )
    print_response(welcome)

    if HAS_RICH:
        console.print(Rule(style="dim blue"))

    while True:
        try:
            user_input = (
                Prompt.ask("\n[bold cyan]You[/bold cyan]").strip()
                if HAS_RICH else input("\nYou: ").strip()
            )
        except (KeyboardInterrupt, EOFError):
            print("\nBless bless! 👋")
            break

        if not user_input:
            continue

        low = user_input.lower()

        if low in ("quit", "exit", "q", "bye", "bless"):
            print("\nBless! Gangi þér vel með markaðssetningu FitBet! 🚀")
            break
        if low in ("help", "hjálp", "?"):
            print_help(); continue
        if low in ("files", "skrár"):
            show_files(); continue
        if low in ("queue", "biðröð"):
            show_queue(); continue
        if low in ("status",):
            show_status(); continue
        if low in ("schedule", "áætlun"):
            from tools import handle_show_weekly_schedule
            print_response(handle_show_weekly_schedule()); continue

        if HAS_RICH:
            console.print()

        try:
            response = run_agent_turn(client, conversation, user_input)
            if response:
                print_response(response)
        except anthropic.APIError as e:
            print_error(f"API error: {e}")
        except Exception as e:
            print_error(f"Unexpected error: {e}")
            raise

        if HAS_RICH:
            console.print(Rule(style="dim blue"))


if __name__ == "__main__":
    main()
