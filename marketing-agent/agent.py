#!/usr/bin/env python3
"""
FitBet Social Media Marketing Agent
Powered by Claude AI

Generates viral, bilingual (IS/EN) content for FitBet across
TikTok, Instagram, and Facebook — focused on organic reach.

Usage:
    python agent.py                    # Interactive chat mode
    python agent.py --quick "prompt"   # One-shot generation
    python agent.py --files            # List saved content files
    python agent.py --demo             # Run a quick demo
"""

import argparse
import json
import os
import sys
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Optional

import anthropic

from brand import BRAND_SUMMARY
from platforms import ALL_PLATFORMS
from tools import TOOL_DEFINITIONS, process_tool_call, list_saved_files

# ─── Configuration ────────────────────────────────────────────────────────────

MODEL = os.getenv("FITBET_MARKETING_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8096
OUTPUT_DIR = Path(__file__).parent / "output"

# ─── Rich UI (optional, falls back gracefully) ────────────────────────────────

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.markdown import Markdown
    from rich.table import Table
    from rich.text import Text
    from rich.prompt import Prompt
    from rich.rule import Rule
    from rich import print as rprint

    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


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
    summary = {
        k: v for k, v in inputs.items()
        if k not in ("content",) and v is not None
    }
    if HAS_RICH:
        console.print(
            f"[bold cyan]⚙ {tool_name}[/bold cyan] "
            f"[dim]{json.dumps(summary, ensure_ascii=False)}[/dim]"
        )
    else:
        print(f"  [{tool_name}] {json.dumps(summary, ensure_ascii=False)}")


def print_tool_result(result: str) -> None:
    if HAS_RICH:
        console.print(f"[green]  → {result}[/green]")
    else:
        print(f"  → {result}")


def print_banner() -> None:
    if HAS_RICH:
        banner = Panel(
            Text.assemble(
                ("⚽ FitBet Marketing Agent\n", "bold white"),
                ("Powered by Claude AI — Organic social media content\n", "dim"),
                ("TikTok · Instagram · Facebook · Íslensku & English", "cyan"),
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
**Available commands:**

| Command | Description |
|---------|-------------|
| `post tiktok` | Generate a TikTok post |
| `post instagram` | Generate an Instagram post |
| `post facebook` | Generate a Facebook post |
| `post all` | Generate posts for all platforms |
| `calendar week` | Generate a 1-week content calendar |
| `calendar month` | Generate a 1-month content calendar |
| `campaign [name]` | Generate a full viral campaign |
| `hooks` | Generate 10 viral opening hooks |
| `stories instagram` | Generate an Instagram Story sequence |
| `stories facebook` | Generate a Facebook Story sequence |
| `bios` | Generate optimized profile bios |
| `hashtags [platform]` | Generate a hashtag set |
| `files` | List saved content files |
| `help` | Show this help |
| `quit` / `exit` | Exit the agent |

**Example prompts:**
- "Create a TikTok post about the Champions League final in Icelandic"
- "Generate a 2-week content calendar for our app launch"
- "Give me 10 viral hooks for Instagram"
- "Create a full campaign for the start of the Icelandic football season"
- "Generate profile bios for all platforms in both languages"
"""
    print_response(help_text)


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
HOW TO RESPOND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Always use the appropriate tool(s) to generate content. After generating content via tools,
present it clearly in this structure:

## [Content Type] — [Platform] — [Language]

### Caption / Script
[The actual post content — ready to copy/paste]

### Hashtags
[Optimized hashtag set]

### Visual Brief
[Description of what the video/image should show]

### Posting Tips
[Best time, format specs, engagement tip]

---

CONTENT QUALITY STANDARDS:
- Icelandic must be natural and authentic — not Google Translated English
- Humor should feel earned, not forced
- Every post needs a CTA (question, tag prompt, or download CTA)
- TikTok content must hook in the FIRST SENTENCE
- Instagram carousels need a save-worthy insight or structure
- Facebook content can be longer — Icelanders read on Facebook
- Always think: would a 24-year-old Icelander who loves football share this?

LANGUAGE RULES:
- When writing in Icelandic: use real Icelandic slang and culture, reference Icelandic teams
  (KR, Breiðablik, Valur, Víkingur, Þór, ÍA, Stjarnan, Breiðablik)
- When writing in English: keep the Icelandic spirit but speak to a broader audience
- Bilingual posts: Icelandic first, English below, separated by 🇮🇸🇬🇧 or a divider

After generating any substantial content, use the save_to_file tool to save it
so the user can find it in the output/ folder.
"""


# ─── Agent Core ───────────────────────────────────────────────────────────────

def run_agent_turn(
    client: anthropic.Anthropic,
    conversation: list[dict],
    user_message: str,
) -> str:
    """Run one full agent turn: user message → tool loop → final response."""
    conversation.append({"role": "user", "content": user_message})

    full_response_text = ""

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=conversation,
        )

        # Collect text from this response
        response_text = ""
        tool_uses = []

        for block in response.content:
            if block.type == "text":
                response_text += block.text
            elif block.type == "tool_use":
                tool_uses.append(block)

        if response_text:
            full_response_text += response_text

        # No tool calls — we're done
        if response.stop_reason == "end_turn" or not tool_uses:
            conversation.append({
                "role": "assistant",
                "content": response.content,
            })
            break

        # Process tool calls
        tool_results = []
        for tool_use in tool_uses:
            print_tool_use(tool_use.name, tool_use.input)
            result = process_tool_call(tool_use.name, tool_use.input)
            print_tool_result(result)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tool_use.id,
                "content": result,
            })

        # Add assistant message and tool results to conversation
        conversation.append({
            "role": "assistant",
            "content": response.content,
        })
        conversation.append({
            "role": "user",
            "content": tool_results,
        })

    return full_response_text


