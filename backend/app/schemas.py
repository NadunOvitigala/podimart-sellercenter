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


def public_product(product: dict[str, Any]) -> dict[str, Any]:
    images = product_images(product)
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
        "price": int(product.get("price") or 0),
        "lead_time": product.get("lead_time") or "",
        "image_url": images[0] if images else "",
        "image_urls": images,
        "code": product_code(product),
        "created_at": str(product.get("created_at") or ""),
    }


def product_code(product: dict[str, Any]) -> str:
    code = str(product.get("code") or "").strip().upper()
    if code:
        return code
    raw = str(product.get("id") or "")[:6].upper()
    return f"PM-{raw}" if raw else ""


class SignupIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=80)
    city: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(default="", max_length=20)
    phone: str = Field(default="", max_length=20)


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str


class BootstrapIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    city: str = Field(min_length=2, max_length=40)
    whatsapp: str = Field(default="", max_length=20)
    phone: str = Field(default="", max_length=20)


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


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str
    subcategory: str = Field(default="", max_length=80)
    price: int = Field(ge=0, le=10_000_000)
    description: str = Field(default="", max_length=800)
    lead_time: str = Field(default="Order 2 days before", max_length=80)
    image_url: str = Field(default="", max_length=500)
    image_urls: list[str] = Field(default_factory=list, max_length=8)
