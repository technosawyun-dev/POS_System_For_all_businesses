from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import datetime, timezone


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def mask_email(email: str) -> str:
    parts = email.split("@")
    if len(parts) != 2:
        return "***"
    local, domain = parts
    if len(local) <= 2:
        return f"**@{domain}"
    return f"{local[0]}{'*' * (len(local) - 2)}{local[-1]}@{domain}"


def safe_int(value: str | None, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default
