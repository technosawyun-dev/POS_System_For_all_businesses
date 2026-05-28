from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import ValidationError
from app.core.logging import get_logger

logger = get_logger(__name__)

# Map content-type → canonical extension
_ALLOWED: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "application/pdf": ".pdf",
}


def _upload_root() -> Path:
    return Path(settings.UPLOAD_DIR).resolve()


async def save_payment_proof(
    file: UploadFile,
    tenant_id: uuid.UUID,
) -> str:
    """Validate, save, and return the relative URL path for a payment proof file.

    Raises ValidationError on bad content-type or oversized file.
    Returns a path like ``/uploads/proofs/<tenant_id>/<uuid>.ext``.
    """
    content_type = file.content_type or ""
    if content_type not in _ALLOWED:
        raise ValidationError(
            f"Unsupported file type '{content_type}'. "
            f"Allowed: {', '.join(_ALLOWED)}"
        )

    max_bytes = settings.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise ValidationError(
            f"File too large. Maximum size is {settings.UPLOAD_MAX_FILE_SIZE_MB} MB."
        )

    ext = _ALLOWED[content_type]
    filename = f"{uuid.uuid4().hex}{ext}"

    dest_dir = _upload_root() / "proofs" / str(tenant_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    dest_path = dest_dir / filename
    dest_path.write_bytes(contents)

    logger.info(
        "payment_proof_saved",
        tenant_id=str(tenant_id),
        filename=filename,
        size=len(contents),
    )

    return f"/uploads/proofs/{tenant_id}/{filename}"
