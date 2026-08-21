"""Database access for the AI service.

Schema ownership stays with Drizzle in `lib/db`. This service reads and writes
the same PostgreSQL database but deliberately does not define or migrate the
schema: two sources of truth for table definitions is how staging and
production drift apart. Queries here are raw SQL against columns Drizzle owns,
so a schema change shows up as a loud query error rather than silent
divergence.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import asyncpg

from app.config import get_settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            settings.asyncpg_dsn,
            min_size=1,
            max_size=10,
            # Supabase fronts Postgres with the Supavisor pooler, which forcibly
            # closes any connection that issues a server-side prepared statement
            # (asyncpg's default for every parameterised query). The connection
            # handshake succeeds, then the first real query resets — the symptom
            # that pointed here. Disabling the cache makes asyncpg send queries
            # unprepared, which the pooler accepts; harmless against a direct
            # Postgres too, at the cost of no plan reuse. Do not raise it back
            # above 0 while the DSN points at a pooler host.
            statement_cache_size=0,
            # jsonb columns come back as str by default; decoding them at the
            # connection level keeps call sites free of json.loads noise.
            init=_register_codecs,
        )
    return _pool


async def _register_codecs(connection: asyncpg.Connection) -> None:
    await connection.set_type_codec(
        "jsonb",
        encoder=json.dumps,
        decoder=json.loads,
        schema="pg_catalog",
    )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised")
    return _pool


@asynccontextmanager
async def acquire() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as connection:
        yield connection


async def fetch(query: str, *args: Any) -> list[asyncpg.Record]:
    async with acquire() as connection:
        return await connection.fetch(query, *args)


async def fetchrow(query: str, *args: Any) -> asyncpg.Record | None:
    async with acquire() as connection:
        return await connection.fetchrow(query, *args)


async def execute(query: str, *args: Any) -> str:
    async with acquire() as connection:
        return await connection.execute(query, *args)
