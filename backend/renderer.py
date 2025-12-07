import ffmpeg
import os
from models import Project

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
                    v_gap = ffmpeg.input(f'color=c=black:s=1920x1080:d={gap_duration}', f='lavfi').video
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
            v = (
                inp.video
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
                    v_gap = ffmpeg.input(f'color=c=black:s=1920x1080:d={gap_duration}', f='lavfi').video
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
                
            duration = clip.end_time - clip.start_time
            speed = getattr(clip, 'speed', 1.0)
            source_duration = duration * speed
            
            inp = ffmpeg.input(clip.source_path)
            
            a = inp.audio.filter('atrim', start=clip.source_start, duration=source_duration).filter('asetpts', 'PTS-STARTPTS')
            
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
            
    # 5. Mix Audio
    final_audio = None
    if len(audio_overlays) > 1:
        # Use duration='first' because we padded main_v to be max_duration? 
        # No, 'longest' is safer here since we are mixing separate tracks.
        # But 'main_v' defines visual length.
        # If we use 'longest', audio might extend past video if we messed up padding.
        # But we padded video to max_duration. So 'longest' or 'first' (if video stream isn't input)
        # amix doesn't take video input.
        # So 'longest' ensures all audio is heard.
        final_audio = ffmpeg.filter(audio_overlays, 'amix', inputs=len(audio_overlays), duration='longest')
    elif len(audio_overlays) == 1:
        final_audio = audio_overlays[0]
        
    # 6. Output
    streams = [main_v]
    if final_audio:
        streams.append(final_audio)
        
    out = ffmpeg.output(*streams, output_path, preset=preset, crf=crf)
    out.run(overwrite_output=True)
    
    return output_path
