# NETRA — Citizen-Consented Intelligent Surveillance & Public Safety Platform

> AI-powered crowd intelligence that protects people and the planet. Privacy-first. Consent-required. Multilingual.

```
┌─────────────────────────────────────────────────────────────────┐
│                     NETRA Architecture                          │
│                                                                 │
│  ┌──────────────┐    HTTPS/WSS     ┌──────────────────────┐    │
│  │   Citizens   │◄────────────────►│   Netlify (React)    │    │
│  │   Browser    │                  │   PWA Frontend       │    │
│  └──────────────┘                  └──────────┬───────────┘    │
│                                               │                 │
│                                        REST + WebSocket         │
│                                               │                 │
│                                    ┌──────────▼───────────┐    │
│                                    │  Render (FastAPI)    │    │
│  ┌──────────────┐                  │  Python 3.11         │    │
│  │  Anthropic   │◄────────────────►│  YOLOv8 + MediaPipe  │    │
│  │  Claude API  │                  │  Synthetic Frames    │    │
│  └──────────────┘                  └──────────┬───────────┘    │
│                                               │                 │
│  ┌──────────────┐                  ┌──────────▼───────────┐    │
│  │  MongoDB     │◄────────────────►│  Motor + Beanie ODM  │    │
│  │  Atlas M0    │                  │  Async DB Layer      │    │
│  └──────────────┘                  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Live AI Camera Feed** — YOLOv8 person detection + MediaPipe pose threat analysis, all faces Gaussian-blurred for privacy
- **Real-time Dashboard** — WebSocket-driven heatmap, crowd density charts, 15-minute ML forecast
- **Incident Management** — Paginated log with filters, zone/severity/type, one-click acknowledge/assign/resolve, CSV export
- **Citizen Consent Portal** — DPDP Act 2023 compliant, Privacy Grade A+, instant revocation
- **Emergency SOS** — One-tap geolocation + 5s voice note capture → authorities notified
- **NETRA Assist AI** — Claude-powered multilingual chatbot (EN/HI/TE) with persistent conversation
- **Environment Monitor** — Real-time AQI by zone, CO₂ saved counter, traffic reroute impact
- **Voice Alerts** — Web Speech API speaks alerts aloud in user's language
- **PWA** — Offline fallback with emergency contacts (Police 100, Ambulance 108, Fire 101, Women 1091)

---

## Deployment Setup

### 1. MongoDB Atlas

```bash
1. Sign up at mongodb.com/atlas
2. Create free M0 cluster (shared, free tier)
3. Database Access → Add user: readWrite on netra database
4. Network Access → Add IP: 0.0.0.0/0 (allow all — needed for Render)
5. Connect → Drivers → copy connection string
   Format: mongodb+srv://<user>:<pass>@cluster.mongodb.net/netra
```

### 2. Render (Backend)

```bash
1. Push the backend/ folder to a GitHub repository
2. render.com → New → Web Service → connect repo
3. Settings:
   - Runtime: Python 3
   - Build Command: pip install -r requirements.txt
   - Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
4. Environment Variables (Render Dashboard → Environment):
   ANTHROPIC_API_KEY = your_key_from_console.anthropic.com
   MONGODB_URI       = mongodb+srv://user:pass@cluster.mongodb.net/netra
   DATABASE_NAME     = netra
   ENVIRONMENT       = production
5. Deploy (first build ~5 min — downloads yolov8n.pt ~6MB)
6. Copy your Render URL: https://netra-backend-xxxx.onrender.com
```

**Render Free Tier Notes:**
- Service sleeps after 15 min inactivity → wakes on first request (~30s)
- Frontend calls GET /health on load to pre-wake the backend
- 512MB RAM: YOLOv8n fits comfortably
- WebSocket is supported without extra configuration
- Use `opencv-python-headless` (no display server on Render) ✓ already in requirements.txt

### 3. Netlify (Frontend)

```bash
1. Push the frontend (artifacts/netra/) to a GitHub repository
2. netlify.com → Add new site → Import from Git
3. Build settings:
   - Build command: npm run build
   - Publish directory: dist
4. Environment Variables (Netlify → Site settings → Environment):
   VITE_API_BASE_URL = https://netra-backend-xxxx.onrender.com
   VITE_WS_BASE_URL  = wss://netra-backend-xxxx.onrender.com
