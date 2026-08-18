from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import settings

bearer = HTTPBearer(auto_error=False)


@dataclass
class Identity:
    sub: str
    email: str


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
    )
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 120_000
    )
    return secrets.compare_digest(check.hex(), digest)


def create_local_token(sub: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "token_use": "id",
        "aud": "local",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.jwt_expire_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


@lru_cache
def _jwks_client() -> PyJWKClient:
    pool_id = settings.cognito_user_pool_id
    if not pool_id:
        raise HTTPException(status_code=500, detail="Cognito is not configured.")
    url = (
        f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
        f"{pool_id}/.well-known/jwks.json"
    )
    return PyJWKClient(url)


def _decode_cognito(token: str) -> Identity:
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            issuer=(
                f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
                f"{settings.cognito_user_pool_id}"
            ),
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Please log in again.") from exc
    sub = payload.get("sub")
    email = (payload.get("email") or "").lower()
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return Identity(sub=str(sub), email=email)


def _decode_local(token: str) -> Identity:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Please log in again.") from exc
    sub = payload.get("sub")
    email = (payload.get("email") or "").lower()
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return Identity(sub=str(sub), email=email)


def decode_identity(token: str) -> Identity:
    if settings.auth_mode.lower() == "cognito":
        return _decode_cognito(token)
    return _decode_local(token)


def get_identity(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Identity:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Please log in.")
    return decode_identity(creds.credentials)
