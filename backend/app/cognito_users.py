from __future__ import annotations

from typing import Any

import boto3

from app.config import settings


def list_cognito_users() -> list[dict[str, Any]]:
    if settings.auth_mode.lower() != "cognito" or not settings.cognito_user_pool_id:
        return []
    client = boto3.client("cognito-idp", region_name=settings.aws_region)
    users: list[dict[str, Any]] = []
    token: str | None = None
    while True:
        params: dict[str, Any] = {
            "UserPoolId": settings.cognito_user_pool_id,
            "Limit": 60,
        }
        if token:
            params["PaginationToken"] = token
        res = client.list_users(**params)
        for item in res.get("Users") or []:
            attrs = {a["Name"]: a["Value"] for a in item.get("Attributes") or []}
            email = (attrs.get("email") or "").lower()
            if not email:
                continue
            users.append(
                {
                    "email": email,
                    "status": item.get("UserStatus") or "",
                    "created_at": item.get("UserCreateDate").isoformat()
                    if item.get("UserCreateDate")
                    else "",
                    "name": attrs.get("name") or "",
                    "sub": item.get("Username") or "",
                }
            )
        token = res.get("PaginationToken")
        if not token:
            break
    return sorted(users, key=lambda item: item.get("created_at") or "", reverse=True)
