import { useState, useEffect, useRef } from 'react';
import { Project, Clip, UploadResponse, TextOverlay, ShapeOverlay } from '@/types';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:8000';

export function useProject() {
  const [project, setProject] = useState<Project>({
    id: uuidv4(),
    tracks: [
        { id: 'video-track-1', type: 'video', clips: [] },
        { id: 'av-track-1', type: 'av', clips: [] }, // Special track for video audio
        { id: 'audio-track-1', type: 'audio', clips: [] },
        { id: 'audio-track-2', type: 'audio', clips: [] }
    ],
    duration: 0,
    text_overlays: [],
    shape_overlays: []
  });
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [library, setLibrary] = useState<UploadResponse[]>([]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await axios.post(`${API_URL}/upload`, formData);
        const asset: UploadResponse = res.data;
        setLibrary(prev => [...prev, asset]);
        return asset;
    } catch (e) {
        console.error("Upload failed", e);
    }
  };

  // Upload recorded audio blob
  const uploadRecording = async (blob: Blob): Promise<UploadResponse | undefined> => {
    const formData = new FormData();
    const filename = `recording_${Date.now()}.webm`;
    formData.append('file', blob, filename);
    
    try {
        const res = await axios.post(`${API_URL}/upload`, formData);
        const asset: UploadResponse = res.data;
        setLibrary(prev => [...prev, asset]);
        return asset;
    } catch (e) {
        console.error("Recording upload failed", e);
        return undefined;
    }
  };

  const addClip = (trackId: string, asset: UploadResponse, startTime: number) => {
    setProject(prev => {
        let newTracks = [...prev.tracks];
        const videoClipId = uuidv4();
        const audioClipId = uuidv4();
        const duration = asset.duration || 10.0;

        if (asset.type === 'video') {
            const videoTrackIndex = newTracks.findIndex(t => t.type === 'video');
            if (videoTrackIndex === -1) return prev;
            
            let actualStart = startTime;
            const maxEnd = newTracks[videoTrackIndex].clips.reduce((max, c) => Math.max(max, c.end_time), 0);
            actualStart = maxEnd;

            const videoClip: Clip = {
                id: videoClipId,
                track_id: newTracks[videoTrackIndex].id,
                source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                start_time: actualStart,
                end_time: actualStart + duration,
                source_start: 0,
                type: 'video',
                volume: 0, 
                speed: 1.0,
                linked_id: audioClipId
            };

            const avTrackIndex = newTracks.findIndex(t => t.type === 'av');
            
            if (avTrackIndex !== -1) {
                const audioClip: Clip = {
                    id: audioClipId,
                    track_id: newTracks[avTrackIndex].id,
                    source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                    start_time: actualStart,
                    end_time: actualStart + duration,
                    source_start: 0,
                    type: 'audio',
                    volume: 1.0,
                    speed: 1.0,
                    linked_id: videoClipId 
                };
                
                newTracks[videoTrackIndex] = {
                    ...newTracks[videoTrackIndex],
                    clips: [...newTracks[videoTrackIndex].clips, videoClip]
                };
                
                newTracks[avTrackIndex] = {
                    ...newTracks[avTrackIndex],
                    clips: [...newTracks[avTrackIndex].clips, audioClip]
                };
            } else {
                 newTracks[videoTrackIndex] = {
                    ...newTracks[videoTrackIndex],
                    clips: [...newTracks[videoTrackIndex].clips, videoClip]
                };
            }

        } else {
            const targetTrackIndex = newTracks.findIndex(t => t.id === trackId);
            if (targetTrackIndex !== -1) {
                 // Place audio at the end of existing clips
                 let actualStart = startTime;
                 const maxEnd = newTracks[targetTrackIndex].clips.reduce((max, c) => Math.max(max, c.end_time), 0);
                 actualStart = Math.max(startTime, maxEnd);

                 const newClip: Clip = {
                    id: uuidv4(),
                    track_id: trackId,
                    source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                    start_time: actualStart,
                    end_time: actualStart + duration,
                    source_start: 0,
                    type: 'audio',
                    volume: 1.0,
                    speed: 1.0
                };
                newTracks[targetTrackIndex] = {
                    ...newTracks[targetTrackIndex],
                    clips: [...newTracks[targetTrackIndex].clips, newClip]
                };
            }
        }

        return { ...prev, tracks: newTracks };
    });
  };

  // Add clip at a specific position (for drag-drop)
  const addClipAtPosition = (asset: UploadResponse, trackId: string, startTime: number) => {
    setProject(prev => {
        const newTracks = [...prev.tracks];
        const duration = asset.duration || 10.0;
        
        if (asset.type === 'video') {
            // For videos, add to video track AND linked audio to AV track
            const videoTrackIndex = newTracks.findIndex(t => t.type === 'video');
            const avTrackIndex = newTracks.findIndex(t => t.type === 'av');
            
            if (videoTrackIndex === -1) return prev;
            
            const videoClipId = uuidv4();
            const audioClipId = uuidv4();
            
            const videoClip: Clip = {
                id: videoClipId,
                track_id: newTracks[videoTrackIndex].id,
                source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                start_time: startTime,
                end_time: startTime + duration,
                source_start: 0,
                type: 'video',
                volume: 0,
                speed: 1.0,
                linked_id: avTrackIndex !== -1 ? audioClipId : undefined
            };
            
            newTracks[videoTrackIndex] = {
                ...newTracks[videoTrackIndex],
                clips: [...newTracks[videoTrackIndex].clips, videoClip]
            };
            
            // Add linked audio if AV track exists
            if (avTrackIndex !== -1) {
                const audioClip: Clip = {
                    id: audioClipId,
                    track_id: newTracks[avTrackIndex].id,
                    source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                    start_time: startTime,
                    end_time: startTime + duration,
                    source_start: 0,
                    type: 'audio',
                    volume: 1.0,
                    speed: 1.0,
                    linked_id: videoClipId
                };
                
                newTracks[avTrackIndex] = {
                    ...newTracks[avTrackIndex],
                    clips: [...newTracks[avTrackIndex].clips, audioClip]
                };
            }
        } else {
            // Audio - add to specified track
            const targetTrackIndex = newTracks.findIndex(t => t.id === trackId);
            if (targetTrackIndex === -1) return prev;
            
            const newClip: Clip = {
                id: uuidv4(),
                track_id: trackId,
                source_path: asset.url.replace('/uploads/', 'media/uploads/'),
                start_time: startTime,
                end_time: startTime + duration,
                source_start: 0,
                type: 'audio',
                volume: 1.0,
                speed: 1.0
            };
            
            newTracks[targetTrackIndex] = {
                ...newTracks[targetTrackIndex],
                clips: [...newTracks[targetTrackIndex].clips, newClip]
            };
        }
        
        return { ...prev, tracks: newTracks };
    });
  };

  const updateClip = (trackId: string, clipId: string, updates: Partial<Clip>) => {
      setProject(prev => {
          let targetClip: Clip | undefined;
          prev.tracks.forEach(t => {
              const c = t.clips.find(clip => clip.id === clipId);
              if (c) targetClip = c;
          });

          if (!targetClip) return prev;

          const linkedId = targetClip.linked_id;
          
          const newTracks = prev.tracks.map(t => {
              return {
                  ...t,
                  clips: t.clips.map(c => {
                      if (c.id === clipId) {
                          return { ...c, ...updates };
                      }
                      if (linkedId && c.id === linkedId) {
                          const linkedUpdates: Partial<Clip> = {};
                          if (updates.start_time !== undefined) linkedUpdates.start_time = updates.start_time;
                          if (updates.end_time !== undefined) linkedUpdates.end_time = updates.end_time;
                          if (updates.source_start !== undefined) linkedUpdates.source_start = updates.source_start;
                          if (updates.speed !== undefined) linkedUpdates.speed = updates.speed;
                          if (updates.volume !== undefined) linkedUpdates.volume = updates.volume;
                          
                          return { ...c, ...linkedUpdates };
                      }
                      return c;
                  })
              };
          });
          return { ...prev, tracks: newTracks };
      });
  };

  const unlinkClip = (trackId: string, clipId: string) => {
      setProject(prev => {
          // Find linked ID
          let linkedId: string | null = null;
          prev.tracks.forEach(t => {
              const c = t.clips.find(clip => clip.id === clipId);
              if (c) linkedId = c.linked_id || null;
          });

          if (!linkedId) return prev;

          const newTracks = prev.tracks.map(t => {
              return {
                  ...t,
                  clips: t.clips.map(c => {
                      if (c.id === clipId || c.id === linkedId) {
                          return { ...c, linked_id: undefined }; // Remove link
                      }
                      return c;
                  })
              };
          });
          return { ...prev, tracks: newTracks };
      });
  };

  const deleteClip = (trackId: string, clipId: string) => {
      setProject(prev => {
          // Find linked ID first
          let linkedId: string | null = null;
          prev.tracks.forEach(t => {
              const c = t.clips.find(clip => clip.id === clipId);
              if (c) linkedId = c.linked_id || null;
          });

          const newTracks = prev.tracks.map(t => {
              return {
                  ...t,
                  clips: t.clips.filter(c => c.id !== clipId && c.id !== linkedId)
              };
          });
          return { ...prev, tracks: newTracks };
      });
  };

  const splitClip = (trackId: string, clipId: string, splitTime: number) => {
      setProject(prev => {
          let clip: Clip | undefined;
          let linkedClip: Clip | undefined;
          
          prev.tracks.forEach(t => {
              const c = t.clips.find(x => x.id === clipId);
              if (c) clip = c;
          });
          
          if (!clip) return prev;
          if (clip.linked_id) {
              prev.tracks.forEach(t => {
                  const c = t.clips.find(x => x.id === clip.linked_id);
                  if (c) linkedClip = c;
              });
          }

          const doSplit = (c: Clip): [Clip, Clip] | null => {
               if (splitTime <= c.start_time || splitTime >= c.end_time) return null;
               
               const timelineOffset = splitTime - c.start_time;
               const sourceSplit = c.source_start + (timelineOffset * (c.speed || 1.0));
               
               return [
                   { ...c, end_time: splitTime },
                   { ...c, id: uuidv4(), start_time: splitTime, source_start: sourceSplit }
               ];
          };

          const split1 = doSplit(clip);
          if (!split1) return prev;
          
          let split2: [Clip, Clip] | null = null;
          if (linkedClip) {
              split2 = doSplit(linkedClip);
          }

          const [left1, right1] = split1;
          
          if (split2) {
              const [left2, right2] = split2;
              
              right1.linked_id = right2.id;
              right2.linked_id = right1.id;
              
              const newTracks = prev.tracks.map(t => {
                  let newClips = [...t.clips];
                  
                  if (t.id === clip!.track_id) {
                      newClips = newClips.filter(c => c.id !== clip!.id);
                      newClips.push(left1, right1);
                  }
                  
                  if (linkedClip && t.id === linkedClip.track_id) {
                      newClips = newClips.filter(c => c.id !== linkedClip.id);
                      newClips.push(left2, right2);
                  }
                  
                  return { ...t, clips: newClips };
              });
              
              return { ...prev, tracks: newTracks };
          } else {
              const newTracks = prev.tracks.map(t => {
                  if (t.id === clip!.track_id) {
                      const newClips = t.clips.filter(c => c.id !== clip!.id);
                      newClips.push(left1, right1);
                      return { ...t, clips: newClips };
                  }
                  return t;
              });
              return { ...prev, tracks: newTracks };
          }
      });
  };

  const mergeClips = async (trackId: string, clipIds: string[]) => {
      // Get current project state
      const currentProject = project;
      const track = currentProject.tracks.find(t => t.id === trackId);
      if (!track) return;

      const clipsToMerge = track.clips.filter(c => clipIds.includes(c.id));
      if (clipsToMerge.length < 2) return;

      // Check if any clips are linked - don't allow merging linked clips
      const hasLinkedClips = clipsToMerge.some(c => c.linked_id);
      if (hasLinkedClips) {
          alert("Cannot merge linked clips.\n\nPlease unlink the video and audio first (right-click → 'Unlink Audio/Video'), then merge the video clips and audio clips separately.");
          return;
      }

      // Sort by time
      clipsToMerge.sort((a, b) => a.start_time - b.start_time);

      // Calculate the timeline offset (normalize to start at 0)
      const minStart = clipsToMerge[0].start_time;
      
      // Create a mini-project for rendering
      const normalizedClips = clipsToMerge.map(c => ({
          ...c,
          start_time: c.start_time - minStart,
          end_time: c.end_time - minStart
      }));

      const miniProject: Project = {
          id: uuidv4(),
          tracks: [
              { id: 'merge-video', type: 'video', clips: track.type === 'video' ? normalizedClips : [] },
              { id: 'merge-av', type: 'av', clips: track.type === 'av' ? normalizedClips : [] },
              { id: 'merge-audio', type: 'audio', clips: track.type === 'audio' ? normalizedClips : [] }
          ],
          duration: 0
      };

      try {
          // Call the server to render and merge
          const res = await axios.post(`${API_URL}/merge`, miniProject);
          const newAsset: UploadResponse = res.data;
          
          // Add to library
          setLibrary(prev => [...prev, newAsset]);

          // Update project: remove old clips, add new merged clip
          setProject(prev => {
              const newClipId = uuidv4();
              const newClip: Clip = {
                  id: newClipId,
                  track_id: trackId,
                  source_path: newAsset.url.replace('/uploads/', 'media/uploads/'),
                  start_time: minStart,
                  end_time: minStart + newAsset.duration,
                  source_start: 0,
                  type: track.type === 'video' ? 'video' : 'audio',
                  volume: 1.0,
                  speed: 1.0
              };

              const newTracks = prev.tracks.map(t => {
                  if (t.id === trackId) {
                      const remaining = t.clips.filter(c => !clipIds.includes(c.id));
                      return { ...t, clips: [...remaining, newClip] };
                  }
                  return t;
              });

              return { ...prev, tracks: newTracks };
          });
      } catch (e) {
          console.error("Merge failed", e);
          alert("Merge failed. Check console for details.");
      }
  };

  // Text Overlay Functions
  const addTextOverlay = (textOverlay: Omit<TextOverlay, 'id'>) => {
      setProject(prev => ({
          ...prev,
          text_overlays: [...prev.text_overlays, { ...textOverlay, id: uuidv4() }]
      }));
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
      setProject(prev => ({
          ...prev,
          text_overlays: prev.text_overlays.map(t => 
              t.id === id ? { ...t, ...updates } : t
          )
      }));
  };

  const deleteTextOverlay = (id: string) => {
      setProject(prev => ({
          ...prev,
          text_overlays: prev.text_overlays.filter(t => t.id !== id)
      }));
  };

  // Shape Overlay Functions
  const addShapeOverlay = (shapeOverlay: Omit<ShapeOverlay, 'id'>) => {
      setProject(prev => ({
          ...prev,
          shape_overlays: [...prev.shape_overlays, { ...shapeOverlay, id: uuidv4() }]
      }));
  };

  const updateShapeOverlay = (id: string, updates: Partial<ShapeOverlay>) => {
      setProject(prev => ({
          ...prev,
          shape_overlays: prev.shape_overlays.map(s => 
              s.id === id ? { ...s, ...updates } : s
          )
      }));
  };

  const deleteShapeOverlay = (id: string) => {
      setProject(prev => ({
          ...prev,
          shape_overlays: prev.shape_overlays.filter(s => s.id !== id)
      }));
  };

  // Auto-Preview Logic
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    const hasClips = project.tracks.some(t => t.clips.length > 0);
    if (!hasClips) return;

    debounceRef.current = setTimeout(async () => {
        setIsRendering(true);
        try {
            const res = await axios.post(`${API_URL}/preview`, project);
            if (res.data.status === 'ready') {
                setPreviewUrl(`${API_URL}${res.data.url}`);
            }
        } catch (e) {
            console.error("Preview render failed", e);
        } finally {
            setIsRendering(false);
        }
    }, 1000); 

    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [project]);

  return {
    project,
    library,
    previewUrl,
    isRendering,
    uploadFile,
    uploadRecording,
    addClip,
    addClipAtPosition,
    updateClip,
    deleteClip,
    unlinkClip,
    splitClip,
    mergeClips,
    addTextOverlay,
    updateTextOverlay,
    deleteTextOverlay,
    addShapeOverlay,
    updateShapeOverlay,
    deleteShapeOverlay
  };
}
