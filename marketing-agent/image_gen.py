"""
Image generation (DALL-E 3) and hosting (Supabase Storage) for FitBet posts.
"""

import io
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

IMAGES_DIR = Path(__file__).parent / "output" / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

FITBET_IMAGE_STYLE = (
    "Bold, energetic sports photography style. Dark background with vibrant electric "
    "blue and orange accents. Action-oriented — movement, sweat, effort. Cinematic "
    "lighting. Never stock-photo generic. Always authentic and high-energy. "
    "Include subtle FitBet branding space in corner. 16:9 ratio for feed posts, "
    "9:16 ratio for Stories and TikTok. No text overlaid on image."
)


# ─── DALL-E 3 generation ──────────────────────────────────────────────────────

def generate_image(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
    save_locally: bool = True,
) -> dict:
    """
    Generate an image with DALL-E 3.
    Returns {"url": str, "local_path": str | None, "revised_prompt": str}.
    size options: "1024x1024" (square), "1792x1024" (landscape), "1024x1792" (portrait/stories)
    quality options: "standard" (faster/cheaper), "hd" (more detail)
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY not set. Add it to .env to enable image generation."
        )

    full_prompt = f"{FITBET_IMAGE_STYLE}\n\nScene: {prompt}"

    r = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": "dall-e-3",
            "prompt": full_prompt,
            "n": 1,
            "size": size,
            "quality": quality,
            "response_format": "url",
        },
        timeout=120,
    )
    r.raise_for_status()
    data = r.json()["data"][0]
    openai_url = data["url"]
    revised_prompt = data.get("revised_prompt", prompt)

    local_path = None
    if save_locally:
        local_path = _download_image(openai_url)

    return {
        "url": openai_url,
        "local_path": str(local_path) if local_path else None,
        "revised_prompt": revised_prompt,
    }


def _download_image(url: str) -> Path:
    """Download an image URL and save to output/images/."""
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.png"
    path = IMAGES_DIR / filename
    path.write_bytes(r.content)
    return path


# ─── Supabase Storage upload ──────────────────────────────────────────────────

def upload_to_supabase(local_path: str, bucket: str = "marketing-images") -> str:
    """
    Upload a local image to Supabase Storage and return a public URL.
    Uses the existing Supabase project from the FitBet app.
    The 'marketing-images' bucket must be created and set to public in Supabase dashboard.
    """
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key  = os.getenv("SUPABASE_SERVICE_KEY", "")

    if not supabase_url or not service_key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set to upload images. "
            "As a workaround, use the DALL-E URL directly (valid for ~1 hour)."
        )

    path = Path(local_path)
    storage_path = f"fitbet-marketing/{path.name}"

    r = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{storage_path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "image/png",
        },
        data=path.read_bytes(),
        timeout=120,
    )
    r.raise_for_status()

    public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{storage_path}"
    return public_url


def generate_and_host(
    prompt: str,
    size: str = "1024x1024",
    quality: str = "standard",
) -> dict:
    """
    Generate an image with DALL-E 3, download it, and upload to Supabase.
    Returns {"public_url": str, "local_path": str, "revised_prompt": str}.
    Falls back to the temporary DALL-E URL if Supabase isn't configured.
    """
    result = generate_image(prompt, size=size, quality=quality, save_locally=True)

    public_url = result["url"]
    if result["local_path"]:
        try:
            public_url = upload_to_supabase(result["local_path"])
        except EnvironmentError:
            pass  # use temporary DALL-E URL
        except Exception as e:
            pass  # log but don't fail

    return {
        "public_url": public_url,
        "local_path": result["local_path"],
        "revised_prompt": result["revised_prompt"],
    }


def is_image_gen_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


# ─── Platform size presets ────────────────────────────────────────────────────

SIZE_PRESETS = {
    "square":    "1024x1024",    # Instagram feed, Facebook post
    "landscape": "1792x1024",   # Facebook cover, YouTube thumbnail style
    "portrait":  "1024x1792",   # Instagram/TikTok Stories, Reels cover
}


def size_for_platform(platform: str, content_type: str = "feed") -> str:
    if content_type in ("story", "reel", "tiktok"):
        return SIZE_PRESETS["portrait"]
    if platform == "facebook" and content_type == "cover":
        return SIZE_PRESETS["landscape"]
    return SIZE_PRESETS["square"]