5. Deploy site
```

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd artifacts/netra
cp .env.example .env.local
# Edit .env.local:
#   VITE_API_BASE_URL=http://localhost:8000
#   VITE_WS_BASE_URL=ws://localhost:8000
pnpm dev
```

---

## Demo Walkthrough (Judges)

| Step | Action | What to See |
|------|--------|-------------|
| 1 | Open Netlify URL | Backend wakes up (health ping auto-sent) |
| 2 | Consent Portal | Register citizen → Privacy Grade A+ |
| 3 | Live Feed | Face-blurred frames + threat score ring overlay |
| 4 | Dashboard | Density rises on Leaflet heatmap, zone pins change color |
| 5 | Voice Alert | "Alert: Crowding detected at Zone 2…" spoken aloud |
| 6 | Incidents | Assign alert to Police → Resolve it |
| 7 | NETRA Assist | Type in Hindi → Get Hindi reply instantly |
| 8 | SOS | One-tap geolocation + countdown voice recording |
| 9 | Environment | CO₂ counter ticking live, AQI by zone |
| 10 | Forecast | "We predicted this spike 15 minutes ago" |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Routing | Wouter (lightweight React router) |
| Charts | Recharts |
| Maps | Leaflet.js with custom canvas heatmap |
| i18n | i18next (EN / HI / TE) |
| Voice | Web Speech API |
| PWA | Service Worker + Web App Manifest |
| API Client | Axios + TanStack React Query |
| Backend | Python 3.11 + FastAPI + Uvicorn |
| AI Vision | YOLOv8n (ultralytics) + MediaPipe Pose |
| Privacy | OpenCV Gaussian face blur |
| Database | MongoDB Atlas + Motor (async) + Beanie ODM |
| AI Chat | Anthropic Claude claude-sonnet-4-5 |
| Deploy FE | Netlify |
| Deploy BE | Render Web Service |

---

## Project Structure

```
netra/
├── backend/                    # Python FastAPI service (→ Render)
│   ├── main.py                 # FastAPI app + WebSocket + REST routes
│   ├── database.py             # Motor async MongoDB client
│   ├── models.py               # Beanie ODM document models
│   ├── detection.py            # YOLOv8 + MediaPipe + synthetic frames
│   ├── alert.py                # Alert evaluation + dispatch
│   ├── chat.py                 # Claude AI chat handler
│   ├── analytics.py            # Forecast + CO2 + AQI
│   ├── requirements.txt
│   ├── render.yaml
│   └── .env.example
│
└── artifacts/netra/            # React Vite frontend (→ Netlify)
    ├── src/
    │   ├── config.ts           # VITE_ env var URLs (single source of truth)
    │   ├── App.tsx             # Router + Sidebar layout
    │   ├── hooks/
    │   │   └── useWebSocket.ts # Auto-reconnecting WS hook
    │   ├── pages/
    │   │   ├── Dashboard.tsx   # Stats + heatmap + forecast
    │   │   ├── LiveFeed.tsx    # Camera feed + overlays
    │   │   ├── Incidents.tsx   # Filterable table + actions
    │   │   ├── ConsentPortal.tsx
    │   │   ├── Environment.tsx
    │   │   └── SOS.tsx
    │   ├── components/
    │   │   ├── ChatWidget.tsx  # Floating AI assistant
    │   │   └── VoiceAlert.tsx  # Banner + speech synthesis
    │   └── i18n/locales/       # en.json | hi.json | te.json
    ├── public/
    │   ├── manifest.json       # PWA manifest
    │   └── sw.js               # Service worker + offline page
    └── netlify.toml
```

---

## Privacy & Compliance

- **Face Anonymisation**: Gaussian blur (51×51) applied to every detected face region before any storage or transmission
- **Consent Required**: Citizens must explicitly register; all monitoring is opt-in
- **Data Minimisation**: Only zone-level aggregate patterns stored; no individual tracking
- **Right to Revoke**: Instant deletion on consent withdrawal
- **Audit Logged**: All access and alerts are logged
- **DPDP Act 2023**: Designed for compliance with India's Digital Personal Data Protection Act
- **30-Day Rolling Window**: All incident data auto-expires

---

## Environment Variables Reference

### Backend (Render)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `MONGODB_URI` | Atlas connection string |
| `DATABASE_NAME` | Database name (default: netra) |
| `ENVIRONMENT` | production / development |

### Frontend (Netlify)
| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Render service URL (https://...) |
| `VITE_WS_BASE_URL` | Render WebSocket URL (wss://...) |
