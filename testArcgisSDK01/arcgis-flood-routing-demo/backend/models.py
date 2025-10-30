from typing import List, Optional
from pydantic import BaseModel, Field


class LonLat(BaseModel):
    """WGS84 lon/lat point."""
    x: float = Field(..., description="Longitude in WGS84")
    y: float = Field(..., description="Latitude in WGS84")


class RouteRequest(BaseModel):
    origin: LonLat
    destination: LonLat
    flood_lines: Optional[List[List[List[float]]]] = Field(
        default=None,
        description="Optional array of polylines (each is [[x,y], [x,y], ...]) in WGS84",
    )


class FloodLine(BaseModel):
    id: str
    coordinates: List[List[float]]


class RouteResponse(BaseModel):
    route: dict
    distanceKm: float
    durationMin: float
    directions: List[str]
