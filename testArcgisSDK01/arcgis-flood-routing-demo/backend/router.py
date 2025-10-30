import json
import math
import os
from typing import Dict, List, Optional, Tuple

import requests

from models import LonLat

ARCGIS_ROUTE_URL = (
    "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World/solve"
)


def _stops_featureset(origin: LonLat, destination: LonLat) -> Dict:
    return {
        "geometryType": "esriGeometryPoint",
        "spatialReference": {"wkid": 4326},
        "features": [
            {
                "geometry": {
                    "x": origin.x,
                    "y": origin.y,
                    "spatialReference": {"wkid": 4326},
                },
                "attributes": {"Name": "A"},
            },
            {
                "geometry": {
                    "x": destination.x,
                    "y": destination.y,
                    "spatialReference": {"wkid": 4326},
                },
                "attributes": {"Name": "B"},
            },
        ],
    }


def _barriers_featureset(polylines: List[List[List[float]]]) -> Optional[Dict]:
    if not polylines:
        return None
    features = []
    for line in polylines:
        if not line or len(line) < 2:
            continue
        features.append(
            {
                "geometry": {
                    "paths": [line],
                    "spatialReference": {"wkid": 4326},
                },
                "attributes": {},
            }
        )
    if not features:
        return None
    return {
        "geometryType": "esriGeometryPolyline",
        "spatialReference": {"wkid": 4326},
        "features": features,
    }


def _haversine_km(a: LonLat, b: LonLat) -> float:
    R = 6371.0
    lat1 = math.radians(a.y)
    lon1 = math.radians(a.x)
    lat2 = math.radians(b.y)
    lon2 = math.radians(b.x)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def solve_route(
    origin: LonLat,
    destination: LonLat,
    flood_lines: Optional[List[List[List[float]]]] = None,
    api_key: Optional[str] = None,
) -> Tuple[Dict, float, float, List[str]]:
    """
    Calls ArcGIS Route service with stops and optional polylineBarriers.

    Returns: (route_geometry, distanceKm, durationMin, directions)
    route_geometry is geojson-like { paths: [[[x,y],...]] }
    """
    if not api_key:
        # Mock straight line for dev if key missing
        distance_km = _haversine_km(origin, destination)
        duration_min = (distance_km / 50.0) * 60.0  # assume 50 km/h
        return ({"paths": [[[origin.x, origin.y], [destination.x, destination.y]]]}, distance_km, duration_min, [
            "Mocked direct path (no API key)"])

    params = {
        "f": "json",
        "returnRoutes": "true",
        "returnDirections": "true",
        "outSR": 4326,
        # travelMode can be set to a named mode or a JSON, keep default driving time
    }

    # Per ArcGIS docs, API key should be passed as a header for platform routing service
    headers = {
        "Authorization": f"Bearer {api_key}",  # ArcGIS Platform API key
        "Content-Type": "application/x-www-form-urlencoded",
    }

    stops_fs = _stops_featureset(origin, destination)
    params["stops"] = json.dumps(stops_fs)

    barriers_fs = _barriers_featureset(flood_lines or [])
    if barriers_fs:
        params["polylineBarriers"] = json.dumps(barriers_fs)

    resp = requests.post(ARCGIS_ROUTE_URL, data=params, headers=headers, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    # Expected structure has routes and directions; handle errors
    if "error" in data:
        raise RuntimeError(str(data["error"]))

    routes = data.get("routes", {}).get("features", [])
    if not routes:
        raise RuntimeError("No route returned from ArcGIS")

    route_geom = routes[0].get("geometry", {})  # { paths: [...] } in outSR

    # Sum total length and duration from directions if present; fallback to attributes
    directions_feats = data.get("directions", {}).get("features", [])
    directions_text: List[str] = []
    total_length_km = 0.0
    total_time_min = 0.0

    for feat in directions_feats:
        attrs = feat.get("attributes", {})
        text = attrs.get("text")
        if text:
            directions_text.append(text)
        length = attrs.get("length", 0)
        time_min = attrs.get("time", 0)
        # lengths are typically in kilometers, time in minutes
        if isinstance(length, (int, float)):
            total_length_km += float(length)
        if isinstance(time_min, (int, float)):
            total_time_min += float(time_min)

    # Fallback to route attributes if directions were empty
    if not directions_text:
        attr = routes[0].get("attributes", {})
        total_length_km = float(attr.get("Total_Kilometers", total_length_km))
        total_time_min = float(attr.get("Total_TravelTime", total_time_min))

    # ArcGIS returns geometry like { paths: [ [[x,y], ...] ] }
    return (route_geom, total_length_km, total_time_min, directions_text)
