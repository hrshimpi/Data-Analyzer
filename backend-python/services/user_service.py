from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.db import User

# TODO(auth): there's no authentication yet (Cognito integration is future
# work) — every upload is attributed to a single fixed local/dev user until
# real auth exists. Replace this with the actual authenticated user once
# that lands; nothing downstream should need to change since callers only
# ever deal with a User row's `.id`.
_DEFAULT_COGNITO_SUB = "local-dev-user"
_DEFAULT_EMAIL = "dev@localhost"


async def get_or_create_default_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.cognito_sub == _DEFAULT_COGNITO_SUB))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(cognito_sub=_DEFAULT_COGNITO_SUB, email=_DEFAULT_EMAIL)
        db.add(user)
        await db.flush()
    return user
