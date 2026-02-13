# Tag: temp (마이그레이션 완료 후 삭제 가능)
# Path: /Users/hodduk/Documents/git/mfa/backend/scripts/dump_prod_to_dev.py

"""프로덕션 Supabase → 개발 Supabase 데이터 복사 스크립트."""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# .env 로딩
load_dotenv(Path(__file__).parent.parent.parent / ".env")

# 프로덕션 DB (기존)
PROD_URL = "https://luqnrkqbzqbnjuhqekks.supabase.co"
PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cW5ya3FienFibmp1aHFla2tzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQyOTU0MCwiZXhwIjoyMDg2MDA1NTQwfQ.OcqH73unEOjVUPxZCoEb8EeOL1BGbWuarK0pXBic1Nc"

# 개발 DB (새로 생성)
DEV_URL = os.getenv("SUPABASE_URL")
DEV_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not DEV_URL or not DEV_KEY:
    print("ERROR: DEV DB 환경변수가 설정되지 않았습니다.")
    sys.exit(1)

prod = create_client(PROD_URL, PROD_KEY)
dev = create_client(DEV_URL, DEV_KEY)

# FK 순서대로 테이블 복사
TABLES = [
    "users",
    "pairings",
    "flight_legs",
    "day_summaries",
    "layovers",
    "crew_assignments",
    "airport_notes",
    "certifications",
    "calendar_sources",
    "notification_log",
]


def copy_table(table_name: str) -> int:
    """테이블 데이터를 prod에서 읽어 dev에 삽입한다."""
    result = prod.table(table_name).select("*").execute()
    rows = result.data or []

    if not rows:
        print(f"  {table_name}: 0 rows (skip)")
        return 0

    # 배치 삽입 (충돌 시 무시)
    batch_size = 100
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            dev.table(table_name).upsert(batch).execute()
            total += len(batch)
        except Exception as e:
            print(f"  {table_name} batch {i} error: {e}")

    print(f"  {table_name}: {total} rows copied")
    return total


def main():
    print(f"PROD: {PROD_URL}")
    print(f"DEV:  {DEV_URL}")
    print("=" * 50)

    total_rows = 0
    for table in TABLES:
        total_rows += copy_table(table)

    print("=" * 50)
    print(f"Done! Total {total_rows} rows copied.")


if __name__ == "__main__":
    main()
