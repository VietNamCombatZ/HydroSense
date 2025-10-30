import json
import os
import threading
import uuid
from typing import Dict, List

from models import FloodLine


class FloodStore:
    """In-memory flood polyline store with optional JSON persistence."""

    def __init__(self, persist: bool = False, path: str = "floods.json") -> None:
        self._lock = threading.Lock()
        self._persist = persist
        self._path = path
        self._floods: Dict[str, FloodLine] = {}
        if self._persist:
            self._load()

    def list(self) -> List[FloodLine]:
        with self._lock:
            return list(self._floods.values())

    def add(self, coordinates: List[List[float]]) -> FloodLine:
        with self._lock:
            fid = str(uuid.uuid4())
            fl = FloodLine(id=fid, coordinates=coordinates)
            self._floods[fid] = fl
            self._save()
            return fl

    def remove(self, fid: str) -> bool:
        with self._lock:
            existed = fid in self._floods
            if existed:
                del self._floods[fid]
                self._save()
            return existed

    def _save(self) -> None:
        if not self._persist:
            return
        try:
            data = {fid: fl.model_dump() for fid, fl in self._floods.items()}
            with open(self._path, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception:
            # best-effort; don't crash routing
            pass

    def _load(self) -> None:
        if not self._persist:
            return
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for fid, val in data.items():
                self._floods[fid] = FloodLine(**val)
        except Exception:
            # best-effort
            pass
