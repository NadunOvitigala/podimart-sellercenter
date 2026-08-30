from typing import Any

from pydantic import BaseModel, Field


def public_seller(seller: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": seller["id"],
        "name": seller["name"],
        "slug": seller["slug"],
        "city": seller["city"],
        "bio": seller.get("bio") or "",
        "avatar_url": seller.get("avatar_url") or "",
        "whatsapp": seller.get("whatsapp") or "",
        "phone": seller.get("phone") or "",
        "email_public": seller.get("email_public") or seller.get("email") or "",
        "pickup_notes": seller.get("pickup_notes") or "",
        "delivery_notes": seller.get("delivery_notes") or "",
        "product_count": int(seller.get("product_count", 0) or 0),
    }


def product_images(product: dict[str, Any]) -> list[str]:
    urls = product.get("image_urls") or []
    if isinstance(urls, str):
        urls = [urls]
    cleaned = [str(url).strip() for url in urls if str(url).strip()]
    cover = str(product.get("image_url") or "").strip()
    if cover and cover not in cleaned:
        cleaned = [cover, *cleaned]
    return cleaned[:8]


def product_code(product: dict[str, Any]) -> str:
    code = str(product.get("code") or "").strip().upper()
    if code:
        return code
    raw = str(product.get("id") or "")[:6].upper()
    return f"PM-{raw}" if raw else ""


PAYMENT_METHOD_IDS = ("cash_on_delivery", "bank_transfer")
PAYMENT_METHOD_LABELS = {
    "cash_on_delivery": "Cash on delivery",
    "bank_transfer": "Bank transfer",
}

PRODUCT_STATUS_IDS = ("active", "disabled")
PRODUCT_STATUS_LABELS = {
    "active": "Active",
    "disabled": "Disabled",
}

VARIATION_TYPE_IDS = ("size", "weight", "version", "height", "other")
VARIATION_TYPE_LABELS = {
    "size": "Size",
    "weight": "Weight",
    "version": "Version",
    "height": "Height",
    "other": "Option",
}


def product_payment_methods(product: dict[str, Any]) -> list[str]:
    raw = product.get("payment_methods") or []
    if isinstance(raw, str):
        raw = [raw]
    cleaned: list[str] = []
    for item in raw:
        value = str(item).strip()
        if value in PAYMENT_METHOD_IDS and value not in cleaned:
            cleaned.append(value)
    return cleaned


def product_status(product: dict[str, Any]) -> str:
    value = str(product.get("status") or "active").strip().lower()
    return value if value in PRODUCT_STATUS_IDS else "active"


def product_reviews(product: dict[str, Any]) -> list[dict[str, Any]]:
    raw = product.get("reviews") or []
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            rating = int(item.get("rating") or 0)
        except (TypeError, ValueError):
            continue
        if rating < 1 or rating > 5:
            continue
        out.append(
            {
                "id": str(item.get("id") or ""),
                "rating": rating,
                "comment": str(item.get("comment") or "").strip()[:500],
                "author_name": str(item.get("author_name") or "").strip()[:80],
                "order_reference": str(item.get("order_reference") or "").strip()[:40],
                "created_at": str(item.get("created_at") or ""),
            }
        )
    return sorted(out, key=lambda row: row.get("created_at") or "", reverse=True)[:50]


def product_rating_avg(product: dict[str, Any]) -> float:
    reviews = product_reviews(product)
    if not reviews:
        return 0.0
    total = sum(int(item["rating"]) for item in reviews)
    return round(total / len(reviews), 1)


def product_is_active(product: dict[str, Any]) -> bool:
    return product_status(product) == "active"


def product_variation_type(product: dict[str, Any]) -> str:
    value = str(product.get("variation_type") or "").strip().lower()
    return value if value in VARIATION_TYPE_IDS else "other"


def product_variants(product: dict[str, Any]) -> list[dict[str, Any]]:
    raw = product.get("variants") or []
    if not isinstance(raw, list):
        return []
    cleaned: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        if not label:
            continue
        variant_id = str(item.get("id") or "").strip() or f"v{len(cleaned) + 1}"
        try:
            price = int(item.get("price") or 0)
        except (TypeError, ValueError):
            price = 0
        price = max(0, min(price, 10_000_000))
        cleaned.append({"id": variant_id, "label": label[:80], "price": price})
        if len(cleaned) >= 20:
            break
    return cleaned


