from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mangum import Mangum

from app.auth import (
    Identity,
    create_local_token,
    get_identity,
    hash_password,
    verify_password,
)
from app.catalog import CATEGORIES, CITIES, category_by_id, subcategory_ids
from app.config import settings
from app.notify import notify_seller
from app.schemas import (
    BootstrapIn,
    LoginIn,
    OrderIn,
    ProductIn,
    ProfileIn,
    SignupIn,
    PAYMENT_METHOD_LABELS,
    product_code,
    product_payment_methods,
    public_product,
    public_seller,
)
from app.seed import unique_slug
from app.store import Store, get_store, new_id, now_iso

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


def _shop_prefix(seller: dict[str, Any]) -> str:
    slug = "".join(ch for ch in str(seller.get("slug") or "") if ch.isalnum()).upper()
    return (slug[:3] or "PM").ljust(3, "X")


def _next_product_code(store: Store, seller: dict[str, Any]) -> str:
    prefix = _shop_prefix(seller)
    used: set[str] = set()
    highest = 0
    for item in store.list_products(seller_id=seller["id"]):
        code = str(item.get("code") or "").upper()
        used.add(code)
        marker = f"{prefix}-"
        if code.startswith(marker) and code[len(marker) :].isdigit():
            highest = max(highest, int(code[len(marker) :]))
    number = highest + 1
    while True:
        candidate = f"{prefix}-{number:03d}"
        if candidate not in used:
            return candidate
        number += 1


def _product_image_fields(body: ProductIn) -> dict[str, Any]:
    images = [url.strip() for url in body.image_urls if url.strip()]
    cover = body.image_url.strip()
    if cover and cover not in images:
        images = [cover, *images]
    images = images[:8]
    return {
        "image_url": images[0] if images else "",
        "image_urls": images,
    }


def _product_payment_fields(body: ProductIn) -> dict[str, Any]:
    methods = product_payment_methods({"payment_methods": body.payment_methods})
    return {"payment_methods": methods}


def _validate_category(category: str, subcategory: str) -> None:
    if not category_by_id(category):
        raise HTTPException(status_code=400, detail="Unknown category.")
    allowed = subcategory_ids(category)
    if allowed and subcategory not in allowed:
        raise HTTPException(status_code=400, detail="Please pick a subcategory.")


def _json_product(product: dict[str, Any]) -> dict[str, Any]:
    return public_product(product)


def _find_seller(store: Store, identity: Identity) -> dict[str, Any] | None:
    by_sub = store.get_seller_by_cognito_sub(identity.sub)
    if by_sub:
        return by_sub
    return store.get_seller_by_email(identity.email)


def _require_seller(store: Store, identity: Identity) -> dict[str, Any]:
    seller = _find_seller(store, identity)
    if not seller:
        raise HTTPException(status_code=404, detail="Please finish creating your shop.")
    return seller


def _new_seller(
    store: Store,
    *,
    email: str,
    cognito_sub: str,
    name: str,
    city: str,
    whatsapp: str,
    phone: str,
) -> dict[str, Any]:
    seller = {
        "id": new_id(),
        "email": email,
        "cognito_sub": cognito_sub,
        "name": name.strip(),
        "slug": unique_slug(store, name),
        "city": city,
        "bio": "",
        "avatar_url": "",
        "whatsapp": whatsapp.strip(),
        "phone": phone.strip() or whatsapp.strip(),
        "email_public": email,
        "pickup_notes": "",
        "delivery_notes": "",
        "created_at": now_iso(),
    }
    return store.put_seller(seller)


