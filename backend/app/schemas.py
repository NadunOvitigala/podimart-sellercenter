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


def public_product(product: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": product["id"],
        "seller_id": product.get("seller_id") or "",
        "seller_slug": product.get("seller_slug") or "",
        "seller_name": product.get("seller_name") or "",
        "city": product.get("city") or "",
        "category": product.get("category") or "",
        "name": product.get("name") or "",
        "description": product.get("description") or "",
        "price": int(product.get("price") or 0),
        "lead_time": product.get("lead_time") or "",
        "image_url": product.get("image_url") or "",
        "created_at": str(product.get("created_at") or ""),
    }


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


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    category: str
    price: int = Field(ge=0, le=10_000_000)
    description: str = Field(default="", max_length=800)
    lead_time: str = Field(default="Order 2 days before", max_length=80)
    image_url: str = Field(default="", max_length=500)
