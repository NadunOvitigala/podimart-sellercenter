from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

import boto3

from app.config import settings
from app.store import now_iso

LOCK = threading.Lock()


def _env_admin_emails() -> set[str]:
    return {
        email.strip().lower()
        for email in settings.admin_emails.split(",")
        if email.strip()
    }


class AdminStore:
    def is_admin(self, email: str) -> bool:
        return email.strip().lower() in self.list_admin_emails()

    def list_admin_emails(self) -> set[str]:
        raise NotImplementedError

    def list_records(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    def grant(self, email: str, granted_by: str) -> dict[str, Any]:
        raise NotImplementedError

    def revoke(self, email: str) -> bool:
        raise NotImplementedError


class LocalAdminStore(AdminStore):
    def __init__(self, path: Path):
        self.path = path
        if not self.path.exists():
            self._write({"admins": []})

    def _read(self) -> dict[str, list[dict[str, Any]]]:
        with LOCK:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        data.setdefault("admins", [])
        return data

    def _write(self, data: dict[str, Any]) -> None:
        with LOCK:
            existing = {}
            if self.path.exists():
                existing = json.loads(self.path.read_text(encoding="utf-8"))
            existing.update(data)
            existing.setdefault("admins", [])
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self.path.write_text(json.dumps(existing, indent=2), encoding="utf-8")

    def _seed_env_admins(self, data: dict[str, list[dict[str, Any]]]) -> None:
        if data["admins"]:
            return
        changed = False
        for email in _env_admin_emails():
            data["admins"].append(
                {
                    "email": email,
                    "granted_at": now_iso(),
                    "granted_by": "env",
                }
            )
            changed = True
        if changed:
            self._write(data)

    def list_admin_emails(self) -> set[str]:
        data = self._read()
        self._seed_env_admins(data)
        data = self._read()
        return {(item.get("email") or "").lower() for item in data["admins"] if item.get("email")}

    def list_records(self) -> list[dict[str, Any]]:
        data = self._read()
        self._seed_env_admins(data)
        data = self._read()
        return sorted(
            data["admins"],
            key=lambda item: item.get("granted_at") or "",
            reverse=True,
        )

    def grant(self, email: str, granted_by: str) -> dict[str, Any]:
        email = email.strip().lower()
        data = self._read()
        for item in data["admins"]:
            if (item.get("email") or "").lower() == email:
                return item
        record = {"email": email, "granted_at": now_iso(), "granted_by": granted_by}
        data["admins"].append(record)
        self._write(data)
        return record

    def revoke(self, email: str) -> bool:
        email = email.strip().lower()
        data = self._read()
        before = len(data["admins"])
        data["admins"] = [
            item for item in data["admins"] if (item.get("email") or "").lower() != email
        ]
        if len(data["admins"]) == before:
            return False
        if not data["admins"] and _env_admin_emails():
            raise ValueError("Cannot remove the last admin.")
        self._write(data)
        return True


class DynamoAdminStore(AdminStore):
    def __init__(self) -> None:
        dynamo = boto3.resource("dynamodb", region_name=settings.aws_region)
        self.table = dynamo.Table(settings.table_admins)
        self._seeded = False

    def _seed_env_admins(self) -> None:
        if self._seeded:
            return
        items = self.table.scan(Limit=1).get("Items") or []
        if items:
            self._seeded = True
            return
        for email in _env_admin_emails():
            self.table.put_item(
                Item={"email": email, "granted_at": now_iso(), "granted_by": "env"}
            )
        self._seeded = True

    def list_admin_emails(self) -> set[str]:
        self._seed_env_admins()
        items = self.table.scan().get("Items") or []
        return {(item.get("email") or "").lower() for item in items if item.get("email")}

    def list_records(self) -> list[dict[str, Any]]:
        self._seed_env_admins()
        items = self.table.scan().get("Items") or []
        return sorted(items, key=lambda item: item.get("granted_at") or "", reverse=True)

    def grant(self, email: str, granted_by: str) -> dict[str, Any]:
        email = email.strip().lower()
        existing = self.table.get_item(Key={"email": email}).get("Item")
        if existing:
            return existing
        record = {"email": email, "granted_at": now_iso(), "granted_by": granted_by}
        self.table.put_item(Item=record)
        return record

    def revoke(self, email: str) -> bool:
        email = email.strip().lower()
        existing = self.table.get_item(Key={"email": email}).get("Item")
        if not existing:
            return False
        admins = self.list_admin_emails()
        if len(admins) <= 1:
            raise ValueError("Cannot remove the last admin.")
        self.table.delete_item(Key={"email": email})
        return True


def get_admin_store() -> AdminStore:
    if settings.storage.lower() == "dynamodb":
        return DynamoAdminStore()
    return LocalAdminStore(settings.data_dir / "db.json")