def create_app() -> FastAPI:
    app = FastAPI(title="Podimart Seller Center API", version="0.1.0")
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    store = get_store()
    if settings.storage.lower() != "dynamodb":
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

    def db() -> Store:
        return store

    @app.get("/")
    def root():
        return {
            "name": settings.app_name,
            "auth": settings.auth_mode,
            "docs": "/docs",
        }

    @app.get("/health")
    def health():
        return {"ok": True, "name": settings.app_name, "auth": settings.auth_mode}

    @app.get("/categories")
    def categories():
        return CATEGORIES

    @app.get("/cities")
    def cities():
        return CITIES

    @app.get("/sellers")
    def sellers(city: str | None = None, _store: Store = Depends(db)):
        return _store.list_sellers(city=city)

    @app.get("/sellers/{slug}")
    def seller_shop(slug: str, _store: Store = Depends(db)):
        seller = _store.get_seller_by_slug(slug)
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found.")
        products = [_json_product(p) for p in _store.list_products(seller_id=seller["id"])]
        return {"seller": public_seller(seller), "products": products}

    @app.get("/products")
    def list_public_products(
        category: str | None = None,
        city: str | None = None,
        seller_id: str | None = None,
        _store: Store = Depends(db),
    ):
        products = _store.list_products(category=category, city=city, seller_id=seller_id)
        return [_json_product(p) for p in products]

    @app.post("/auth/signup")
    def signup(body: SignupIn, _store: Store = Depends(db)):
        if settings.auth_mode.lower() == "cognito":
            raise HTTPException(
                status_code=400,
                detail="Use Cognito signup from the Seller Center website.",
            )
        email = body.email.strip().lower()
        if _store.get_user_by_email(email) or _store.get_seller_by_email(email):
            raise HTTPException(status_code=400, detail="That email already has a shop.")
        if body.city not in CITIES:
            raise HTTPException(status_code=400, detail="Please pick a province from the list.")
        user_sub = new_id()
        _store.put_user(
            {
                "sub": user_sub,
                "email": email,
                "password_hash": hash_password(body.password),
            }
        )
        seller = _new_seller(
            _store,
            email=email,
            cognito_sub=user_sub,
            name=body.name,
            city=body.city,
            whatsapp=body.whatsapp,
            phone=body.phone,
        )
        return {"token": create_local_token(user_sub, email), "seller": public_seller(seller)}

    @app.post("/auth/login")
    def login(body: LoginIn, _store: Store = Depends(db)):
        if settings.auth_mode.lower() == "cognito":
            raise HTTPException(
                status_code=400,
                detail="Use Cognito login from the Seller Center website.",
            )
        email = body.email.strip().lower()
        user = _store.get_user_by_email(email)
        if not user or not verify_password(body.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Email or password is wrong.")
        seller = _store.get_seller_by_email(email)
        return {
            "token": create_local_token(str(user["sub"]), email),
            "seller": public_seller(seller) if seller else None,
        }

    @app.post("/me/bootstrap")
    def bootstrap(
        body: BootstrapIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        existing = _find_seller(_store, identity)
        if existing:
            if not existing.get("cognito_sub"):
                existing["cognito_sub"] = identity.sub
                _store.put_seller(existing)
            products = [_json_product(p) for p in _store.list_products(seller_id=existing["id"])]
            return {"seller": public_seller(existing), "products": products}
        if body.city not in CITIES:
            raise HTTPException(status_code=400, detail="Please pick a province from the list.")
        seller = _new_seller(
            _store,
            email=identity.email,
            cognito_sub=identity.sub,
            name=body.name,
            city=body.city,
            whatsapp=body.whatsapp,
            phone=body.phone,
        )
        return {"seller": public_seller(seller), "products": []}

    @app.get("/me")
    def me(identity: Identity = Depends(get_identity), _store: Store = Depends(db)):
        seller = _require_seller(_store, identity)
        products = [_json_product(p) for p in _store.list_products(seller_id=seller["id"])]
        return {"seller": public_seller(seller), "products": products}

    @app.put("/me")
    def update_me(
        body: ProfileIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        updates = body.model_dump(exclude_unset=True)
        if "city" in updates and updates["city"] not in CITIES:
            raise HTTPException(status_code=400, detail="Please pick a province from the list.")
        if "name" in updates and updates["name"]:
            updates["name"] = updates["name"].strip()
        seller.update({k: v for k, v in updates.items() if v is not None})
        _store.put_seller(seller)
        return public_seller(seller)

    @app.delete("/me")
    def delete_me(
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        if not _store.delete_seller(seller["id"]):
            raise HTTPException(status_code=404, detail="Shop not found.")
        if settings.auth_mode.lower() == "cognito" and settings.cognito_user_pool_id:
            import boto3

            try:
                boto3.client("cognito-idp", region_name=settings.aws_region).admin_delete_user(
                    UserPoolId=settings.cognito_user_pool_id,
                    Username=identity.email,
                )
            except Exception:
                pass
        return {"ok": True}

    @app.get("/products/{product_id}")
    def product_detail(
        product_id: str,
        _store: Store = Depends(db),
    ):
        product = _store.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        seller = _store.get_seller(product["seller_id"])
        return {
            "product": _json_product(product),
            "seller": public_seller(seller) if seller else None,
        }

    @app.post("/orders")
    def create_order(body: OrderIn, _store: Store = Depends(db)):
        product = _store.get_product(body.product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found.")
        seller = _store.get_seller(product["seller_id"])
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found.")
        allowed = product_payment_methods(product) or list(PAYMENT_METHOD_LABELS.keys())
        payment_method = body.payment_method.strip()
        if payment_method not in allowed:
            raise HTTPException(status_code=400, detail="Please choose an allowed payment method.")
        order_id = new_id()
        unit = int(product.get("price") or 0)
        quantity = body.quantity
        total = unit * quantity if unit > 0 else 0
        total_label = f"Rs {total:,}" if total > 0 else "Contact for price"
        order = {
            "id": order_id,
            "reference": f"PM-ORD-{order_id[:6].upper()}",
            "status": "pending",
            "product_id": product["id"],
            "product_name": product["name"],
            "product_code": product_code(product),
            "seller_id": seller["id"],
            "seller_name": seller["name"],
            "quantity": quantity,
            "unit_price": unit,
            "total": total,
            "total_label": total_label,
            "payment_method": payment_method,
            "payment_method_label": PAYMENT_METHOD_LABELS.get(payment_method, payment_method),
            "buyer_name": body.buyer_name.strip(),
            "buyer_phone": body.buyer_phone.strip(),
            "buyer_email": body.buyer_email.strip(),
            "note": body.note.strip(),
            "created_at": now_iso(),
        }
        _store.put_order(order)
        notified = notify_seller(order, seller)
        return {
            "order": {
                "reference": order["reference"],
                "product_name": order["product_name"],
                "quantity": order["quantity"],
                "total_label": order["total_label"],
                "payment_method": order["payment_method"],
                "payment_method_label": order["payment_method_label"],
            },
            "notified": notified,
        }

    @app.get("/me/orders")
    def my_orders(
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        return _store.list_orders(seller["id"])

    @app.post("/products")
    def create_product(
        body: ProductIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        _validate_category(body.category, body.subcategory)
        product = {
            "id": new_id(),
            "seller_id": seller["id"],
            "seller_slug": seller["slug"],
            "seller_name": seller["name"],
            "city": seller["city"],
            "category": body.category,
            "subcategory": body.subcategory.strip(),
            "name": body.name.strip(),
            "description": body.description.strip(),
            "price": body.price,
            "lead_time": body.lead_time.strip(),
            **_product_image_fields(body),
            **_product_payment_fields(body),
            "code": _next_product_code(_store, seller),
            "created_at": now_iso(),
        }
        return _json_product(_store.put_product(product))

    @app.put("/products/{product_id}")
    def update_product(
        product_id: str,
        body: ProductIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        product = _store.get_product(product_id)
        if not product or product["seller_id"] != seller["id"]:
            raise HTTPException(status_code=404, detail="Product not found.")
        _validate_category(body.category, body.subcategory)
        if not product.get("code"):
            product["code"] = _next_product_code(_store, seller)
        product.update(
            {
                "name": body.name.strip(),
                "category": body.category,
                "subcategory": body.subcategory.strip(),
                "price": body.price,
                "description": body.description.strip(),
                "lead_time": body.lead_time.strip(),
                **_product_image_fields(body),
                **_product_payment_fields(body),
                "seller_name": seller["name"],
                "city": seller["city"],
            }
        )
        return _json_product(_store.put_product(product))

    @app.delete("/products/{product_id}")
    def delete_product(
        product_id: str,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        if not _store.delete_product(product_id, seller["id"]):
            raise HTTPException(status_code=404, detail="Product not found.")
        return {"ok": True}

    @app.post("/media/upload")
    async def upload_image(
        file: UploadFile = File(...),
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        suffix = ALLOWED_IMAGE_TYPES.get(file.content_type or "")
        if not suffix:
            raise HTTPException(status_code=400, detail="Please upload a JPG, PNG, or WebP photo.")
        data = await file.read()
        if len(data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Photo must be under 5MB.")
        filename = f"{seller['id']}-{new_id()}{suffix}"
        if settings.s3_bucket:
            import boto3

            boto3.client("s3", region_name=settings.aws_region).put_object(
                Bucket=settings.s3_bucket,
                Key=f"products/{filename}",
                Body=data,
                ContentType=file.content_type,
            )
            base = settings.public_asset_base.rstrip("/")
            url = (
                f"{base}/products/{filename}"
                if base
                else f"s3://{settings.s3_bucket}/products/{filename}"
            )
            return {"url": url}

        dest: Path = settings.upload_dir / filename
        dest.write_bytes(data)
        return {"url": f"/uploads/{filename}"}

    return app


app = create_app()
handler = Mangum(app)
