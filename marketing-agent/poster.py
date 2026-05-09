"""
Social media posting clients for Facebook, Instagram, and TikTok.
All credentials are loaded from environment variables.
"""

import json
import os
import time
from pathlib import Path
from typing import Optional

import requests


# ─── Facebook ─────────────────────────────────────────────────────────────────

class FacebookPoster:
    """Posts to a Facebook Page via the Meta Graph API."""

    BASE = "https://graph.facebook.com/v21.0"

    def __init__(self) -> None:
        self.token   = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "")
        self.page_id = os.getenv("FACEBOOK_PAGE_ID", "")

    def is_configured(self) -> bool:
        return bool(self.token and self.page_id)

    def _params(self) -> dict:
        return {"access_token": self.token}

    def post_text(self, message: str) -> dict:
        """Post a plain-text update to the Facebook Page."""
        r = requests.post(
            f"{self.BASE}/{self.page_id}/feed",
            params=self._params(),
            json={"message": message},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def post_with_image_url(self, message: str, image_url: str) -> dict:
        """Post a photo from a public URL with a caption."""
        r = requests.post(
            f"{self.BASE}/{self.page_id}/photos",
            params=self._params(),
            json={"message": message, "url": image_url},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()

    def post_with_image_file(self, message: str, image_path: str) -> dict:
        """Upload a local image file and post it."""
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        with open(path, "rb") as fh:
            r = requests.post(
                f"{self.BASE}/{self.page_id}/photos",
                params=self._params(),
                data={"message": message},
                files={"source": (path.name, fh, _mime(path))},
                timeout=120,
            )
        r.raise_for_status()
        return r.json()

    def post(self, caption: str, hashtags: str = "", image_url: str = "", image_local: str = "") -> str:
        """Unified post method. Returns the platform post ID."""
        message = f"{caption}\n\n{hashtags}".strip()
        if image_local:
            result = self.post_with_image_file(message, image_local)
        elif image_url:
            result = self.post_with_image_url(message, image_url)
        else:
            result = self.post_text(message)
        return result.get("id", "unknown")


# ─── Instagram ────────────────────────────────────────────────────────────────

class InstagramPoster:
    """
    Posts to an Instagram Business account via the Meta Graph API.
    Requires the Instagram account to be connected to the Facebook Page.
    Images MUST be publicly accessible (use image_url, not local files).
    """

    BASE = "https://graph.facebook.com/v21.0"

    def __init__(self) -> None:
        self.token     = os.getenv("FACEBOOK_PAGE_ACCESS_TOKEN", "")
        self.ig_user_id = os.getenv("INSTAGRAM_USER_ID", "")

    def is_configured(self) -> bool:
        return bool(self.token and self.ig_user_id)

    def _params(self) -> dict:
        return {"access_token": self.token}

    def post(self, caption: str, hashtags: str = "", image_url: str = "", **_) -> str:
        """
        Two-step publish: create media container → publish.
        image_url must be a publicly accessible HTTPS URL.
        Text-only posts are not supported by Instagram's API — always provide an image.
        """
        if not image_url:
            raise ValueError(
                "Instagram requires an image URL. "
                "Generate an image first with generate_image_for_post."
            )

        full_caption = f"{caption}\n\n{hashtags}".strip()

        # Step 1 — Create media container
        r = requests.post(
            f"{self.BASE}/{self.ig_user_id}/media",
            params=self._params(),
            json={"image_url": image_url, "caption": full_caption},
            timeout=60,
        )
        r.raise_for_status()
        container_id = r.json()["id"]

        # Step 2 — Wait briefly for container to be ready, then publish
        time.sleep(3)
        r2 = requests.post(
            f"{self.BASE}/{self.ig_user_id}/media_publish",
            params=self._params(),
            json={"creation_id": container_id},
            timeout=30,
        )
        r2.raise_for_status()
        return r2.json().get("id", "unknown")


# ─── TikTok ───────────────────────────────────────────────────────────────────

class TikTokPoster:
    """
    Posts photo or video content to TikTok via the Content Posting API.
    Requires TikTok for Business + Content Posting API approval.
    """

    BASE = "https://open.tiktokapis.com/v2"

    def __init__(self) -> None:
        self.token = os.getenv("TIKTOK_ACCESS_TOKEN", "")

    def is_configured(self) -> bool:
        return bool(self.token)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

    def post_photo(
        self,
        caption: str,
        image_paths: list[str],
        hashtags: str = "",
        disable_comment: bool = False,
    ) -> str:
        """
        Photo post (1-35 images). Requires Content Posting API access.
        Images are uploaded as local files.
        """
        full_caption = f"{caption}\n{hashtags}".strip()

        # Step 1 — Initialize photo post
        init_body = {
            "post_info": {
                "title": full_caption[:150],
                "privacy_level": "PUBLIC_TO_EVERYONE",
                "disable_comment": disable_comment,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "photo_cover_index": 0,
                "photo_images": [],
            },
            "post_mode": "DIRECT_POST",
            "media_type": "PHOTO",
        }
        r = requests.post(
            f"{self.BASE}/post/publish/content/init/",
            headers=self._headers(),
            json=init_body,
            timeout=30,
        )
        r.raise_for_status()
        data = r.json().get("data", {})
        publish_id = data.get("publish_id", "")
        upload_urls = data.get("photo_upload_urls", [])

        # Step 2 — Upload each image
        for url, image_path in zip(upload_urls, image_paths):
            path = Path(image_path)
            if not path.exists():
                raise FileNotFoundError(f"Image not found: {image_path}")
            with open(path, "rb") as fh:
                put_r = requests.put(url, data=fh, timeout=120)
                put_r.raise_for_status()

        return publish_id

    def post_text_only(self, caption: str, hashtags: str = "") -> str:
        """
        Text-only post (no media). Simpler API call for caption-only content.
        Note: TikTok text posts have limited reach vs video/photo.
        """
        full_caption = f"{caption}\n{hashtags}".strip()
        body = {
            "post_info": {
                "title": full_caption[:150],
                "privacy_level": "PUBLIC_TO_EVERYONE",
            },
            "source_info": {"source": "PULL_FROM_URL"},
            "post_mode": "DIRECT_POST",
            "media_type": "PHOTO",
        }
        r = requests.post(
            f"{self.BASE}/post/publish/content/init/",
            headers=self._headers(),
            json=body,
            timeout=30,
        )
        r.raise_for_status()
        return r.json().get("data", {}).get("publish_id", "unknown")

    def post(self, caption: str, hashtags: str = "", image_local: str = "", **_) -> str:
        """Unified post method."""
        if image_local:
            return self.post_photo(caption, [image_local], hashtags)
        return self.post_text_only(caption, hashtags)


# ─── Router ───────────────────────────────────────────────────────────────────

def get_poster(platform: str):
    """Return the correct poster for a given platform."""
    platform = platform.lower()
    if platform == "facebook":
        return FacebookPoster()
    if platform == "instagram":
        return InstagramPoster()
    if platform == "tiktok":
        return TikTokPoster()
    raise ValueError(f"Unknown platform: {platform}")


def post_to_platform(
    platform: str,
    caption: str,
    hashtags: str = "",
    image_url: str = "",
    image_local: str = "",
) -> tuple[bool, str]:
    """
    Post content to a platform. Returns (success, platform_post_id_or_error).
    """
    try:
        poster = get_poster(platform)
        if not poster.is_configured():
            return False, f"{platform} API credentials not configured (check .env)"
        post_id = poster.post(
            caption=caption,
            hashtags=hashtags,
            image_url=image_url,
            image_local=image_local,
        )
        return True, post_id
    except requests.HTTPError as e:
        body = ""
        try:
            body = e.response.json()
        except Exception:
            pass
        return False, f"HTTP {e.response.status_code}: {body or str(e)}"
    except Exception as e:
        return False, str(e)


def configured_platforms() -> list[str]:
    """Return list of platforms with credentials present in env."""
    result = []
    if FacebookPoster().is_configured():
        result.append("facebook")
    if InstagramPoster().is_configured():
        result.append("instagram")
    if TikTokPoster().is_configured():
        result.append("tiktok")
    return result


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _mime(path: Path) -> str:
    suffix = path.suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix, "application/octet-stream")
