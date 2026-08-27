from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mangum import Mangum

from app.auth import (
    Identity,
    create_admin_local_token,
    create_local_token,
    get_identity,
    hash_password,
    is_admin,
    require_admin,
    verify_password,
)
from app.admin_store import get_admin_store
from app.catalog import CATEGORIES, CITIES, category_by_id, subcategory_ids
from app.cognito_users import list_cognito_users
from app.config import settings
from app.notify import notify_seller, send_contact_message, send_order_confirmed_email, send_shop_created_email
from app.schemas import (
    AdminGrantIn,
    BootstrapIn,
    ContactIn,
    LoginIn,
    OrderIn,
    PAYMENT_METHOD_LABELS,
    ProductIn,
    ProductStatusIn,
    ProfileIn,
    SignupIn,
    VARIATION_TYPE_IDS,
    VARIATION_TYPE_LABELS,
    product_code,
    product_is_active,
    product_payment_methods,
    product_status,
    product_variants,
    public_product,
    public_seller,
)
from app.seed import unique_slug
from app.store import Store, get_store, new_id, now_iso

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 5 * 1024 * 1024


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


def _product_video_fields(body: ProductIn) -> dict[str, Any]:
    videos = [url.strip() for url in body.video_urls if url.strip()]
    return {"video_urls": videos[:2]}


def _product_delivery_fields(body: ProductIn) -> dict[str, Any]:
    return {
        "delivery_charge": int(body.delivery_charge or 0),
        "delivery_note": body.delivery_note.strip()[:160],
    }


def _product_payment_fields(body: ProductIn) -> dict[str, Any]:
    methods = product_payment_methods({"payment_methods": body.payment_methods})
    return {"payment_methods": methods}


def _product_variant_fields(body: ProductIn) -> dict[str, Any]:
    variants: list[dict[str, Any]] = []
    for item in body.variants[:20]:
        label = item.label.strip()
        if not label:
            continue
        variants.append(
            {
                "id": (item.id.strip() or new_id()),
                "label": label[:80],
                "price": int(item.price),
            }
        )
    variation_type = body.variation_type.strip().lower()
    if variation_type not in VARIATION_TYPE_IDS:
        variation_type = "other"
    price = int(body.price)
    if variants:
        price = variants[0]["price"] if price <= 0 else price
    return {
        "variation_type": variation_type if variants else "",
        "variants": variants,
        "price": price,
    }


def _validate_category(category: str, subcategory: str) -> None:
    if not category_by_id(category):
        raise HTTPException(status_code=400, detail="Unknown category.")
    allowed = subcategory_ids(category)
    if allowed and subcategory not in allowed:
        raise HTTPException(status_code=400, detail="Please pick a subcategory.")


def _json_product(product: dict[str, Any]) -> dict[str, Any]:
    return public_product(product)


def _admin_seller(seller: dict[str, Any], product_count: int | None = None) -> dict[str, Any]:
    item = public_seller(seller)
    item["email"] = seller.get("email") or ""
    item["created_at"] = seller.get("created_at") or ""
    if product_count is not None:
        item["product_count"] = product_count
    return item


def _admin_product(product: dict[str, Any]) -> dict[str, Any]:
    item = _json_product(product)
    item["status"] = product_status(product)
    item["seller_id"] = product.get("seller_id") or ""
    item["created_at"] = product.get("created_at") or ""
    return item


def _admin_users(store: Store) -> list[dict[str, Any]]:
    admin_store = get_admin_store()
    admin_emails_set = admin_store.list_admin_emails()
    admin_meta = {
        (item.get("email") or "").lower(): item for item in admin_store.list_records()
    }
    users: dict[str, dict[str, Any]] = {}

    for item in list_cognito_users():
        email = item["email"]
        users[email] = {
            "email": email,
            "name": item.get("name") or "",
            "status": item.get("status") or "",
            "created_at": item.get("created_at") or "",
            "shop_name": "",
            "shop_slug": "",
            "is_admin": email in admin_emails_set,
            "granted_at": admin_meta.get(email, {}).get("granted_at") or "",
        }

    for item in store.list_sellers():
        full = store.get_seller(item["id"])
        if not full:
            continue
        email = (full.get("email") or "").lower()
        if not email:
            continue
        entry = users.get(email) or {
            "email": email,
            "name": full.get("name") or "",
            "status": "CONFIRMED",
            "created_at": full.get("created_at") or "",
            "shop_name": "",
            "shop_slug": "",
            "is_admin": email in admin_emails_set,
            "granted_at": admin_meta.get(email, {}).get("granted_at") or "",
        }
        entry["shop_name"] = full.get("name") or ""
        entry["shop_slug"] = full.get("slug") or ""
        entry["is_admin"] = email in admin_emails_set
        users[email] = entry

    for email in admin_emails_set:
        if email not in users:
            users[email] = {
                "email": email,
                "name": "",
                "status": "ADMIN",
                "created_at": admin_meta.get(email, {}).get("granted_at") or "",
                "shop_name": "",
                "shop_slug": "",
                "is_admin": True,
                "granted_at": admin_meta.get(email, {}).get("granted_at") or "",
            }

    return sorted(users.values(), key=lambda item: item.get("email") or "")


