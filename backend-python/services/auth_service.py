from __future__ import annotations
import asyncio
import os
import time
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.db import User

_JWKS_CACHE_TTL_SECONDS = 3600
_jwks_cache: dict[str, tuple[float, jwt.PyJWKSet]] = {}
_jwks_lock = asyncio.Lock()

# AUTH_MODE defaults to "cognito" (secure) rather than "local" — a missing
# or misconfigured env var should fail toward requiring real auth, not
# silently open a bypass.
_LOCAL_DEV_TOKEN = "local-dev-token"
_LOCAL_DEV_COGNITO_SUB = "local-dev-user"
_LOCAL_DEV_EMAIL = "dev@localhost"


def _auth_mode() -> str:
    return os.environ.get("AUTH_MODE", "cognito").strip().lower()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _jwks_url(region: str, user_pool_id: str) -> str:
    return f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"


async def _fetch_jwks(region: str, user_pool_id: str) -> jwt.PyJWKSet:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(_jwks_url(region, user_pool_id))
        response.raise_for_status()
        return jwt.PyJWKSet.from_dict(response.json())


async def _get_jwks(region: str, user_pool_id: str, force_refresh: bool = False) -> jwt.PyJWKSet:
    cache_key = f"{region}:{user_pool_id}"
    now = time.monotonic()

    if not force_refresh:
        cached = _jwks_cache.get(cache_key)
        if cached and now - cached[0] < _JWKS_CACHE_TTL_SECONDS:
            return cached[1]

    async with _jwks_lock:
        # Another request may have already refreshed it while we waited.
        if not force_refresh:
            cached = _jwks_cache.get(cache_key)
            now = time.monotonic()
            if cached and now - cached[0] < _JWKS_CACHE_TTL_SECONDS:
                return cached[1]

        jwks = await _fetch_jwks(region, user_pool_id)
        _jwks_cache[cache_key] = (time.monotonic(), jwks)
        return jwks


async def _verify_cognito_token(token: str) -> dict[str, Any]:
    user_pool_id = os.environ["COGNITO_USER_POOL_ID"]
    app_client_id = os.environ["COGNITO_APP_CLIENT_ID"]
    region = os.environ["COGNITO_REGION"]
    issuer = f"https://cognito-idp.{region}.amazonaws.com/{user_pool_id}"

    try:
        kid = jwt.get_unverified_header(token).get("kid")
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Malformed token") from exc
    if not kid:
        raise _unauthorized("Token missing key ID")

    jwks = await _get_jwks(region, user_pool_id)
    try:
        signing_key = jwks[kid]
    except KeyError:
        # Cognito rotates its signing keys occasionally — refresh once
        # before concluding the key genuinely doesn't exist.
        jwks = await _get_jwks(region, user_pool_id, force_refresh=True)
        try:
            signing_key = jwks[kid]
        except KeyError as exc:
            raise _unauthorized("Unknown signing key") from exc

    try:
        claims = jwt.decode(
            token,
            key=signing_key.key,
            algorithms=[signing_key.algorithm_name],
            issuer=issuer,
            options={"require": ["exp", "sub", "token_use"]},
        )
    except jwt.InvalidTokenError as exc:
        raise _unauthorized(f"Invalid token: {exc}") from exc

    # Cognito-specific, not generic OIDC: access tokens carry a `client_id`
    # claim rather than the standard `aud` (that's on ID tokens instead),
    # and `token_use` is what distinguishes an access token from an ID
    # token — the two otherwise look like structurally valid JWTs from the
    # same pool. PyJWT has no built-in knowledge of either, so both are
    # checked explicitly here rather than via `jwt.decode(..., audience=...)`.
    if claims.get("token_use") != "access":
        raise _unauthorized("Not an access token")
    if claims.get("client_id") != app_client_id:
        raise _unauthorized("Token was not issued for this app client")

    return claims


async def _get_or_create_user(db: AsyncSession, cognito_sub: str, email: str) -> User:
    result = await db.execute(select(User).where(User.cognito_sub == cognito_sub))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(cognito_sub=cognito_sub, email=email)
        db.add(user)
        await db.flush()
    return user


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise _unauthorized("Missing bearer token")
    token = auth_header[len("Bearer "):].strip()
    if not token:
        raise _unauthorized("Missing bearer token")

    if _auth_mode() == "local":
        if token != _LOCAL_DEV_TOKEN:
            raise _unauthorized("Invalid local dev token")
        return await _get_or_create_user(db, _LOCAL_DEV_COGNITO_SUB, _LOCAL_DEV_EMAIL)

    claims = await _verify_cognito_token(token)
    sub = claims["sub"]
    email = claims.get("email") or f"{sub}@cognito.local"
    return await _get_or_create_user(db, sub, email)
