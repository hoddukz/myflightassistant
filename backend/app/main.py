# Tag: core
# Path: /Users/hodduk/Documents/git/mfa/backend/app/main.py

import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 프로젝트 루트의 .env 로딩
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from app.routers import schedule, briefing, flight, push, session
from app.services.reminder_scheduler import start_scheduler, stop_scheduler
from app.services.weather_alert_scheduler import start_weather_scheduler, stop_weather_scheduler

app = FastAPI(
    title="MFA API",
    description="My Flight Assistant - Backend API",
    version="0.1.0",
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(briefing.router, prefix="/api/briefing", tags=["briefing"])
app.include_router(flight.router, prefix="/api/flight", tags=["flight"])
app.include_router(push.router, prefix="/api/push", tags=["push"])
app.include_router(session.router, prefix="/api/session", tags=["session"])


@app.on_event("startup")
async def on_startup():
    start_scheduler()
    start_weather_scheduler()


@app.on_event("shutdown")
async def on_shutdown():
    stop_scheduler()
    stop_weather_scheduler()


@app.get("/health")
async def health_check():
    return {"status": "ok"}
