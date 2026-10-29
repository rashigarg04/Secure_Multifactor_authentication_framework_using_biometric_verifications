import redis
from fastapi import APIRouter, HTTPException
from sqlalchemy import create_engine, text

from app.config import settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Liveness: the API process is running."""
    return {"status": "ok"}


@router.get("/health/ready")
def ready():
    """Readiness: the database and Redis both answer."""
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        redis.Redis.from_url(settings.redis_url).ping()
    except Exception:
        raise HTTPException(status_code=503, detail="dependency unavailable")
    return {"status": "ready"}