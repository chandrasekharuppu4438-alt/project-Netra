# NETRA — Citizen-Consented Intelligent Surveillance & Public Safety Platform

AI-powered crowd intelligence platform that protects people and the planet. Privacy-first. Consent-required. Multilingual (EN/HI/TE).

## Run & Operate

- **Frontend (Replit preview)**: `artifacts/netra: web` workflow — Vite dev server on port 18289
- **Backend (local dev)**: `cd backend && uvicorn main:app --reload --port 8000` — Python/FastAPI
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- Required env (frontend): `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`
- Required env (backend): `ANTHROPIC_API_KEY`, `MONGODB_URI`, `DATABASE_NAME`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React 18 + Vite + Tailwind CSS + Wouter + Recharts + Leaflet + i18next
- **Backend**: Python 3.11 + FastAPI + Motor (async MongoDB) + YOLOv8 + MediaPipe + Anthropic Claude
- **Database**: MongoDB Atlas (Motor async driver + Beanie ODM)
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- **Deployment**: Frontend → Netlify | Backend → Render

## Where things live

- `backend/` — Python FastAPI service (→ Render deployment)
  - `main.py` — app + all REST + WebSocket routes
  - `detection.py` — YOLOv8 + MediaPipe + synthetic frame generator
  - `analytics.py` — density forecast + AQI + CO₂
  - `chat.py` — Anthropic Claude AI chat handler
- `artifacts/netra/` — React Vite frontend (→ Netlify deployment)
  - `src/pages/` — Dashboard, LiveFeed, Incidents, ConsentPortal, Environment, SOS
  - `src/components/` — ChatWidget (floating AI), VoiceAlert (banner + speech)
  - `src/hooks/useWebSocket.ts` — auto-reconnecting WS hook
  - `src/config.ts` — VITE_ env var URLs (single source of truth)
  - `src/i18n/locales/` — en.json, hi.json, te.json
  - `public/sw.js` — PWA service worker with offline emergency contacts page
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/` — generated React Query hooks
- `README.md` — full deployment guide, architecture diagram, demo walkthrough

## Architecture decisions

- **Frontend in Replit, Backend on Render**: The Python/FastAPI backend with YOLOv8 and MediaPipe can't run in Replit's Node.js environment. Backend files are in `backend/` ready for Render deployment.
- **Wouter over React Router**: Wouter handles Replit's `BASE_URL` proxy prefix correctly; avoids path-stripping issues in the iframe preview.
- **Custom canvas heatmap**: `src/lib/leafletHeat.ts` implements a canvas-based Leaflet heat layer without npm plugins, avoiding Leaflet plugin version compatibility issues.
- **Synthetic frames in dev**: `detection.py` generates synthetic OpenCV frames when backend runs locally, simulating real camera activity without requiring actual RTSP feeds.
- **Contract-first API**: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas. Never hand-write types the codegen produces.

## Product

- Live AI camera feed with face anonymisation (YOLOv8 person detection + Gaussian blur)
- Real-time Leaflet heatmap + crowd density charts + 15-minute ML density forecast
- Incident management: paginated log, filters, acknowledge/assign/resolve/CSV export
- Citizen consent portal: DPDP Act 2023 compliant, Privacy Grade A+, instant revocation
- Emergency SOS: one-tap geolocation + 5-second voice note → authorities notified
- NETRA Assist: Claude-powered multilingual chatbot with persistent conversation history
- Environment monitor: real-time AQI by zone + CO₂ saved counter
- Voice alerts: Web Speech API speaks alerts in user's chosen language
- PWA with offline fallback page showing emergency contacts (Police 100, Ambulance 108, Fire 101, Women 1091)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **API 404s in Replit are expected**: The Node.js api-server doesn't implement NETRA routes. All NETRA API calls target the Python backend configured via `VITE_API_BASE_URL`.
- **WebSocket errors in Replit are expected**: WS tries `ws://localhost:8000` by default; the Python backend isn't running in Replit. Frontend reconnects every 3s gracefully.
- **Backend needs Python venv locally**: Use `python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
- **MongoDB Atlas Network Access**: Must add `0.0.0.0/0` to allow Render's dynamic IPs
- **Render free tier cold start**: ~30s on first request after 15-min sleep. Frontend auto-pings `/health` on load to pre-warm.
- **opencv-python-headless**: Use this variant (not `opencv-python`) on Render — no display server available

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `README.md` for full deployment walkthrough and judge demo script
