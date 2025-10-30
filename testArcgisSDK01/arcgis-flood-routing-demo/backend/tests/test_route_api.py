import json
import os
import sys
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import app  # noqa: E402

client = TestClient(app)


def mocked_requests_post(*args, **kwargs):
    class MockResp:
        def __init__(self, json_data, status_code=200):
            self._json = json_data
            self.status_code = status_code

        def json(self):
            return self._json

        def raise_for_status(self):
            if self.status_code >= 400:
                raise Exception("HTTP Error")

    # Return a minimal ArcGIS-like response
    return MockResp(
        {
            "routes": {
                "features": [
                    {
                        "geometry": {
                            "paths": [
                                [[-122.4, 37.78], [-122.41, 37.79]]
                            ]
                        },
                        "attributes": {
                            "Total_Kilometers": 1.2,
                            "Total_TravelTime": 3.4,
                        },
                    }
                ]
            },
            "directions": {
                "features": [
                    {"attributes": {"text": "Head north", "length": 0.6, "time": 1.7}},
                    {"attributes": {"text": "Turn right", "length": 0.6, "time": 1.7}},
                ]
            },
        }
    )


@patch("router.requests.post", side_effect=mocked_requests_post)
def test_route_schema(mock_post):
    body = {
        "origin": {"x": -122.4, "y": 37.78},
        "destination": {"x": -122.41, "y": 37.79},
        "flood_lines": [
            [[-122.405, 37.785], [-122.406, 37.786]]
        ],
    }
    resp = client.post("/api/route", json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert "route" in data and "paths" in data["route"]
    assert isinstance(data["distanceKm"], (int, float))
    assert isinstance(data["durationMin"], (int, float))
    assert isinstance(data["directions"], list)
