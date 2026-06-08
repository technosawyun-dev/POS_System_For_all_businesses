from __future__ import annotations

import uuid
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_MAILTRAP_API_URL = "https://send.api.mailtrap.io/api/send"


TEMPLATES: dict[str, dict[str, str]] = {
    "subscription_expiring": {
        "subject": "Your Subscription Expires in {days} Day(s)",
        "body": (
            "Dear {recipient_name},\n\n"
            "Your subscription for {tenant_name} will expire in {days} day(s) "
            "on {expires_at}.\n\n"
            "To continue using all features without interruption, please renew "
            "your subscription before the expiration date.\n\n"
            "Regards,\nPOS System"
        ),
    },
    "payment_proof_approved": {
        "subject": "Payment Proof Approved — Subscription Renewed",
        "body": (
            "Dear {recipient_name},\n\n"
            "Your payment proof of {amount} {currency} has been reviewed and approved.\n\n"
            "Your subscription for {tenant_name} is now active until {expires_at}.\n\n"
            "Thank you for your payment.\n\n"
            "Regards,\nPOS System"
        ),
    },
}


async def _send_via_mailtrap(*, to: str, subject: str, html: str) -> None:
    """Send an email via Mailtrap Sending API using httpx."""
    if not settings.EMAIL_ENABLED:
        logger.info("email_disabled_skip", to=to, subject=subject)
        return

    token = settings.MAILTRAP_API_TOKEN.strip()
    if not token:
        logger.warning("mailtrap_token_not_set", to=to)
        return

    payload = {
        "from": {
            "email": settings.EMAIL_FROM,       # TODO: update EMAIL_FROM in .env
            "name": settings.EMAIL_FROM_NAME,   # TODO: update EMAIL_FROM_NAME in .env
        },
        "to": [{"email": to}],
        "subject": subject,
        "html": html,
        "category": "Transactional",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                _MAILTRAP_API_URL,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            logger.info("mailtrap_sent", to=to, subject=subject)
    except httpx.HTTPStatusError as exc:
        logger.error(
            "mailtrap_send_failed",
            to=to,
            subject=subject,
            status=exc.response.status_code,
            body=exc.response.text,
        )
        raise
    except Exception:
        logger.exception("mailtrap_send_error", to=to, subject=subject)
        raise


def _build_reset_password_html(reset_url: str) -> str:
    """Inline HTML for password reset email."""
    # TODO: update branding (name, colors) to match your product
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:12px;padding:32px;">
          <tr>
            <td>
              <h1 style="margin:0 0 16px;font-size:24px;color:#111827;">Reset your password</h1>
              <p style="margin:0 0 16px;line-height:1.6;color:#374151;">
                We received a request to reset the password for your account.
                Click the button below to choose a new password.
                This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.
              </p>
              <p style="margin:24px 0;">
                <a href="{reset_url}"
                   style="background:#f97316;color:#ffffff;text-decoration:none;
                          padding:12px 24px;border-radius:8px;display:inline-block;font-weight:600;">
                  Reset password
                </a>
              </p>
              <p style="margin:0 0 8px;line-height:1.6;color:#6b7280;font-size:13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="word-break:break-all;line-height:1.6;font-size:13px;">
                <a href="{reset_url}" style="color:#f97316;">{reset_url}</a>
              </p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not change.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_subscription_receipt_html(
    *,
    tenant_name: str,
    plan_name: str,
    plan_price: str,
    currency: str,
    started_at: str,
    expires_at: str,
    paid_amount: str,
    reference_number: str | None,
    action_label: str,
) -> str:
    ref_row = ""
    if reference_number:
        ref_row = f"""
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Reference / Invoice No.</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{reference_number}</td>
                </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Subscription Receipt</title></head>
<body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="background:#111827;padding:28px 32px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;
                                 background:#f59e0b;border-radius:8px;font-size:22px;font-weight:900;color:#000;">N</span>
                    <span style="font-size:20px;font-weight:700;color:#f3f4f6;vertical-align:middle;margin-left:10px;">NexusPOS</span>
                  </td>
                  <td style="text-align:right;">
                    <span style="background:#f59e0b;color:#000;font-size:11px;font-weight:700;
                                 padding:4px 10px;border-radius:20px;text-transform:uppercase;">{action_label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 0;">
              <h1 style="margin:0 0 6px;font-size:22px;color:#111827;">Subscription Receipt</h1>
              <p style="margin:0;font-size:14px;color:#6b7280;">Your payment has been approved. Here&rsquo;s a summary.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 0;">
              <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Business</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;">{tenant_name}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:14px 0 8px;color:#6b7280;font-size:13px;text-transform:uppercase;
                              letter-spacing:.5px;font-weight:600;" colspan="2">Plan Details</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Plan</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{plan_name}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Plan Price</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{plan_price} {currency} / cycle</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:6px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Subscription Start</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{started_at}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Valid Until</td>
                  <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">{expires_at}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:6px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:14px;">Amount Paid</td>
                  <td style="padding:8px 0;color:#f59e0b;font-size:18px;font-weight:700;text-align:right;">{paid_amount} {currency}</td>
                </tr>
                {ref_row}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This is an automated receipt from NexusPOS. Please keep it for your records.
                If you have any questions, contact our support team.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


async def send_subscription_receipt_email(
    *,
    to: str,
    tenant_name: str,
    plan_name: str,
    plan_price: str,
    currency: str,
    started_at: str,
    expires_at: str,
    paid_amount: str,
    reference_number: str | None,
    action_label: str,
) -> None:
    html = _build_subscription_receipt_html(
        tenant_name=tenant_name,
        plan_name=plan_name,
        plan_price=plan_price,
        currency=currency,
        started_at=started_at,
        expires_at=expires_at,
        paid_amount=paid_amount,
        reference_number=reference_number,
        action_label=action_label,
    )
    try:
        await _send_via_mailtrap(to=to, subject=f"Subscription Receipt — {plan_name}", html=html)
    except Exception:
        logger.exception("subscription_receipt_email_failed", to=to)


async def send_password_reset_email(to: str, token: str) -> None:
    """
    Send a password reset email via Mailtrap.
    Safe to use as a FastAPI BackgroundTask (async).
    """
    reset_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={token}"
    html = _build_reset_password_html(reset_url)
    try:
        await _send_via_mailtrap(to=to, subject="Reset your password", html=html)
    except Exception:
        logger.exception("password_reset_email_failed", to=to)


class EmailNotificationService:
    """
    Abstraction layer for email notifications.

    _deliver() sends via Mailtrap API. The existing notification templates
    (subscription_expiring, payment_proof_approved, etc.) are sent as plain-text-in-HTML.
    """

    def __init__(self) -> None:
        pass

    def _render(self, template_name: str, context: dict[str, Any]) -> tuple[str, str]:
        template = TEMPLATES.get(template_name)
        if template is None:
            logger.warning("email_template_not_found", template_name=template_name)
            return f"Notification: {template_name}", str(context)
        subject = template["subject"].format_map(context)
        body = template["body"].format_map(context)
        return subject, body

    async def _deliver(
        self,
        to: str,
        subject: str,
        body: str,
        context: dict[str, Any],
    ) -> None:
        html = f"<pre style='font-family:Arial,sans-serif;white-space:pre-wrap;'>{body}</pre>"
        await _send_via_mailtrap(to=to, subject=subject, html=html)

    async def send_email_notification(
        self,
        to: str,
        template_name: str,
        context: dict[str, Any],
    ) -> None:
        subject, body = self._render(template_name, context)
        await self._deliver(to=to, subject=subject, body=body, context=context)
        logger.info("email_notification_sent", to=to, template=template_name)

    async def queue_email_notification(
        self,
        to: str,
        template_name: str,
        context: dict[str, Any],
        user_id: uuid.UUID | None = None,
    ) -> None:
        from app.tasks.notification_tasks import send_email_task

        send_email_task.delay(
            to=to,
            template_name=template_name,
            context=context,
            user_id=str(user_id) if user_id else None,
        )
        logger.info(
            "email_notification_queued",
            to=to,
            template=template_name,
            user_id=str(user_id) if user_id else None,
        )


# Process-level singleton
email_service = EmailNotificationService()
