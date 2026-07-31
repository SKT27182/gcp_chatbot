"""Authenticated user extracted from a verified Firebase ID token."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class AuthUser:
    uid: str
    email: str | None = None
    name: str | None = None
    email_verified: bool = True

