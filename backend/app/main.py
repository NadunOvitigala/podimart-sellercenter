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
from app.catalog import CATEGORIES, CITIES
from app.config import settings
from app.schemas import BootstrapIn, LoginIn, ProductIn, ProfileIn, SignupIn, public_product, public_seller
from app.seed import unique_slug
from app.store import Store, get_store, new_id, now_iso

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}


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
            raise HTTPException(status_code=400, detail="Please pick a city from the list.")
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
            raise HTTPException(status_code=400, detail="Please pick a city from the list.")
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
            raise HTTPException(status_code=400, detail="Please pick a city from the list.")
        if "name" in updates and updates["name"]:
            updates["name"] = updates["name"].strip()
        seller.update({k: v for k, v in updates.items() if v is not None})
        _store.put_seller(seller)
        return public_seller(seller)

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

    @app.post("/products")
    def create_product(
        body: ProductIn,
        identity: Identity = Depends(get_identity),
        _store: Store = Depends(db),
    ):
        seller = _require_seller(_store, identity)
        if body.category not in {c["id"] for c in CATEGORIES}:
            raise HTTPException(status_code=400, detail="Unknown category.")
        product = {
            "id": new_id(),
            "seller_id": seller["id"],
            "seller_slug": seller["slug"],
            "seller_name": seller["name"],
            "city": seller["city"],
            "category": body.category,
            "name": body.name.strip(),
            "description": body.description.strip(),
            "price": body.price,
            "lead_time": body.lead_time.strip(),
            "image_url": body.image_url.strip(),
            "created_at": now_iso(),
        }
        return _store.put_product(product)

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
        product.update(
            {
                "name": body.name.strip(),
                "category": body.category,
                "price": body.price,
                "description": body.description.strip(),
                "lead_time": body.lead_time.strip(),
                "image_url": body.image_url.strip() or product.get("image_url", ""),
                "seller_name": seller["name"],
                "city": seller["city"],
            }
        )
        return _store.put_product(product)

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
