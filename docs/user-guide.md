<!-- Tag: docs -->
<!-- Path: /Users/hodduk/Documents/git/mfa/docs/user-guide.md -->

# MyFlightAssistant (MFA) — User Guide

> Pre-flight briefing, duty tracking, and schedule management for regional airline pilots.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Briefing](#3-briefing)
4. [Crew & Hotel](#4-crew--hotel)
5. [Schedule](#5-schedule)
6. [Duty (FAR 117)](#6-duty-far-117)
7. [Settings](#7-settings)
8. [Tips & FAQ](#8-tips--faq)

---

## 1. Getting Started

### Account

- Open the app and sign up with your email address.
- After signing in, you'll see the Dashboard.
- Sessions are limited to 2 devices at a time. If you log in on a 3rd device, the oldest session is automatically signed out.
- Sessions expire after 30 minutes of inactivity.

### Uploading Your Schedule

1. Go to **Settings** (bottom nav gear icon).
2. Tap **Roster Upload / Sync**.
3. **Option A — File Upload:** Drag & drop (or browse) your `.ics` or `.csv` roster file.
4. **Option B — Calendar Sync:** Paste your Google Calendar private iCal URL, then tap **Save**. Use **Sync Now** to pull the latest schedule at any time.

Once your schedule is loaded, all pages will populate with your trips, flights, and duty information.

---

## 2. Dashboard

The home page — everything you need at a glance.

### Monthly Stats

Three cards at the top showing your current month totals:

| Card | What it shows |
|------|---------------|
| **Trips** | Completed / Total trips this month |
| **Flights** | Completed / Total flights this month |
| **Off Days** | Off days used / Total this month |

### Block Hours

A progress bar showing completed block hours vs. total scheduled for the month.

### FAR 117 FDP

A compact card showing your current Flight Duty Period status:
- **On duty:** Progress bar with hours used / limit, remaining time.
- **Off duty:** Max FDP for next duty, next duty date.
- Tap to go to the full **Duty** page.

### Inbound Aircraft

Tracks the aircraft assigned to your next flight in real-time:
- **Flight phase:** Gate departure, takeoff, climb, cruise, descent, approach, landed — with icon and label.
- **Progress bar:** Distance flown / total distance.
- **ETA countdown** to your station.
- **Delay info** if applicable.
- Tap the callsign to open FlightAware live tracking.

> This section only appears when an inbound flight is detectable.

### Current Trip Timeline

A visual bar showing your trip progress:
- Airport sequence (e.g., DTW → ORD → MSP).
- Current day indicator (Day 1/3).
- Completed vs. remaining legs.

### Next Flight

Your upcoming flight at a glance:
- Flight number, route, aircraft type.
- Report time and departure time (local).
- Countdown timer (days, hours, minutes).
- Tap to jump to the **Briefing** page for that flight.

### Layover Info

If you're on a layover:
- Hotel name (tap to open in Google Maps).
- Phone number (tap to call).
- Layover duration and release time.

### Upcoming Events

The next trip or event after your current one — pairing ID, dates, block/credit hours.

### Today's Flights

A list of all your flights today with times, routes, aircraft, and deadhead indicators. Completed flights appear faded.

---

## 3. Briefing

Comprehensive pre-flight weather and NOTAM briefing.

### Navigation

- **Trip selector:** Left/right arrows to switch between trips. Shows pairing ID and date range.
- **Tab bar:** Overview tab + Day tabs (Day 1, Day 2, ...).
- Past days appear dimmed for easy identification.

### Overview Tab

A trip-wide summary with 5 sections:

| Section | Content |
|---------|---------|
| **Trip Summary** | Pairing ID, days, legs, block/credit/TAFB, layover cities |
| **Today** | Report/release time, today's route, hotel info (only shown on a duty day) |
| **FDP Status** | Compact FDP display — progress bar (on duty) or max FDP text (off duty), plus any FAR 117 warnings |
| **Fatigue Risk** | Day-by-day duty hour bar chart + risk flags (short rest, consecutive long duty, early report after late release, 4+ consecutive days). Risk level: Low / Moderate / High |
| **Weather Alerts** | Worst flight category per airport for the first 2 days (VFR/MVFR/IFR/LIFR badges). Day 3+ shows "Not yet available" (beyond TAF range) |

### Day Tabs

Each day shows leg-by-leg briefing:

- **Leg header:** Flight number, route, aircraft type, deadhead indicator.
- **Times:** Local and UTC departure/arrival, block time.
- **Airport cards** for departure and arrival (tap to expand):

#### Airport Briefing Card

The card header always shows:
- Airport code, flight category badge (VFR/MVFR/IFR/LIFR).
- Quick stats: Temperature, Wind, Visibility, Ceiling.
- Collapsed indicators: SIG, AIR, critical NOTAM count, weather phenomena.

Tap to expand and see 4 detail tabs:

| Tab | Content |
|-----|---------|
| **METAR** | Raw METAR (highlighted), decoded wind/vis/ceiling/weather/clouds, AWC source link |
| **TAF** | Raw TAF, forecast periods with time ranges and categories. Your arrival period is highlighted with an "ETA" badge |
| **NOTAM** | All NOTAMs with critical ones flagged in red. Keywords (RWY, ILS, CLSD, etc.) highlighted |
| **SIGMET** | Active SIGMETs/AIRMETs on your route with a mini map showing affected areas, altitude ranges, and severity |

### Airport Search

Tap the magnifying glass (top right) to manually look up any airport by ICAO code (3-4 characters).

---

## 4. Crew & Hotel

View crew composition and layover hotel details for each trip.

### Layout

- Organized by trip, then by day.
- Past trips/days show a "DONE" badge.
- Tap a day card to expand.

### Expanded Day

- **Crew list:** Name, employee ID, position badge (CA / FO / FA / FF), sorted by seniority.
- **Hotel info:** Hotel name (tap for Google Maps), phone (tap to call), layover duration, release time.

---

## 5. Schedule

Calendar and timeline view of all your events.

### Calendar

- Monthly grid with today highlighted in blue.
- Blue dot = trip/pairing day, Green dot = off day.
- Tap a date to scroll the timeline to that event.

### Timeline

- Vertical list of all events with type badges (PAIRING, MOV, TRAINING, VAC, etc.).
- Tap **expand** to see full day-by-day details:
  - Report time, each leg (flight number, route, times, crew, tail number).
  - Layover info (hotel, phone, duration).
  - Day totals (block, credit, duty).
  - Trip totals (TAFB, total block, total credit).
- Tap a tail number to open FlightAware.

---

## 6. Duty (FAR 117)

FAR 117 duty time monitoring and pickup decision tool.

### FDP Status

- **On duty:** Current FDP hours with progress bar and remaining time.
- **Off duty:** Max FDP for your next duty period.

### Cumulative Limits

| Metric | Limit |
|--------|-------|
| Flight time — last 28 days | 100 hours |
| Flight time — last 365 days | 1,000 hours |
| 56h rest in 168h window | Must be met |

Each shown as a color-coded progress bar (green → amber → red).

### FAR 117 Table B

Collapsible reference table showing FDP limits by report time and number of legs. Your current row/column is highlighted.

### Pickup Simulator

Evaluate whether you can pick up an open-time trip:

1. **Set parameters:** Report time, number of legs, estimated block time. Use presets or steppers.
2. **See results:**
   - Estimated FDP vs. limit (with status badge).
   - Estimated release time and max release time.
   - 28-day flight time check.
   - Rest gap check (10h minimum).
   - **Overall verdict:** "Pickup OK" or "Cannot Pick Up" with warnings.
3. **Post-release info:** Minimum rest required and earliest next report time.

---

## 7. Settings

### Account
- View your email, sign out.

### Schedule Management
- Upload roster (.ics / .csv) or set up Google Calendar sync.
- View event count, clear schedule.

### Utilities

**Unit Converter** — Quick aviation unit conversions:
- Temperature (C / F)
- Pressure (inHg / hPa)
- Altitude (ft / m)
- Distance (nm / km / sm)
- Speed (kt / km/h / mph)
- Weight (lbs / kg)

**Notes** — Jot down quick notes. Auto-associated with your current flight leg.

### Notifications

- **Push notifications:** Enable/disable.
- **Weather alerts:** Toggle for significant weather changes at your airports.
- **Pre-departure reminders:** Set 1-5 reminders before report time (1h, 2h, 3h presets or custom).
- **Test notification** button to verify setup.

### Appearance
- Theme: Light / Auto / Dark.

---

## 8. Tips & FAQ

### How often does weather data update?
METAR/TAF data is fetched from NOAA Aviation Weather Center. It refreshes each time you open a briefing card or switch Day tabs.

### What does the flight category mean?

| Category | Ceiling | Visibility |
|----------|---------|------------|
| **VFR** | > 3,000 ft | > 5 SM |
| **MVFR** | 1,000–3,000 ft | 3–5 SM |
| **IFR** | 500–1,000 ft | 1–3 SM |
| **LIFR** | < 500 ft | < 1 SM |

### Can I use this without uploading a schedule?
Yes. You can manually search any airport in the Briefing page, use the unit converter, and use the FAR 117 Table B reference. However, most features (Dashboard, Crew, Schedule, FDP tracking, Pickup Simulator) require an uploaded schedule.

### How does the Fatigue Risk assessment work?
It analyzes your trip's duty pattern for known risk factors:
- **Short rest** — layover under 11 hours.
- **Consecutive long duty** — 9+ hour duty for 2 days in a row.
- **Early/late transition** — early report (before 06:00) after late release (after 20:00).
- **4+ consecutive duty days.**

Risk level: **Low** (0 flags), **Moderate** (1-2 flags), **High** (3+ flags). This is a reference tool and does not replace official fatigue risk management.

### Is this app an official dispatch tool?
**No.** MFA is a personal reference tool for pilot situational awareness. It does not replace official airline dispatch, flight planning, or regulatory calculations. Always verify information through official sources.

---

*MyFlightAssistant — Built for pilots, by a pilot.*
