from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import boto3
from boto3.dynamodb.conditions import Key

from app.config import settings
from app.schemas import public_seller

LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def slugify(name: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned[:48] or "shop"


class Store(Protocol):
    def get_seller(self, seller_id: str) -> dict[str, Any] | None: ...
    def get_seller_by_email(self, email: str) -> dict[str, Any] | None: ...
    def get_seller_by_slug(self, slug: str) -> dict[str, Any] | None: ...
    def get_seller_by_cognito_sub(self, sub: str) -> dict[str, Any] | None: ...
    def put_seller(self, seller: dict[str, Any]) -> dict[str, Any]: ...
    def delete_seller(self, seller_id: str) -> bool: ...
    def list_sellers(self, city: str | None = None) -> list[dict[str, Any]]: ...
    def get_product(self, product_id: str) -> dict[str, Any] | None: ...
    def list_products(
        self,
        seller_id: str | None = None,
        category: str | None = None,
        city: str | None = None,
    ) -> list[dict[str, Any]]: ...
    def put_product(self, product: dict[str, Any]) -> dict[str, Any]: ...
    def delete_product(self, product_id: str, seller_id: str) -> bool: ...
    def delete_product_by_id(self, product_id: str) -> bool: ...
    def get_user_by_email(self, email: str) -> dict[str, Any] | None: ...
    def put_user(self, user: dict[str, Any]) -> dict[str, Any]: ...
    def put_order(self, order: dict[str, Any]) -> dict[str, Any]: ...
    def get_order(self, order_id: str) -> dict[str, Any] | None: ...
    def update_order(self, order: dict[str, Any]) -> dict[str, Any]: ...
    def list_orders(self, seller_id: str) -> list[dict[str, Any]]: ...
    def list_all_orders(self) -> list[dict[str, Any]]: ...


class LocalStore:
    def __init__(self, path: Path):
        self.path = path
        if not self.path.exists():
            self._write({"sellers": [], "products": [], "users": [], "orders": []})

    def _read(self) -> dict[str, list[dict[str, Any]]]:
        with LOCK:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        data.setdefault("sellers", [])
        data.setdefault("products", [])
        data.setdefault("users", [])
        data.setdefault("orders", [])
        return data

    def _write(self, data: dict[str, Any]) -> None:
        with LOCK:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def get_seller(self, seller_id: str) -> dict[str, Any] | None:
        return next((s for s in self._read()["sellers"] if s["id"] == seller_id), None)

    def get_seller_by_email(self, email: str) -> dict[str, Any] | None:
        email = email.lower()
        return next((s for s in self._read()["sellers"] if s.get("email") == email), None)

    def get_seller_by_slug(self, slug: str) -> dict[str, Any] | None:
        return next((s for s in self._read()["sellers"] if s["slug"] == slug), None)

    def get_seller_by_cognito_sub(self, sub: str) -> dict[str, Any] | None:
        return next(
            (s for s in self._read()["sellers"] if s.get("cognito_sub") == sub),
            None,
        )

    def put_seller(self, seller: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        existing = next((i for i, s in enumerate(data["sellers"]) if s["id"] == seller["id"]), None)
        if existing is None:
            data["sellers"].append(seller)
        else:
            data["sellers"][existing] = seller
        self._write(data)
        return seller

    def delete_seller(self, seller_id: str) -> bool:
        data = self._read()
        seller = next((s for s in data["sellers"] if s["id"] == seller_id), None)
        if not seller:
            return False
        email = (seller.get("email") or "").lower()
        data["sellers"] = [s for s in data["sellers"] if s["id"] != seller_id]
        data["products"] = [p for p in data["products"] if p.get("seller_id") != seller_id]
        if email:
            data["users"] = [u for u in data["users"] if (u.get("email") or "").lower() != email]
        self._write(data)
        return True

    def list_sellers(self, city: str | None = None) -> list[dict[str, Any]]:
        data = self._read()
        sellers = data["sellers"]
        products = data["products"]
        if city:
            sellers = [s for s in sellers if s.get("city", "").lower() == city.lower()]
        out = []
        for seller in sellers:
            item = public_seller(seller)
            item["product_count"] = sum(
                1
                for p in products
                if p["seller_id"] == seller["id"]
                and str(p.get("status") or "active").lower() != "disabled"
            )
            out.append(item)
        return out

    def get_product(self, product_id: str) -> dict[str, Any] | None:
        return next((p for p in self._read()["products"] if p["id"] == product_id), None)

    def list_products(
        self,
        seller_id: str | None = None,
        category: str | None = None,
        city: str | None = None,
    ) -> list[dict[str, Any]]:
        products = self._read()["products"]
        if seller_id:
            products = [p for p in products if p["seller_id"] == seller_id]
        if category:
            products = [p for p in products if p.get("category") == category]
        if city:
            products = [p for p in products if str(p.get("city", "")).lower() == city.lower()]
        return sorted(products, key=lambda p: p.get("created_at", ""), reverse=True)

    def put_product(self, product: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        existing = next((i for i, p in enumerate(data["products"]) if p["id"] == product["id"]), None)
        if existing is None:
            data["products"].append(product)
        else:
            data["products"][existing] = product
        self._write(data)
        return product

    def delete_product(self, product_id: str, seller_id: str) -> bool:
        data = self._read()
        before = len(data["products"])
        data["products"] = [
            p
            for p in data["products"]
            if not (p["id"] == product_id and p["seller_id"] == seller_id)
        ]
        self._write(data)
        return len(data["products"]) < before

    def delete_product_by_id(self, product_id: str) -> bool:
        data = self._read()
        before = len(data["products"])
        data["products"] = [p for p in data["products"] if p["id"] != product_id]
        self._write(data)
        return len(data["products"]) < before

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        email = email.lower()
        return next((u for u in self._read()["users"] if u.get("email") == email), None)

    def put_user(self, user: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        existing = next((i for i, u in enumerate(data["users"]) if u["sub"] == user["sub"]), None)
        if existing is None:
            data["users"].append(user)
        else:
            data["users"][existing] = user
        self._write(data)
        return user

    def put_order(self, order: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        data["orders"].append(order)
        self._write(data)
        return order

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        return next((item for item in self._read()["orders"] if item.get("id") == order_id), None)

    def update_order(self, order: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        order_id = order.get("id")
        for index, item in enumerate(data["orders"]):
            if item.get("id") == order_id:
                data["orders"][index] = order
                self._write(data)
                return order
        data["orders"].append(order)
        self._write(data)
        return order

    def list_orders(self, seller_id: str) -> list[dict[str, Any]]:
        orders = [item for item in self._read()["orders"] if item.get("seller_id") == seller_id]
        return sorted(orders, key=lambda item: item.get("created_at", ""), reverse=True)

    def list_all_orders(self) -> list[dict[str, Any]]:
        return sorted(self._read()["orders"], key=lambda item: item.get("created_at", ""), reverse=True)


class DynamoStore:
    def __init__(self) -> None:
        dynamo = boto3.resource("dynamodb", region_name=settings.aws_region)
        self.sellers = dynamo.Table(settings.table_sellers)
        self.products = dynamo.Table(settings.table_products)
        self.orders = dynamo.Table(settings.table_orders)

    def get_seller(self, seller_id: str) -> dict[str, Any] | None:
        return self.sellers.get_item(Key={"id": seller_id}).get("Item")

    def get_seller_by_email(self, email: str) -> dict[str, Any] | None:
        res = self.sellers.query(
            IndexName="email-index",
            KeyConditionExpression=Key("email").eq(email.lower()),
        )
        items = res.get("Items") or []
        return items[0] if items else None

    def get_seller_by_slug(self, slug: str) -> dict[str, Any] | None:
        res = self.sellers.query(
            IndexName="slug-index",
            KeyConditionExpression=Key("slug").eq(slug),
        )
        items = res.get("Items") or []
        return items[0] if items else None

    def get_seller_by_cognito_sub(self, sub: str) -> dict[str, Any] | None:
        try:
            res = self.sellers.query(
                IndexName="cognito-sub-index",
                KeyConditionExpression=Key("cognito_sub").eq(sub),
            )
            items = res.get("Items") or []
            return items[0] if items else None
        except Exception:
            return None

    def put_seller(self, seller: dict[str, Any]) -> dict[str, Any]:
        self.sellers.put_item(Item=seller)
        return seller

    def delete_seller(self, seller_id: str) -> bool:
        existing = self.get_seller(seller_id)
        if not existing:
            return False
        for product in self.list_products(seller_id=seller_id):
            self.products.delete_item(Key={"id": product["id"]})
        self.sellers.delete_item(Key={"id": seller_id})
        return True

    def list_sellers(self, city: str | None = None) -> list[dict[str, Any]]:
        if city:
            res = self.sellers.query(
                IndexName="city-index",
                KeyConditionExpression=Key("city").eq(city),
            )
            sellers = res.get("Items") or []
        else:
            sellers = self.sellers.scan().get("Items") or []
        out = []
        for seller in sellers:
            item = public_seller(seller)
            item["product_count"] = sum(
                1
                for p in self.list_products(seller_id=seller["id"])
                if str(p.get("status") or "active").lower() != "disabled"
            )
            out.append(item)
        return out

    def get_product(self, product_id: str) -> dict[str, Any] | None:
        return self.products.get_item(Key={"id": product_id}).get("Item")

    def list_products(
        self,
        seller_id: str | None = None,
        category: str | None = None,
        city: str | None = None,
    ) -> list[dict[str, Any]]:
        if seller_id:
            res = self.products.query(
                IndexName="seller-index",
                KeyConditionExpression=Key("seller_id").eq(seller_id),
            )
            products = res.get("Items") or []
        elif category:
            res = self.products.query(
                IndexName="category-index",
                KeyConditionExpression=Key("category").eq(category),
            )
            products = res.get("Items") or []
        else:
            products = self.products.scan().get("Items") or []
        if city:
            products = [p for p in products if str(p.get("city", "")).lower() == city.lower()]
        if category and seller_id:
            products = [p for p in products if p.get("category") == category]
        return sorted(products, key=lambda p: p.get("created_at", ""), reverse=True)

    def put_product(self, product: dict[str, Any]) -> dict[str, Any]:
        item = dict(product)
        item["price"] = int(item["price"])
        self.products.put_item(Item=item)
        return product

    def delete_product(self, product_id: str, seller_id: str) -> bool:
        existing = self.get_product(product_id)
        if not existing or existing.get("seller_id") != seller_id:
            return False
        self.products.delete_item(Key={"id": product_id})
        return True

    def delete_product_by_id(self, product_id: str) -> bool:
        existing = self.get_product(product_id)
        if not existing:
            return False
        self.products.delete_item(Key={"id": product_id})
        return True

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        return None

    def put_user(self, user: dict[str, Any]) -> dict[str, Any]:
        return user

    def put_order(self, order: dict[str, Any]) -> dict[str, Any]:
        item = dict(order)
        item["quantity"] = int(item.get("quantity") or 0)
        item["unit_price"] = int(item.get("unit_price") or 0)
        item["total"] = int(item.get("total") or 0)
        if "items_total" in item:
            item["items_total"] = int(item.get("items_total") or 0)
        if "delivery_charge" in item:
            item["delivery_charge"] = int(item.get("delivery_charge") or 0)
        self.orders.put_item(Item=item)
        return order

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        return self.orders.get_item(Key={"id": order_id}).get("Item")

    def update_order(self, order: dict[str, Any]) -> dict[str, Any]:
        return self.put_order(order)

    def list_orders(self, seller_id: str) -> list[dict[str, Any]]:
        try:
            res = self.orders.query(
                IndexName="seller-index",
                KeyConditionExpression=Key("seller_id").eq(seller_id),
            )
            orders = res.get("Items") or []
        except Exception:
            scanned = self.orders.scan().get("Items") or []
            orders = [item for item in scanned if item.get("seller_id") == seller_id]
        return sorted(orders, key=lambda item: item.get("created_at", ""), reverse=True)

    def list_all_orders(self) -> list[dict[str, Any]]:
        items = self.orders.scan().get("Items") or []
        return sorted(items, key=lambda item: item.get("created_at", ""), reverse=True)


def get_store() -> Store:
    if settings.storage.lower() == "dynamodb":
        return DynamoStore()
    return LocalStore(settings.data_dir / "db.json")