def show_files() -> None:
    """Display all saved content files."""
    files = list_saved_files()
    if not files:
        print_info("No saved content files yet. Generate some content first!")
        return

    if HAS_RICH:
        table = Table(title="Saved Marketing Content", border_style="blue")
        table.add_column("File", style="cyan")
        table.add_column("Modified", style="dim")
        table.add_column("Size", justify="right", style="dim")
        for f in files:
            size_kb = f["size"] / 1024
            table.add_row(f["name"], f["modified"], f"{size_kb:.1f} KB")
        console.print(table)
    else:
        print(f"\nSaved files in output/:")
        for f in files:
            print(f"  {f['name']}  ({f['modified']})")


def run_demo(client: anthropic.Anthropic) -> None:
    """Run a quick demo to show the agent's capabilities."""
    print_info("Running demo — generating a TikTok post and viral hooks...\n")
    conversation: list[dict] = []

    demo_prompt = (
        "Create a punchy TikTok post in Icelandic about someone losing a FitBet "
        "on a Champions League match and having to do 200 burpees. "
        "Then give me 5 viral hook variations for the same concept. "
        "Save the results."
    )

    if HAS_RICH:
        console.print(Panel(demo_prompt, title="Demo Prompt", border_style="cyan"))
    else:
        print(f"Demo: {demo_prompt}\n")

    response = run_agent_turn(client, conversation, demo_prompt)
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
        """),
    )
    parser.add_argument("--quick", "-q", metavar="PROMPT", help="One-shot prompt, then exit")
    parser.add_argument("--demo", action="store_true", help="Run a quick demo")
    parser.add_argument("--files", "-f", action="store_true", help="List saved content files")
    parser.add_argument("--model", "-m", default=MODEL, help=f"Claude model to use (default: {MODEL})")
    args = parser.parse_args()

    # Check API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print_error(
            "ANTHROPIC_API_KEY not set.\n"
            "  Set it with: export ANTHROPIC_API_KEY=sk-ant-...\n"
            "  Or add it to marketing-agent/.env and run: source .env"
        )
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # --files: just list files and exit
    if args.files:
        show_files()
        return

    print_banner()

    # --demo mode
    if args.demo:
        run_demo(client)
        return

    # --quick mode: one-shot then exit
    if args.quick:
        conversation: list[dict] = []
        response = run_agent_turn(client, conversation, args.quick)
        print_response(response)
        return

    # ─── Interactive chat loop ─────────────────────────────────────────────
    if HAS_RICH:
        console.print("[dim]Type [bold]help[/bold] for commands, [bold]quit[/bold] to exit.[/dim]\n")
    else:
        print("Type 'help' for commands, 'quit' to exit.\n")

    conversation: list[dict] = []

    # Welcome message from agent
    welcome = run_agent_turn(
        client,
        conversation,
        (
            "Briefly introduce yourself in 2-3 sentences and list 5 things you can "
            "help with right now. Be energetic and in character as the FitBet marketing agent. "
            "Use a mix of Icelandic and English in your intro."
        ),
    )
    print_response(welcome)

    if HAS_RICH:
        console.print(Rule(style="dim blue"))

    while True:
        try:
            if HAS_RICH:
                user_input = Prompt.ask("\n[bold cyan]You[/bold cyan]").strip()
            else:
                user_input = input("\nYou: ").strip()
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
            print_help()
            continue

        if low in ("files", "skrár"):
            show_files()
            continue

        # Pass to agent
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
