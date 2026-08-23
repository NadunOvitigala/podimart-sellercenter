from __future__ import annotations

import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.message import EmailMessage

from app.config import settings


def phone_digits(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if digits.startswith("0"):
        digits = f"94{digits[1:]}"
    return digits


def order_message(order: dict) -> str:
    total = order.get("total_label") or "Contact for price"
    note = order.get("note") or "—"
    payment = order.get("payment_method_label") or order.get("payment_method") or "—"
    payment_note = ""
    if order.get("payment_method") == "bank_transfer":
        payment_note = (
            "\nBuyer selected bank transfer. Please contact the buyer and share the bank details.\n"
        )
    variant_line = ""
    if order.get("variant_label"):
        kind = order.get("variation_type_label") or "Option"
        variant_line = f"{kind}: {order['variant_label']}\n"
    delivery_note = order.get("delivery_note") or ""
    delivery_suffix = f" ({delivery_note})" if delivery_note else ""
    return (
        f"Hey, there is a new order on podimart.lk.\n\n"
        f"Order: {order['reference']}\n"
        f"Product: {order['product_name']} ({order['product_code']})\n"
        f"{variant_line}"
        f"Quantity: {order['quantity']}\n"
        f"Items: Rs {order.get('items_total', 0):,}\n"
        f"Delivery: {order.get('delivery_label') or 'Free'}{delivery_suffix}\n"
        f"Total: {total}\n"
        f"Payment: {payment}\n"
        f"{payment_note}\n"
        f"Buyer: {order['buyer_name']}\n"
        f"Phone / WhatsApp: {order['buyer_phone']}\n"
        f"Email: {order.get('buyer_email') or '—'}\n"
        f"Note: {note}\n\n"
        f"Please confirm this order with the buyer."
    )


def _from_address() -> str:
    return (settings.smtp_from or "podimart.lk <no-reply@podimart.lk>").strip()


def send_email_ses(
    to: str,
    subject: str,
    body: str,
    *,
    reply_to: str | None = None,
) -> bool:
    """Send with Amazon SES API (uses AWS credentials + verified domain)."""
    try:
        import boto3

        client = boto3.client("ses", region_name=settings.aws_region)
        params: dict = {
            "Source": _from_address(),
            "Destination": {"ToAddresses": [to]},
            "Message": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
            },
        }
        if reply_to:
            params["ReplyToAddresses"] = [reply_to]
        client.send_email(**params)
        return True
    except Exception as exc:
        print("SES email notify failed:", exc)
        return False


def send_email_smtp(
    to: str,
    subject: str,
    body: str,
    *,
    reply_to: str | None = None,
) -> bool:
    if not settings.smtp_host:
        print(f"[email skipped] SMTP_HOST not set\n{subject}\n{body}\n")
        return False
    message = EmailMessage()
    message["From"] = _from_address()
    message["To"] = to
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
        return True
    except Exception as exc:
        print("SMTP email notify failed:", exc)
        return False


def send_email(
    to: str,
    subject: str,
    body: str,
    *,
    reply_to: str | None = None,
) -> bool:
    if not to:
        return False
    provider = (settings.email_provider or "ses").strip().lower()
    if provider == "ses":
        return send_email_ses(to, subject, body, reply_to=reply_to)
    return send_email_smtp(to, subject, body, reply_to=reply_to)


def send_contact_message(*, name: str, email: str, message: str, source: str) -> bool:
    to = (settings.contact_to_email or "").strip()
    if not to:
        print("[contact skipped] CONTACT_TO_EMAIL not set")
        return False
    subject = f"podimart.lk contact — {source}"
    body = (
        f"New message from the {source} contact form.\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n\n"
        f"{message}\n"
    )
    return send_email(to, subject, body, reply_to=email)


def shop_created_message(seller: dict) -> str:
    name = str(seller.get("name") or "your shop").strip()
    slug = str(seller.get("slug") or "").strip()
    shop_url = f"{settings.public_url.rstrip('/')}/shop/{slug}" if slug else settings.public_url
    dashboard_url = f"{settings.sellercenter_url.rstrip('/')}/dashboard/listings"
    return (
        f"Hi,\n\n"
        f"Your shop \"{name}\" is now live on podimart.lk.\n\n"
        f"Shop page: {shop_url}\n"
        f"Seller Center: {dashboard_url}\n\n"
        f"Next steps:\n"
        f"- Add your first product\n"
        f"- Share your shop link with customers\n"
        f"- Buyers can contact you on WhatsApp\n\n"
        f"Thanks for joining podimart.lk!\n\n"
        f"— podimart.lk"
    )


def send_shop_created_email(seller: dict) -> bool:
    to = (seller.get("email") or seller.get("email_public") or "").strip().lower()
    if not to:
        return False
    name = str(seller.get("name") or "your shop").strip()
    subject = f"Your shop is live on podimart.lk — {name}"
    return send_email(to, subject, shop_created_message(seller))


def send_whatsapp(to: str, body: str) -> bool:
    """Send from the podimart.lk WhatsApp Business number via Meta Cloud API."""
    token = settings.whatsapp_token
    phone_id = settings.whatsapp_phone_id
    destination = phone_digits(to)
    if not token or not phone_id or not destination:
        if to:
            print(f"[whatsapp skipped] to={destination or to}\n{body}\n")
        return False
    url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
    if settings.whatsapp_template:
        payload: dict = {
            "messaging_product": "whatsapp",
            "to": destination,
            "type": "template",
            "template": {
                "name": settings.whatsapp_template,
                "language": {"code": settings.whatsapp_template_lang},
            },
        }
    else:
        payload = {
            "messaging_product": "whatsapp",
            "to": destination,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return 200 <= response.status < 300
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        print("WhatsApp notify failed:", exc.code, detail)
        return False
    except Exception as exc:
        print("WhatsApp notify failed:", exc)
        return False


def notify_seller(order: dict, seller: dict) -> dict[str, bool]:
    body = order_message(order)
    subject = f"New order {order['reference']} — {order['product_name']}"
    email_to = seller.get("email_public") or seller.get("email") or ""
    whatsapp_to = seller.get("whatsapp") or seller.get("phone") or ""
    return {
        "email": send_email(email_to, subject, body),
        "whatsapp": send_whatsapp(whatsapp_to, body),
    }
