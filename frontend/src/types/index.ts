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

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'av';
  clips: Clip[];
}

export interface Project {
  id: string;
  tracks: Track[];
  duration: number;
}

export interface UploadResponse {
    id: string;
    filename: string;
    url: string;
    type: 'video' | 'audio';
    duration: number;
}