def _delete_cognito_user(email: str) -> None:
    if settings.auth_mode.lower() != "cognito" or not settings.cognito_user_pool_id:
        return
    import boto3

    try:
        boto3.client("cognito-idp", region_name=settings.aws_region).admin_delete_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=email,
        )
    except Exception:
        pass


def _public_products(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [_json_product(item) for item in products if product_is_active(item)]


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

    @app.post("/contact")
    def contact(body: ContactIn):
        source = body.source.strip().lower() or "website"
        if source not in ("sellercenter", "marketplace", "website"):
            source = "website"
        sent = send_contact_message(
            name=body.name.strip(),
            email=body.email.strip().lower(),
            message=body.message.strip(),
            source=source,
        )
        if not sent:
            raise HTTPException(
                status_code=502,
                detail="Could not send your message. Please try again shortly.",
            )
        return {"ok": True}

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
        products = _public_products(_store.list_products(seller_id=seller["id"]))
        return {"seller": public_seller(seller), "products": products}

    @app.get("/products")
    def list_public_products(
        category: str | None = None,
        city: str | None = None,
        seller_id: str | None = None,
        _store: Store = Depends(db),
    ):
        products = _store.list_products(category=category, city=city, seller_id=seller_id)
        return _public_products(products)

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
        send_shop_created_email(seller)
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
        send_shop_created_email(seller)
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
        _delete_cognito_user(identity.email)
        return {"ok": True}

    @app.get("/products/{product_id}")
    def product_detail(
        product_id: str,
        _store: Store = Depends(db),
    ):
        product = _store.get_product(product_id)
        if not product or not product_is_active(product):
            raise HTTPException(status_code=404, detail="Product not found.")
        seller = _store.get_seller(product["seller_id"])
        return {
            "product": _json_product(product),
            "seller": public_seller(seller) if seller else None,
        }

    @app.post("/orders")
    def create_order(body: OrderIn, _store: Store = Depends(db)):
        product = _store.get_product(body.product_id)
        if not product or not product_is_active(product):
            raise HTTPException(status_code=404, detail="Product not found.")
        seller = _store.get_seller(product["seller_id"])
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found.")
        allowed = product_payment_methods(product) or list(PAYMENT_METHOD_LABELS.keys())
        payment_method = body.payment_method.strip()
        if payment_method not in allowed:
            raise HTTPException(status_code=400, detail="Please choose an allowed payment method.")
        variants = product_variants(product)
        variant_id = ""
        variant_label = ""
        unit = int(product.get("price") or 0)
        if variants:
            chosen = next((item for item in variants if item["id"] == body.variant_id.strip()), None)
            if not chosen:
                raise HTTPException(status_code=400, detail="Please choose a product option.")
            variant_id = chosen["id"]
            variant_label = chosen["label"]
            unit = int(chosen["price"])
        order_id = new_id()
        quantity = body.quantity
        delivery_charge = int(product.get("delivery_charge") or 0)
        items_total = unit * quantity if unit > 0 else 0
        total = items_total + delivery_charge if items_total > 0 else 0
        if items_total > 0:
            total_label = f"Rs {total:,}"
        elif delivery_charge > 0:
            total_label = f"Rs {delivery_charge:,} (delivery only — contact for item price)"
        else:
            total_label = "Contact for price"
        delivery_label = "Free" if delivery_charge <= 0 else f"Rs {delivery_charge:,}"
        variation_type = str(product.get("variation_type") or "")
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
            "items_total": items_total,
            "delivery_charge": delivery_charge,
            "delivery_note": str(product.get("delivery_note") or "").strip(),
            "delivery_label": delivery_label,
            "total": total,
            "total_label": total_label,
            "variant_id": variant_id,
            "variant_label": variant_label,
            "variation_type": variation_type,
            "variation_type_label": VARIATION_TYPE_LABELS.get(variation_type, ""),
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
                "variant_label": order["variant_label"],
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

    @app.post("/me/orders/{order_id}/confirm")
    def confirm_order(
        order_id: str,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        order = _store.get_order(order_id)
        if not order or order.get("seller_id") != seller["id"]:
            raise HTTPException(status_code=404, detail="Order not found.")
        status = str(order.get("status") or "pending").lower()
        if status == "confirmed":
            return {"order": order, "buyer_notified": False, "already_confirmed": True}
        if status not in ("pending", ""):
            raise HTTPException(status_code=400, detail="Only pending orders can be confirmed.")
        order["status"] = "confirmed"
        order["confirmed_at"] = now_iso()
        saved = _store.update_order(order)
        buyer_notified = send_order_confirmed_email(saved, seller)
        return {
            "order": saved,
            "buyer_notified": buyer_notified,
            "already_confirmed": False,
        }

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
            "lead_time": body.lead_time.strip(),
            **_product_image_fields(body),
            **_product_video_fields(body),
            **_product_delivery_fields(body),
            **_product_payment_fields(body),
            **_product_variant_fields(body),
            "status": "active",
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
                "description": body.description.strip(),
                "lead_time": body.lead_time.strip(),
                **_product_image_fields(body),
                **_product_video_fields(body),
                **_product_delivery_fields(body),
                **_product_payment_fields(body),
                **_product_variant_fields(body),
                "seller_name": seller["name"],
                "city": seller["city"],
                "status": product_status(product),
            }
        )
        return _json_product(_store.put_product(product))

    @app.patch("/products/{product_id}/status")
    def update_product_status(
        product_id: str,
        body: ProductStatusIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        product = _store.get_product(product_id)
        if not product or product["seller_id"] != seller["id"]:
            raise HTTPException(status_code=404, detail="Product not found.")
        status = body.status.strip().lower()
        if status not in ("active", "disabled"):
            raise HTTPException(status_code=400, detail="Status must be active or disabled.")
        product["status"] = status
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
        content_type = file.content_type or ""
        is_video = content_type in ALLOWED_VIDEO_TYPES
        suffix = ALLOWED_IMAGE_TYPES.get(content_type) or ALLOWED_VIDEO_TYPES.get(content_type)
        if not suffix:
            raise HTTPException(
                status_code=400,
                detail="Please upload a JPG, PNG, WebP photo, or MP4/WebM/MOV video.",
            )
        max_bytes = MAX_VIDEO_BYTES if is_video else MAX_IMAGE_BYTES
        data = await file.read()
        if len(data) > max_bytes:
            kind = "Video" if is_video else "Photo"
            raise HTTPException(status_code=400, detail=f"{kind} must be under 5MB.")
        folder = "videos" if is_video else "products"
        filename = f"{seller['id']}-{new_id()}{suffix}"
        if settings.s3_bucket:
            import boto3

            boto3.client("s3", region_name=settings.aws_region).put_object(
                Bucket=settings.s3_bucket,
                Key=f"{folder}/{filename}",
                Body=data,
                ContentType=content_type,
            )
            base = settings.public_asset_base.rstrip("/")
            url = (
                f"{base}/{folder}/{filename}"
                if base
                else f"s3://{settings.s3_bucket}/{folder}/{filename}"
            )
            return {"url": url, "kind": "video" if is_video else "image"}

        dest: Path = settings.upload_dir / filename
        dest.write_bytes(data)
        return {"url": f"/uploads/{filename}", "kind": "video" if is_video else "image"}

    @app.post("/admin/auth/login")
    def admin_login(body: LoginIn):
        if settings.auth_mode.lower() == "cognito":
            raise HTTPException(
                status_code=400,
                detail="Use Cognito login from the admin website.",
            )
        email = body.email.strip().lower()
        if not is_admin(Identity(sub=f"admin:{email}", email=email)):
            raise HTTPException(status_code=403, detail="Admin access only.")
        if not settings.admin_password or body.password != settings.admin_password:
            raise HTTPException(status_code=401, detail="Email or password is wrong.")
        return {"token": create_admin_local_token(email), "email": email}

    @app.get("/admin/me")
    def admin_me(identity: Identity = Depends(require_admin)):
        return {"email": identity.email}

    @app.get("/admin/sellers")
    def admin_list_sellers(
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        sellers = _store.list_sellers()
        out: list[dict[str, Any]] = []
        for item in sellers:
            full = _store.get_seller(item["id"])
            if full:
                out.append(_admin_seller(full, product_count=item.get("product_count", 0)))
        return out

    @app.get("/admin/products")
    def admin_list_products(
        seller_id: str | None = None,
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        products = _store.list_products(seller_id=seller_id)
        return [_admin_product(item) for item in products]

    @app.delete("/admin/sellers/{seller_id}")
    def admin_delete_seller(
        seller_id: str,
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        seller = _store.get_seller(seller_id)
        if not seller:
            raise HTTPException(status_code=404, detail="Shop not found.")
        email = (seller.get("email") or "").lower()
        if not _store.delete_seller(seller_id):
            raise HTTPException(status_code=404, detail="Shop not found.")
        if email:
            _delete_cognito_user(email)
        return {"ok": True}

    @app.delete("/admin/products/{product_id}")
    def admin_delete_product(
        product_id: str,
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        if not _store.delete_product_by_id(product_id):
            raise HTTPException(status_code=404, detail="Product not found.")
        return {"ok": True}

    @app.get("/admin/users")
    def admin_list_users(
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        return _admin_users(_store)

    @app.post("/admin/users/grant")
    def admin_grant_user(
        body: AdminGrantIn,
        identity: Identity = Depends(require_admin),
    ):
        email = body.email.strip().lower()
        if "@" not in email:
            raise HTTPException(status_code=400, detail="Enter a valid email.")
        record = get_admin_store().grant(email, identity.email)
        return {"ok": True, "user": record}

    @app.delete("/admin/users/{email}/admin")
    def admin_revoke_user(
        email: str,
        identity: Identity = Depends(require_admin),
    ):
        target = email.strip().lower()
        if target == identity.email.lower():
            raise HTTPException(status_code=400, detail="You cannot remove your own admin access.")
        try:
            removed = get_admin_store().revoke(target)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not removed:
            raise HTTPException(status_code=404, detail="Admin not found.")
        return {"ok": True}

    @app.get("/admin/orders")
    def admin_list_orders(
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        return _store.list_all_orders()

    @app.get("/admin/stats")
    def admin_stats(
        _store: Store = Depends(db),
        _: Identity = Depends(require_admin),
    ):
        from datetime import datetime, timezone

        orders = _store.list_all_orders()
        sellers = _store.list_sellers()
        products = _store.list_products()

        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        month_prefix = now.strftime("%Y-%m")

        orders_today = [o for o in orders if (o.get("created_at") or "").startswith(today)]
        orders_month = [o for o in orders if (o.get("created_at") or "").startswith(month_prefix)]
        shops_month = [s for s in sellers if (s.get("created_at") or "").startswith(month_prefix)]
        products_month = [p for p in products if (p.get("created_at") or "").startswith(month_prefix)]

        revenue_today = sum(int(o.get("total") or 0) for o in orders_today)
        revenue_month = sum(int(o.get("total") or 0) for o in orders_month)
        revenue_total = sum(int(o.get("total") or 0) for o in orders)

        return {
            "orders_today": len(orders_today),
            "orders_this_month": len(orders_month),
            "orders_total": len(orders),
            "revenue_today": revenue_today,
            "revenue_this_month": revenue_month,
            "revenue_total": revenue_total,
            "shops_this_month": len(shops_month),
            "shops_total": len(sellers),
            "products_this_month": len(products_month),
            "products_total": len(products),
        }

    @app.delete("/admin/users/{email}")
    def admin_delete_user(
        email: str,
        identity: Identity = Depends(require_admin),
        _store: Store = Depends(db),
    ):
        target = email.strip().lower()
        if target == identity.email.lower():
            raise HTTPException(status_code=400, detail="You cannot delete your own account.")
        seller = _store.get_seller_by_email(target)
        if seller:
            _store.delete_seller(seller["id"])
        try:
            get_admin_store().revoke(target)
        except ValueError:
            pass
        _delete_cognito_user(target)
        return {"ok": True}

    return app


app = create_app()
handler = Mangum(app)
