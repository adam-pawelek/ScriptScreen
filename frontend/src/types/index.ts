export interface Clip {
  id: string;
  track_id: string;
  source_path: string;
  start_time: number;
  end_time: number;
  source_start: number;
  type: 'video' | 'audio';
  volume: number;
  speed?: number; // Added speed
  z_index?: number;
  linked_id?: string; // ID of paired audio/video clip
}

export interface TextOverlay {
  id: string;
  text: string;
  start_time: number;
  end_time: number;
  x: number;  // Percentage from left (0-100)
  y: number;  // Percentage from bottom (0-100)
  font_size: number;
  font_family: string;
  color: string;
}

export interface ShapeOverlay {
  id: string;
  name: string;
  type: 'line' | 'arrow';
  start_time: number;
  end_time: number;
  x1: number;  // Start X % from left (0-100)
  y1: number;  // Start Y % from bottom (0-100)
  x2: number;  // End X % from left (0-100)
  y2: number;  // End Y % from bottom (0-100)
  color: string;
  width: number;
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'av';
  clips: Clip[];
}

export interface Project {
  id: string;
  tracks: Track[];
  duration: number;
  text_overlays: TextOverlay[];
  shape_overlays: ShapeOverlay[];
}

export interface UploadResponse {
    id: string;
    filename: string;
    url: string;
    type: 'video' | 'audio';
    duration: number;
}
