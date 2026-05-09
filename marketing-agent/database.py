"""
SQLite database for FitBet Marketing Agent.
Stores the post queue and weekly posting schedule.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "fitbet_marketing.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS post_queue (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            platform         TEXT    NOT NULL,
            caption          TEXT    NOT NULL,
            hashtags         TEXT,
            image_url        TEXT,
            image_local      TEXT,
            scheduled_at     TEXT    NOT NULL,
            status           TEXT    NOT NULL DEFAULT 'pending',
            platform_post_id TEXT,
            error            TEXT,
            created_at       TEXT    DEFAULT (datetime('now','utc')),
            posted_at        TEXT
        );

        CREATE TABLE IF NOT EXISTS weekly_slots (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            platform     TEXT    NOT NULL,
            day_of_week  INTEGER NOT NULL,
            hour         INTEGER NOT NULL,
            minute       INTEGER NOT NULL DEFAULT 0,
            theme        TEXT,
            is_active    INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            post_queue_id INTEGER REFERENCES post_queue(id),
            platform      TEXT NOT NULL,
            impressions   INTEGER DEFAULT 0,
            reach         INTEGER DEFAULT 0,
            likes         INTEGER DEFAULT 0,
            comments      INTEGER DEFAULT 0,
            shares        INTEGER DEFAULT 0,
            clicks        INTEGER DEFAULT 0,
            fetched_at    TEXT DEFAULT (datetime('now','utc'))
        );
        """)
        if conn.execute("SELECT COUNT(*) FROM weekly_slots").fetchone()[0] == 0:
            _insert_default_schedule(conn)
        conn.commit()


def _insert_default_schedule(conn: sqlite3.Connection) -> None:
    """
    Default weekly posting slots (UTC = Iceland time year-round, no DST).

    Content themes per slot follow the 5 content pillars:
      match_preview, match_result, challenge_reveal, feature_highlight, community, viral_hook
    """
    slots = [
        # ── Monday — Recap weekend bets ──────────────────────────────────────
        ("tiktok",     0,  7, 0, "match_result"),
        ("instagram",  0,  8, 0, "match_result"),
        ("facebook",   0,  9, 0, "match_result"),
        # ── Tuesday — Challenge spotlight ─────────────────────────────────────
        ("tiktok",     1, 12, 0, "challenge_reveal"),
        ("instagram",  1, 12, 0, "challenge_reveal"),
        # ── Wednesday — Midweek CL/fixture preview ───────────────────────────
        ("tiktok",     2, 18, 0, "match_preview"),
        ("instagram",  2, 19, 0, "match_preview"),
        ("facebook",   2, 19, 0, "match_preview"),
        # ── Thursday — Feature & community ───────────────────────────────────
        ("instagram",  3, 12, 0, "feature_highlight"),
        ("facebook",   3, 13, 0, "community"),
        # ── Friday — Weekend hype ─────────────────────────────────────────────
        ("tiktok",     4,  7, 0, "viral_hook"),
        ("instagram",  4,  8, 0, "match_preview"),
        ("facebook",   4,  9, 0, "match_preview"),
        # ── Saturday — Match day (multiple slots) ─────────────────────────────
        ("tiktok",     5,  7, 0, "viral_hook"),
        ("instagram",  5,  8, 0, "match_preview"),
        ("facebook",   5,  9, 0, "match_preview"),
        ("tiktok",     5, 18, 0, "match_preview"),
        ("instagram",  5, 19, 0, "community"),
        ("facebook",   5, 20, 0, "community"),
        # ── Sunday — Consequences & results ──────────────────────────────────
        ("tiktok",     6, 10, 0, "match_result"),
        ("instagram",  6, 11, 0, "match_result"),
        ("facebook",   6, 12, 0, "match_result"),
    ]
    conn.executemany(
        "INSERT INTO weekly_slots (platform, day_of_week, hour, minute, theme) VALUES (?,?,?,?,?)",
        slots,
    )


# ─── Post Queue CRUD ──────────────────────────────────────────────────────────

def add_post(
    platform: str,
    caption: str,
    scheduled_at: str,
    hashtags: str = "",
    image_url: str = "",
    image_local: str = "",
) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO post_queue
               (platform, caption, hashtags, image_url, image_local, scheduled_at)
               VALUES (?,?,?,?,?,?)""",
            (platform, caption, hashtags, image_url, image_local, scheduled_at),
        )
        conn.commit()
        return cur.lastrowid


def get_pending_posts(before: Optional[str] = None) -> list[dict]:
    """Return all pending posts scheduled up to `before` (ISO timestamp, default: now)."""
    if before is None:
        before = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM post_queue WHERE status='pending' AND scheduled_at <= ? ORDER BY scheduled_at",
            (before,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_all_posts(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM post_queue ORDER BY scheduled_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def mark_posted(post_id: int, platform_post_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE post_queue SET status='posted', platform_post_id=?, posted_at=datetime('now','utc') WHERE id=?",
            (platform_post_id, post_id),
        )
        conn.commit()


def mark_failed(post_id: int, error: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "UPDATE post_queue SET status='failed', error=? WHERE id=?",
            (error, post_id),
        )
        conn.commit()


def cancel_post(post_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE post_queue SET status='cancelled' WHERE id=? AND status='pending'",
            (post_id,),
        )
        conn.commit()
        return cur.rowcount > 0


def get_weekly_slots() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM weekly_slots WHERE is_active=1 ORDER BY day_of_week, hour, minute"
        ).fetchall()
        return [dict(r) for r in rows]


def get_queue_summary() -> str:
    """Human-readable queue summary for the agent."""
    with get_conn() as conn:
        pending = conn.execute(
            "SELECT platform, scheduled_at FROM post_queue WHERE status='pending' ORDER BY scheduled_at LIMIT 20"
        ).fetchall()
        posted  = conn.execute("SELECT COUNT(*) FROM post_queue WHERE status='posted'").fetchone()[0]
        failed  = conn.execute("SELECT COUNT(*) FROM post_queue WHERE status='failed'").fetchone()[0]

    lines = [f"📊 Post Queue Summary", f"Posted: {posted} | Failed: {failed}", ""]
    if pending:
        lines.append("⏳ Upcoming scheduled posts:")
        for row in pending:
            lines.append(f"  [{row['platform'].upper():12s}] {row['scheduled_at']}")
    else:
        lines.append("No pending posts in queue.")
    return "\n".join(lines)
