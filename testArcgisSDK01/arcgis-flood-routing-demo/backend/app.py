import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import FloodLine, LonLat, RouteRequest, RouteResponse
from flood_store import FloodStore
from router import solve_route

# Load .env from project root so running from backend/ still finds it
_here = os.path.dirname(__file__)
_root = os.path.dirname(_here)
load_dotenv(os.path.join(_root, ".env"))
load_dotenv()  # also allow backend/.env if present

BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "5173"))
EXPOSE_API_KEY = os.getenv("EXPOSE_API_KEY", "true").lower() == "true"
PERSIST_FLOODS = os.getenv("PERSIST_FLOODS", "false").lower() == "true"
FALLBACK_TO_MOCK_ON_AUTH_ERROR = os.getenv("FALLBACK_TO_MOCK_ON_AUTH_ERROR", "true").lower() == "true"

ARCGIS_API_KEY = (os.getenv("ARCGIS_API_KEY") or "").strip()

app = FastAPI(title="ArcGIS Flood-aware Routing Demo")

# CORS for local Vite dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://localhost:{FRONTEND_PORT}",
        f"http://127.0.0.1:{FRONTEND_PORT}",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = FloodStore(persist=PERSIST_FLOODS, path=os.path.join(os.path.dirname(__file__), "floods.json"))


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def get_config():
    # For demo only: optionally expose API key
    return {
        "arcgisApiKey": ARCGIS_API_KEY if EXPOSE_API_KEY else None,
        "exposed": EXPOSE_API_KEY,
    }


@app.get("/api/floods", response_model=List[FloodLine])
def list_floods():
    return store.list()


class FloodCreate(BaseModel):
    coordinates: List[List[float]]


@app.post("/api/floods", response_model=FloodLine)
def add_flood(body: FloodCreate):
    return store.add(body.coordinates)


@app.delete("/api/floods/{fid}")
def delete_flood(fid: str):
    if not store.remove(fid):
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


@app.post("/api/route", response_model=RouteResponse)
def compute_route(body: RouteRequest):
    try:
        # If no API key provided, we still return a mocked straight line route
        route_geom, distance_km, duration_min, directions = solve_route(
            origin=body.origin,
            destination=body.destination,
            flood_lines=(body.flood_lines or []) + [fl.coordinates for fl in store.list()],
            api_key=ARCGIS_API_KEY,
        )
        return RouteResponse(
            route=route_geom,
            distanceKm=distance_km,
            durationMin=duration_min,
            directions=directions,
        )
    except Exception as e:
        msg = str(e)
        if FALLBACK_TO_MOCK_ON_AUTH_ERROR and ("Invalid Token" in msg or "498" in msg):
            # Return a mock straight line so the UI works while key issues are resolved
            route_geom, distance_km, duration_min, directions = solve_route(
                origin=body.origin,
                destination=body.destination,
                flood_lines=(body.flood_lines or []) + [fl.coordinates for fl in store.list()],
                api_key=None,
            )
            return RouteResponse(
                route=route_geom,
                distanceKm=distance_km,
                durationMin=duration_min,
                directions=directions,
            )
        # Surface cause (e.g., missing routing privilege) instead of 500
        raise HTTPException(status_code=502, detail=f"Routing failed: {e}")
