# ArcGIS Flood-aware Routing Demo (FastAPI + React/Vite)

A minimal full-stack demo that:
- Renders an ArcGIS web map.
- Lets you pick Start (A) and End (B).
- Calls a Python FastAPI backend to compute a route using ArcGIS Route service.
- Avoids flooded segments via polyline barriers that you can toggle from the UI.

This is for demos/learning. Not production-hardened.

## Prerequisites
- Node.js 18+
- Python 3.11+
- An ArcGIS API key with access to basemaps and routing services
  - How to get a key (placeholder): https://developers.arcgis.com/documentation/security-and-authentication/api-keys/

## Setup
1) Copy env example and set your key

```
cp .env.example .env
# Edit .env and set ARCGIS_API_KEY=...
```

2) Install backend deps

```
cd backend
pip install -r requirements.txt
```

3) Install frontend deps

```
cd ../frontend
npm i
```

## Run (two terminals)
- Terminal 1 (backend):
```
cd backend
uvicorn app:app --reload --port 8000
```
- Terminal 2 (frontend):
```
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend:  http://localhost:8000 (docs at /docs)

Alternatively, from project root you can try:
```
make dev
```
This runs both servers concurrently. Stop with Ctrl+C.

## How it works
- Frontend uses ArcGIS Maps SDK for JavaScript (@arcgis/core) to render a 2D map.
- Click once to set A, again to set B. When both exist, the app calls `POST /api/route`.
- Backend sends A/B as stops to ArcGIS Route service and any flood polylines as `polylineBarriers`.
- Returned route, directions, distance, and duration are displayed.
- Click “Toggle Flooded Segment”, then click two points on the map to create a small flood line and POST to `/api/floods`. The next route will avoid it.

## API
- GET /api/health → { status: "ok" }
- GET /api/config → { arcgisApiKey } (exposed for demo so the frontend can render basemaps)
- POST /api/route → body: `{ origin:{x,y}, destination:{x,y}, flood_lines?: [ [[x,y],...], ...] }`
  - returns `{ route:{ paths:[[[x,y],...]] }, distanceKm, durationMin, directions:[text,...] }`
- GET /api/floods → list stored flood polylines
- POST /api/floods → add a polyline `{ coordinates: [[x,y], ...] }`
- DELETE /api/floods/{id} → remove polyline

OpenAPI docs at http://localhost:8000/docs

## Configuration
- `.env` at project root:
  - `ARCGIS_API_KEY` — required for live routing and basemaps (frontend reads via `/api/config`)
  - `BACKEND_PORT=8000`
  - `FRONTEND_PORT=5173`
  - `EXPOSE_API_KEY=true` (demo only; exposes key to frontend for basemaps)
  - `PERSIST_FLOODS=false` (if true, floods persist to `backend/floods.json`)

If `ARCGIS_API_KEY` is missing, the backend will respond to `/api/route` with a mocked straight-line route for development. A warning is logged in startup; change behavior in `router.py`.

## Tests
Run backend unit tests (mocks ArcGIS response):
```
cd backend
pytest -q
```

## Notes and Caveats
- API key is exposed via `/api/config` for demo convenience so the map loads basemaps. In production, use OAuth or secure your key differently.
- Barriers are sent as `polylineBarriers` FeatureSet with WGS84 (wkid: 4326).
- Directions formatting is minimal; extend as needed.
- You can swap the in-memory flood store with a DB or a FeatureLayer later.

## License
MIT
