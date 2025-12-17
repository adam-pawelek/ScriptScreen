import ffmpeg
import os
import uuid
import math
import subprocess
import json
from models import Project

def has_audio_stream(file_path: str) -> bool:
    """Check if a media file has an audio stream using ffprobe."""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', file_path],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            return False
        data = json.loads(result.stdout)
        streams = data.get('streams', [])
        return any(s.get('codec_type') == 'audio' for s in streams)
    except Exception:
        return False

def render_project(project: Project, output_path: str, preset: str = 'ultrafast', crf: int = 28):
    """
    Renders the project to the output_path using ffmpeg-python.
    Handles gaps in video track by inserting black frames.
    Normalizes streams to prevent concat errors.
    """
    
    # 1. Identify Tracks
    video_track = next((t for t in project.tracks if t.type == "video"), None)
    
    # Audio tracks: Includes "audio" AND "av" (linked audio) tracks
    audio_tracks = [t for t in project.tracks if t.type in ["audio", "av"]]
    
    # 2. Process Video Track (Video Only)
    # Note: We now ignore audio from the video track clips because they are moved to 'av' track
    video_concat_parts = []
    
    # Track duration logic
    max_duration = 0.0
    
    if video_track and video_track.clips:
        sorted_clips = sorted(video_track.clips, key=lambda c: c.start_time)
        current_time = 0.0
        
        for clip in sorted_clips:
            max_duration = max(max_duration, clip.end_time)
            
            # Handle Gap
            if clip.start_time > current_time:
                gap_duration = clip.start_time - current_time
                if gap_duration > 0.01: # Threshold
                    # Insert Black Video (Force 1920x1080)
                    v_gap = (
                        ffmpeg.input(f'color=c=black:s=1920x1080:d={gap_duration}', f='lavfi')
                        .video
                        .filter('metadata', mode='add', key='unique_id', value=str(uuid.uuid4()))
                    )
                    # No audio gap here, audio is handled separately
                    video_concat_parts.append(v_gap)
            
            # Validate source
            if not os.path.exists(clip.source_path):
                print(f"Warning: Source file not found: {clip.source_path}")
                continue
                
            duration = clip.end_time - clip.start_time
            
            # Input
            inp = ffmpeg.input(clip.source_path)
            
            # Video: Trim & SetPTS & Scale & SAR
            speed = getattr(clip, 'speed', 1.0)
            source_duration = duration * speed
            
            # Reset PTS to 0 for concat: setpts=(PTS-STARTPTS)/speed
            # Fix: Add unique metadata to prevent ffmpeg-python from merging identical filter chains
            unique_id = str(uuid.uuid4())
            v = (
                inp.video
                .filter('metadata', mode='add', key='unique_id', value=unique_id)
                .filter('trim', start=clip.source_start, duration=source_duration)
                .filter('setpts', f'(PTS-STARTPTS)/{speed}')
                .filter('scale', 1920, 1080)
                .filter('setsar', 1, 1)
            )
            
            # We DO NOT process audio here anymore for the video track.
            # Audio is expected to be in a separate 'av' track clip.
                
            video_concat_parts.append(v)
            
            current_time = clip.end_time

            
    # Calculate Audio Track Durations
    for track in audio_tracks:
        for clip in track.clips:
            max_duration = max(max_duration, clip.end_time)

    # 3. Create Main Video Stream
    main_v = None
    
    if video_concat_parts:
        try:
            # Check if video track needs padding at the end
            current_video_end = current_time
            if max_duration > current_video_end:
                gap_duration = max_duration - current_video_end
                if gap_duration > 0.01:
                    v_gap = (
                        ffmpeg.input(f'color=c=black:s=1920x1080:d={gap_duration}', f='lavfi')
                        .video
                        .filter('metadata', mode='add', key='unique_id', value=str(uuid.uuid4()))
                    )
                    video_concat_parts.append(v_gap)

            concatenated = ffmpeg.concat(*video_concat_parts, v=1, a=0).node
            main_v = concatenated[0]
        except Exception as e:
            print(f"Concat Error: {e}")
            return None
    else:
        # If no video clips but there are audio clips, create black video for full duration
        if max_duration > 0:
             main_v = ffmpeg.input(f'color=c=black:s=1920x1080:d={max_duration}', f='lavfi').video
        else:
             return None
        
    # 4. Process Audio Tracks (Includes 'av' tracks now)
    audio_overlays = []
        
    for track in audio_tracks:
        for clip in track.clips:
            if not os.path.exists(clip.source_path):
                continue
            
            # Check if the file actually has an audio stream
            if not has_audio_stream(clip.source_path):
                print(f"Warning: Skipping audio processing for {clip.source_path} - no audio stream found")
                continue
                
            duration = clip.end_time - clip.start_time
            speed = getattr(clip, 'speed', 1.0)
            source_duration = duration * speed
            
            inp = ffmpeg.input(clip.source_path)
            
            # Fix: Add unique metadata to prevent ffmpeg-python from merging identical audio chains
            unique_id_a = str(uuid.uuid4())
            a = inp.audio.filter('ametadata', mode='add', key='unique_id', value=unique_id_a)
            
            a = a.filter('atrim', start=clip.source_start, duration=source_duration).filter('asetpts', 'PTS-STARTPTS')
            
            if speed != 1.0:
                 a = a.filter('atempo', speed)
            
            if clip.volume != 1.0:
                a = a.filter('volume', volume=clip.volume)
            
            # Normalize to match main audio if needed, usually amix handles it but 48k is safe
            a = a.filter('aresample', 48000)
                
            delay_ms = int(clip.start_time * 1000)
            if delay_ms > 0:
                a = a.filter('adelay', delays=f"{delay_ms}|{delay_ms}")
            
            audio_overlays.append(a)
    
    # 5. Apply Text Overlays
    if hasattr(project, 'text_overlays') and project.text_overlays:
        for text_overlay in project.text_overlays:
            font_size = getattr(text_overlay, 'font_size', 48)
            font_family = getattr(text_overlay, 'font_family', 'Sans')
            color = getattr(text_overlay, 'color', 'white')
            
            # Get x and y percentages (from left and bottom)
            x_pct = getattr(text_overlay, 'x', 50.0)
            y_pct = getattr(text_overlay, 'y', 10.0)
            
            # Convert percentages to ffmpeg expressions
            # x: percentage from left
            # y: percentage from bottom (ffmpeg y=0 is top, so we need to invert)
            x_pos = f'(w-text_w)*{x_pct}/100'
            y_pos = f'h-text_h-(h-text_h)*{y_pct}/100'
            
            # Escape special characters in text for ffmpeg
            escaped_text = text_overlay.text.replace("'", "\\'").replace(":", "\\:")
            
            # Apply drawtext filter with enable expression for timing
            main_v = main_v.filter(
                'drawtext',
                text=escaped_text,
                fontsize=font_size,
                font=font_family,
                fontcolor=color,
                x=x_pos,
                y=y_pos,
                enable=f'between(t,{text_overlay.start_time},{text_overlay.end_time})',
                borderw=2,
                bordercolor='black'
            )
    
    # 6. Apply Shape Overlays (Lines and Arrows)
    # Helper function to draw a line using multiple drawbox filters (since drawline may not exist)
    def draw_line_with_boxes(video_stream, x1, y1, x2, y2, color, thickness, enable_expr, num_segments=20):
        """Draw a line using multiple small boxes along the path"""
        for i in range(num_segments + 1):
            t = i / num_segments
            x = int(x1 + t * (x2 - x1))
            y = int(y1 + t * (y2 - y1))
            half_t = thickness // 2
            video_stream = video_stream.filter(
                'drawbox',
                x=max(0, x - half_t),
                y=max(0, y - half_t),
                w=thickness,
                h=thickness,
                color=color,
                t='fill',
                enable=enable_expr
            )
        return video_stream
    
    if hasattr(project, 'shape_overlays') and project.shape_overlays:
        for shape in project.shape_overlays:
            shape_type = getattr(shape, 'type', 'line')
            color = getattr(shape, 'color', 'white')
            width = getattr(shape, 'width', 3)
            
            # Get coordinates as percentages
            x1_pct = getattr(shape, 'x1', 10.0)
            y1_pct = getattr(shape, 'y1', 10.0)
            x2_pct = getattr(shape, 'x2', 90.0)
            y2_pct = getattr(shape, 'y2', 10.0)
            
            # Calculate actual pixel values for 1920x1080
            # y is inverted: 0% from bottom = bottom of screen, 100% from bottom = top
            x1_px = int(1920 * x1_pct / 100)
            y1_px = int(1080 - 1080 * y1_pct / 100)
            x2_px = int(1920 * x2_pct / 100)
            y2_px = int(1080 - 1080 * y2_pct / 100)
            
            enable_expr = f'between(t,{shape.start_time},{shape.end_time})'
            
            # Calculate line length to determine number of segments
            line_length = math.sqrt((x2_px - x1_px)**2 + (y2_px - y1_px)**2)
            num_segments = max(10, int(line_length / (width * 0.8)))  # More segments for smoother lines
            
            # Draw the main line
            main_v = draw_line_with_boxes(main_v, x1_px, y1_px, x2_px, y2_px, color, width, enable_expr, num_segments)
            
            # If it's an arrow, draw the arrowhead
            if shape_type == 'arrow':
                # Calculate angle of the line
                dx = x2_px - x1_px
                dy = y2_px - y1_px
                angle = math.atan2(dy, dx)
                
                # Arrowhead size based on line width
                arrow_size = width * 5
                
                # Calculate arrowhead points (two lines forming a V at the end)
                angle1 = angle + math.pi * 0.8  # 144 degrees from line direction
                angle2 = angle - math.pi * 0.8
                
                ax1 = int(x2_px + arrow_size * math.cos(angle1))
                ay1 = int(y2_px + arrow_size * math.sin(angle1))
                ax2 = int(x2_px + arrow_size * math.cos(angle2))
                ay2 = int(y2_px + arrow_size * math.sin(angle2))
                
                # Draw arrowhead lines (fewer segments since they're shorter)
                main_v = draw_line_with_boxes(main_v, x2_px, y2_px, ax1, ay1, color, width, enable_expr, 8)
                main_v = draw_line_with_boxes(main_v, x2_px, y2_px, ax2, ay2, color, width, enable_expr, 8)
            
    # 7. Mix Audio
    final_audio = None
    if len(audio_overlays) > 1:
        final_audio = ffmpeg.filter(audio_overlays, 'amix', inputs=len(audio_overlays), duration='longest')
    elif len(audio_overlays) == 1:
        final_audio = audio_overlays[0]
        
    # 7. Output
    streams = [main_v]
    if final_audio:
        streams.append(final_audio)
        
    out = ffmpeg.output(*streams, output_path, preset=preset, crf=crf)
    out.run(overwrite_output=True)
    
    return output_path