def public_product(product: dict[str, Any]) -> dict[str, Any]:
    images = product_images(product)
    variants = product_variants(product)
    variation_type = product_variation_type(product) if variants else ""
    price = int(product.get("price") or 0)
    if variants and price <= 0:
        price = variants[0]["price"]
    return {
        "id": product["id"],
        "seller_id": product.get("seller_id") or "",
        "seller_slug": product.get("seller_slug") or "",
        "seller_name": product.get("seller_name") or "",
        "city": product.get("city") or "",
        "category": product.get("category") or "",
        "subcategory": product.get("subcategory") or "",
        "name": product.get("name") or "",
        "description": product.get("description") or "",
        "price": price,
        "lead_time": product.get("lead_time") or "",
        "delivery_charge": int(product.get("delivery_charge") or 0),
        "delivery_note": str(product.get("delivery_note") or "").strip(),
        "offers_pickup": bool(product["offers_pickup"]) if "offers_pickup" in product else True,
        "offers_delivery": bool(product["offers_delivery"]) if "offers_delivery" in product else True,
        "reviews": product_reviews(product),
        "rating_avg": product_rating_avg(product),
        "rating_count": len(product_reviews(product)),
        "image_url": images[0] if images else "",
        "image_urls": images,
        "video_urls": [url.strip() for url in (product.get("video_urls") or []) if url.strip()][:2],
        "code": product_code(product),
        "payment_methods": product_payment_methods(product),
        "variation_type": variation_type,
        "variation_type_label": VARIATION_TYPE_LABELS.get(variation_type, "") if variation_type else "",
        "variants": variants,
        "status": product_status(product),
        "created_at": str(product.get("created_at") or ""),
    }


class SignupIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=80)
    city: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(min_length=8, max_length=20)
    phone: str = Field(min_length=8, max_length=20)


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str


class BootstrapIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(min_length=8, max_length=20)
    phone: str = Field(min_length=8, max_length=20)


class ProfileIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    city: str | None = Field(default=None, min_length=2, max_length=40)
    bio: str | None = Field(default=None, max_length=600)
    whatsapp: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=20)
    email_public: str | None = Field(default=None, max_length=120)
    pickup_notes: str | None = Field(default=None, max_length=240)
    delivery_notes: str | None = Field(default=None, max_length=240)
    avatar_url: str | None = Field(default=None, max_length=500)


class VariantIn(BaseModel):
    id: str = Field(default="", max_length=40)
    label: str = Field(min_length=1, max_length=80)
    price: int = Field(ge=0, le=10_000_000)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str
    subcategory: str = Field(default="", max_length=80)
    price: int = Field(ge=0, le=10_000_000)
    description: str = Field(default="", max_length=800)
    lead_time: str = Field(default="Order 2 days before", max_length=80)
    delivery_charge: int = Field(default=0, ge=0, le=10_000_000)
    delivery_note: str = Field(default="", max_length=160)
    offers_pickup: bool = True
    offers_delivery: bool = True
    image_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list, max_length=8)
    video_urls: list[str] = Field(default_factory=list, max_length=2)
    payment_methods: list[str] = Field(default_factory=list, max_length=2)
    variation_type: str = Field(default="other", max_length=40)
    variants: list[VariantIn] = Field(default_factory=list, max_length=20)


class ProductStatusIn(BaseModel):
    status: str = Field(min_length=5, max_length=20)


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    message: str = Field(min_length=5, max_length=2000)
    source: str = Field(default="sellercenter", max_length=40)


class AdminGrantIn(BaseModel):
    email: str = Field(min_length=5, max_length=120)


class OrderIn(BaseModel):
    product_id: str = Field(min_length=4, max_length=40)
    quantity: int = Field(ge=1, le=99)
    payment_method: str = Field(min_length=2, max_length=40)
    variant_id: str = Field(default="", max_length=40)
    buyer_name: str = Field(min_length=2, max_length=80)
    buyer_phone: str = Field(min_length=8, max_length=20)
    buyer_email: str = Field(min_length=5, max_length=120)
    note: str = Field(default="", max_length=400)


class OrderNoteIn(BaseModel):
    message: str = Field(min_length=2, max_length=400)
    notify_buyer: bool = False


class ReviewIn(BaseModel):
    product_id: str = Field(min_length=4, max_length=40)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=500)
    author_name: str = Field(min_length=2, max_length=80)
    order_reference: str = Field(default="", max_length=40)


class ReportIn(BaseModel):
    product_id: str = Field(min_length=4, max_length=40)
    reason: str = Field(min_length=5, max_length=500)
    reporter_name: str = Field(default="", max_length=80)
    reporter_email: str = Field(default="", max_length=120)
