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

class Track(BaseModel):
    id: str
    type: str # "video", "audio", "av" (Audio from Video)
    clips: List[Clip] = []

class Project(BaseModel):
    id: str = str(uuid.uuid4())
    tracks: List[Track] = []
    duration: float = 0.0
