# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/api/index.py

import sys
from pathlib import Path

# backend/ 디렉토리를 Python 경로에 추가하여 기존 코드 재사용
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.main import app  # noqa: E402
