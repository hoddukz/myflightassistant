# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/db/supabase.py

import threading
from typing import Optional

from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_main_client: Optional[Client] = None
_thread_local = threading.local()


def get_supabase() -> Client:
    """메인 스레드와 워커 스레드에서 각각 독립된 Supabase 클라이언트를 반환한다."""
    if threading.current_thread() is threading.main_thread():
        global _main_client
        if _main_client is None:
            _main_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        return _main_client
    else:
        client = getattr(_thread_local, "client", None)
        if client is None:
            client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            _thread_local.client = client
        return client
