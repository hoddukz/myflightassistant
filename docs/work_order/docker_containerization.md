<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/work_order/docker_containerization.md -->

# MFA Docker 컨테이너화 + 파일 정리 + Git Push

## Context
MFA를 Synology NAS (DS218+, Intel)에 배포하기 위해 Docker 컨테이너화가 필요. 현재 Backend Dockerfile만 존재하고 Frontend Dockerfile이 없으며, docker-compose.yml은 dev 모드. CORS도 localhost 하드코딩 상태.

## 작업 목록

### 1. Frontend Dockerfile 생성
- **파일**: `frontend/Dockerfile`
- Multi-stage build: node:18-alpine → deps → build → runner
- `next.config.ts`에 `output: "standalone"` 추가
- standalone 모드로 경량 프로덕션 이미지 생성

### 2. Backend requirements.txt에 python-dotenv 추가
- **파일**: `backend/requirements.txt`
- `python-dotenv` 추가 (main.py에서 이미 사용 중이지만 requirements에 없음)

### 3. CORS 환경변수화
- **파일**: `backend/app/main.py`
- `CORS_ORIGINS` 환경변수로 변경, 기본값 `http://localhost:3000`

### 4. docker-compose.yml 프로덕션용 업데이트
- **파일**: `docker-compose.yml`
- dev용 volume mount, --reload 제거
- backend에 `CORS_ORIGINS` 환경변수 추가
- frontend에 `NEXT_PUBLIC_API_URL` 환경변수 추가
- restart: unless-stopped 추가

### 5. .env.example 생성 (루트)
- **파일**: `.env.example`
- 배포 시 필요한 환경변수 템플릿

### 6. .dockerignore 생성
- **파일**: `frontend/.dockerignore`
- **파일**: `backend/.dockerignore`
- node_modules, .next, .git, __pycache__ 등 제외

### 7. 파일 정리
- `schedule_samples/` 폴더: 테스트용 파일들 → .gitignore에 추가
- `WORKLOG.md`: 최신 내용 업데이트

### 8. Git Push
- 모든 변경사항 커밋 및 푸시
