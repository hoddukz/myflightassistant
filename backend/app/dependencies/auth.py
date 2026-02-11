# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/dependencies/auth.py

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase import get_supabase

security = HTTPBearer()

SESSION_TIMEOUT_MINUTES = 30

# 세션 검사를 건너뛸 경로 (로그인 직후 호출되므로 세션 미존재 상태)
SESSION_EXEMPT_PATHS = {"/api/session/register"}


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Authorization Bearer 토큰을 검증하고 user 정보를 반환한다."""
    token = credentials.credentials
    db = get_supabase()

    try:
        user_response = db.auth.get_user(token)
        user = user_response.user
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    # 세션 검사 (exempt 경로 제외)
    if request.url.path not in SESSION_EXEMPT_PATHS:
        device_id = request.headers.get("X-Device-ID")
        if device_id:
            cutoff = (datetime.now(timezone.utc) - timedelta(minutes=SESSION_TIMEOUT_MINUTES)).isoformat()
            result = db.table("user_sessions") \
                .select("id") \
                .eq("user_id", user.id) \
                .eq("device_id", device_id) \
                .gte("last_activity", cutoff) \
                .execute()
            if not result.data:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="session_expired",
                )

    return {"id": user.id, "email": user.email}
