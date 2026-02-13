<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/README_EN.md -->

# MFA (My Flight Assistant)
> **Pilot-Centric Schedule Management & Real-time Briefing Automation Solution**

MFA is a mobile-optimized Progressive Web App (PWA) that automates tedious manual briefing workflows and delivers real-time weather, NOTAM, and flight tracking information based on your personal schedule — maximizing Situational Awareness for airline pilots.

---

## Key Features

### Schedule Management
- **Multi-format Support**: Upload iCal (.ics) and CSV roster files
- **Google Calendar Auto-sync**: Register an ICS URL for automatic synchronization
- **Time Conversion**: UTC/Local dual-time display based on airport timezone
- **Crew & Hotel Matching**: Auto-extraction of crew roster and layover hotel info

### Real-time Briefing
- **METAR/TAF**: Color-coded flight categories (VFR/MVFR/IFR/LIFR) for departure and arrival airports
- **NOTAM**: Keyword highlighting (RWY/TWY closures, etc.) with critical NOTAMs prioritized
- **SIGMET/AIRMET**: Automatic hazardous weather detection within 100NM of the great circle route + route map visualization
- **Airport Search**: Direct ICAO code lookup for any airport briefing

### Aircraft Tracking
- **Tail Number Tracking**: Real-time position via OpenSky Network
- **External Services**: Redirect to FlightAware / Flightradar24

### Push Notifications
- **Weather Alerts**: Push notification on significant weather changes at scheduled airports
- **Report Time Reminders**: Customizable pre-departure alerts (1h/2h/3h + user-defined)
- **PWA Service Worker**: Background push support

### Session Management
- **Concurrent Login Limit**: Maximum 2 devices per account
- **Inactivity Auto-logout**: Automatic sign-out after 30 minutes of inactivity
- **Device ID Tracking**: 5-minute heartbeat interval to maintain active sessions

### Utilities
- **Unit Converter**: Temperature, pressure, altitude, distance, speed, weight
- **Flight Notes**: Auto-linked to current leg with timestamp

---

## Tech Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| **Frontend** | Next.js 16 (React, Turbopack) | PWA, mobile-first, Tailwind CSS v4 |
| **Backend** | FastAPI (Python) | iCal/CSV parsing, weather API integration |
| **Database** | Supabase (PostgreSQL) | Auth, Row Level Security, real-time DB |
| **State** | Zustand | Client state management (auth, schedule, settings) |
| **Data API** | NOAA AWC API | METAR / TAF / NOTAM / SIGMET |
| **Flight Tracking** | OpenSky Network | Real-time aircraft position |
| **Push** | Web Push (VAPID) | pywebpush + Service Worker |
| **Mapping** | Leaflet | SIGMET/AIRMET route visualization |

---

## Project Structure

```
mfa/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── dependencies/auth.py # JWT + session authentication
│   │   ├── routers/             # schedule, briefing, flight, push, session
│   │   ├── services/            # DB, calendar sync, schedulers
│   │   └── parsers/             # ICS/CSV parsers
│   └── supabase/migrations/     # DB schema migrations
├── frontend/
│   ├── src/app/                 # Next.js pages (/, /briefing, /schedule, /settings, /login)
│   ├── src/components/          # UI components
│   ├── src/stores/              # Zustand stores (auth, schedule, settings)
│   ├── src/hooks/               # Custom hooks (useActivityTracker, useResolvedTheme)
│   └── src/lib/                 # API client, utilities
└── docs/
    └── worklog.md               # Development log
```

---

## Getting Started

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables
- `backend/.env` — Supabase credentials, VAPID keys, API keys
- `frontend/.env.local` — NEXT_PUBLIC_API_URL, Supabase anon key

---

## Roadmap
- Manual refresh for past-date briefings
- Merge-mode schedule upload (preserve existing data)
- Red/Night mode (cockpit night vision protection)
- Duty/Rest calculator (FAR Part 117)
- Payment integration (Stripe / Lemon Squeezy)

---

(c) 2026 MFA (My Flight Assistant) Project.
