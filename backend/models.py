from pydantic import BaseModel
from typing import List, Optional
import uuid

class Clip(BaseModel):
    id: str
    track_id: str
    source_path: str  # Path on server (e.g. "uploads/video1.mp4")
    start_time: float  # Start time in the timeline (seconds)
    end_time: float    # End time in the timeline (seconds)
    source_start: float # Start time in the source file (trimming)
    type: str # "video" or "audio"
    volume: float = 1.0 # Linear volume (1.0 = 0dB)
    speed: float = 1.0 # Playback speed multiplier
    z_index: int = 0
    linked_id: Optional[str] = None # ID of the paired audio/video clip

class TextOverlay(BaseModel):
    id: str
    text: str
    start_time: float  # When text appears (seconds)
    end_time: float    # When text disappears (seconds)
    x: float = 50.0    # Percentage from left (0-100)
    y: float = 10.0    # Percentage from bottom (0-100)
    font_size: int = 48
    font_family: str = "Sans"
    color: str = "white"

class ShapeOverlay(BaseModel):
    id: str
    name: str = ""  # Optional name/label for the shape
    type: str  # "line" or "arrow"
    start_time: float
    end_time: float
    x1: float = 10.0   # Start X % from left
    y1: float = 10.0   # Start Y % from bottom
    x2: float = 90.0   # End X % from left
    y2: float = 10.0   # End Y % from bottom
    color: str = "white"
    width: int = 3

class Track(BaseModel):
    id: str
    type: str # "video", "audio", "av" (Audio from Video)
    clips: List[Clip] = []

class Project(BaseModel):
    id: str = str(uuid.uuid4())
    tracks: List[Track] = []
    duration: float = 0.0
    text_overlays: List[TextOverlay] = []
    shape_overlays: List[ShapeOverlay] = []
