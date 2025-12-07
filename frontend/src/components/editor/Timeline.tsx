import React, { useState, useRef, useEffect } from 'react';
import { Project, Track, Clip } from '@/types';
import { Button } from '@/components/ui/button';
import { Scissors, Trash2, Move, MousePointer2 } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"

interface TimelineProps {
    project: Project;
    onUpdateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
    onDeleteClip: (trackId: string, clipId: string) => void;
    onUnlinkClip: (trackId: string, clipId: string) => void;
    onSplitClip: (trackId: string, clipId: string, time: number) => void;
    onMergeClips: (trackId: string, clipIds: string[]) => void;
    onSeek: (time: number) => void;
    currentTime: number; // Controlled by parent
}

export function Timeline({ project, onUpdateClip, onDeleteClip, onUnlinkClip, onSplitClip, onMergeClips, onSeek, currentTime }: TimelineProps) {
    const PIXELS_PER_SECOND = 20;
    const SNAP_THRESHOLD_PX = 15; // Distance to snap
    
    const [selectedClips, setSelectedClips] = useState<string[]>([]); // Array of clip IDs
    const timelineRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<'select' | 'scissors'>('select');
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [mouseTime, setMouseTime] = useState<number | null>(null);

    // Dragging State
    const [dragState, setDragState] = useState<{
        active: boolean;
        startX: number;
        // initialClips stores the baseline state when drag started
        initialClips: { id: string, start: number, end: number, trackId: string }[];
        // currentDeltas stores the visual offset for rendering
        currentDelta: number;
    } | null>(null);

    const handleRulerMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsScrubbing(true);
        updateSeekFromEvent(e);
    };

    const updateSeekFromEvent = (e: React.MouseEvent) => {
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const offset = e.clientX - rect.left + timelineRef.current.scrollLeft - 32;
            const time = Math.max(0, offset / PIXELS_PER_SECOND);
            onSeek(time);
        }
    };

    const handleClipMouseDown = (e: React.MouseEvent, trackId: string, clip: Clip) => {
        e.stopPropagation();
        
        if (tool === 'scissors') {
            if (timelineRef.current) {
                const rect = timelineRef.current.getBoundingClientRect();
                const offset = e.clientX - rect.left + timelineRef.current.scrollLeft - 32;
                let clickTime = Math.max(0, offset / PIXELS_PER_SECOND);
                
                // Snap Logic for Scissors
                const timeDiff = Math.abs(clickTime - currentTime);
                const pxDiff = timeDiff * PIXELS_PER_SECOND;
                if (pxDiff < SNAP_THRESHOLD_PX) {
                    clickTime = currentTime;
                }
                
                onSplitClip(trackId, clip.id, clickTime);
            }
            return;
        }

        // Select Logic
        let newSelected = [...selectedClips];
        if (e.shiftKey) {
            if (newSelected.includes(clip.id)) {
                newSelected = newSelected.filter(id => id !== clip.id);
            } else {
                newSelected.push(clip.id);
            }
        } else {
            if (!newSelected.includes(clip.id)) {
                newSelected = [clip.id];
            }
        }
        
        // Auto-select linked clips if not already selected
        // Only if they are linked
        const linkedToAdd: string[] = [];
        newSelected.forEach(selId => {
            // Find clip
            project.tracks.forEach(t => {
                const c = t.clips.find(x => x.id === selId);
                if (c && c.linked_id && !newSelected.includes(c.linked_id) && !linkedToAdd.includes(c.linked_id)) {
                    linkedToAdd.push(c.linked_id);
                }
            });
        });
        newSelected = [...newSelected, ...linkedToAdd];
        
        setSelectedClips(newSelected);

        // Start Drag
        const initialClips = [];
        for (const t of project.tracks) {
            for (const c of t.clips) {
                if (newSelected.includes(c.id)) {
                    initialClips.push({ id: c.id, start: c.start_time, end: c.end_time, trackId: t.id });
                }
            }
        }

        setDragState({
            active: true,
            startX: e.clientX,
            initialClips,
            currentDelta: 0
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        // Track mouse time for Scissors Snap UI
        if (timelineRef.current) {
            const rect = timelineRef.current.getBoundingClientRect();
            const offset = e.clientX - rect.left + timelineRef.current.scrollLeft - 32;
            const time = Math.max(0, offset / PIXELS_PER_SECOND);
            setMouseTime(time);
        }

        if (isScrubbing) {
            updateSeekFromEvent(e);
            return;
        }

        if (!dragState || !dragState.active) return;

        const deltaX = e.clientX - dragState.startX;
        let deltaTime = deltaX / PIXELS_PER_SECOND;

        // SNAP TO CLIPS Logic
        let bestSnapDelta = deltaTime;
        let minSnapDist = SNAP_THRESHOLD_PX / PIXELS_PER_SECOND;

        // Snap to Start (0)
        dragState.initialClips.forEach(c => {
            const tentativeStart = c.start + deltaTime;
            const distToZero = Math.abs(tentativeStart);
            if (distToZero < minSnapDist) {
                minSnapDist = distToZero;
                bestSnapDelta = -c.start; 
            }
        });

        // Snap to Neighbors
        dragState.initialClips.forEach(c => {
            const tentativeStart = c.start + deltaTime;
            const tentativeEnd = c.end + deltaTime;
            
            const track = project.tracks.find(t => t.id === c.trackId);
            if (track) {
                track.clips.forEach(neighbor => {
                    if (dragState.initialClips.some(ic => ic.id === neighbor.id)) return;

                    const distStartToEnd = Math.abs(tentativeStart - neighbor.end_time);
                    if (distStartToEnd < minSnapDist) {
                        minSnapDist = distStartToEnd;
                        bestSnapDelta = neighbor.end_time - c.start;
                    }

                    const distEndToStart = Math.abs(tentativeEnd - neighbor.start_time);
                    if (distEndToStart < minSnapDist) {
                        minSnapDist = distEndToStart;
                        bestSnapDelta = neighbor.start_time - c.end;
                    }
                });
            }
        });

        deltaTime = bestSnapDelta;
        setDragState(prev => prev ? { ...prev, currentDelta: deltaTime } : null);
    };

    const handleMouseUp = () => {
        if (dragState && dragState.active) {
            // Commit changes
            // 1. Calculate final positions
            const finalClips = dragState.initialClips.map(c => ({
                ...c,
                newStart: Math.max(0, c.start + dragState.currentDelta),
                newEnd: Math.max(0, c.start + dragState.currentDelta) + (c.end - c.start)
            }));

            // 2. Validate
            let isValid = true;
            for (const movedClip of finalClips) {
                const track = project.tracks.find(t => t.id === movedClip.trackId);
                if (track) {
                    for (const existingClip of track.clips) {
                        if (dragState.initialClips.some(ic => ic.id === existingClip.id)) continue;
                        
                        const epsilon = 0.001;
                        if (movedClip.newStart < existingClip.end_time - epsilon && movedClip.newEnd > existingClip.start_time + epsilon) {
                            isValid = false;
                            break;
                        }
                    }
                }
                if (!isValid) break;
            }

            if (isValid) {
                dragState.initialClips.forEach(c => {
                    const newStart = Math.max(0, c.start + dragState.currentDelta);
                    const duration = c.end - c.start;
                    onUpdateClip(c.trackId, c.id, { 
                        start_time: newStart, 
                        end_time: newStart + duration 
                    });
                });
            } else {
                console.log("Invalid Move - Overlap Detected");
            }
        }

        setDragState(null);
        setIsScrubbing(false);
    };
    
    const isSnapping = tool === 'scissors' && mouseTime !== null && Math.abs(mouseTime - currentTime) * PIXELS_PER_SECOND < SNAP_THRESHOLD_PX;

    return (
        <div 
            className="h-64 border-t bg-gray-50 flex flex-col select-none relative" 
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => { handleMouseUp(); setMouseTime(null); }}
        >
            {isSnapping && (
                 <div 
                    className="absolute z-50 bg-red-600 text-white text-xs px-2 py-1 rounded shadow pointer-events-none transform -translate-x-1/2 -translate-y-full"
                    style={{ 
                        left: (currentTime * PIXELS_PER_SECOND) + 32 - (timelineRef.current?.scrollLeft || 0), 
                     }}
                 >
                 </div>
            )}

            <div className="h-10 border-b flex items-center px-4 gap-2 bg-white">
                <Button 
                    variant={tool === 'select' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setTool('select')}
                >
                    <MousePointer2 className="w-4 h-4 mr-2" /> Select
                </Button>
                <Button 
                    variant={tool === 'scissors' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => setTool('scissors')}
                >
                    <Scissors className="w-4 h-4 mr-2" /> Split
                </Button>
                <div className="flex-1" />
                <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={selectedClips.length === 0}
                    onClick={() => {
                        project.tracks.forEach(t => {
                            t.clips.forEach(c => {
                                if (selectedClips.includes(c.id)) {
                                    onDeleteClip(t.id, c.id);
                                }
                            });
                        });
                        setSelectedClips([]);
                    }}
                >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
                </Button>
            </div>

            <div 
                className="flex-1 overflow-x-auto p-4 relative" 
                ref={timelineRef}
                onClick={() => setSelectedClips([])}
            >
                <div className="relative min-w-[2000px]">
                    {isSnapping && (
                        <div 
                            className="absolute top-0 bottom-0 z-50 border-l-2 border-red-600 border-dashed pointer-events-none flex items-start"
                            style={{ left: currentTime * PIXELS_PER_SECOND + 32 }}
                        >
                            <span className="bg-red-600 text-white text-[10px] px-1 ml-1 rounded">Split Here</span>
                        </div>
                    )}

                    <div 
                        className="h-6 border-b mb-2 flex cursor-pointer relative"
                        onMouseDown={handleRulerMouseDown}
                    >
                        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-100 border-r z-20"></div>

                        <div className="ml-8 relative h-full w-full">
                            {Array.from({ length: 100 }).map((_, i) => (
                                <div key={i} className="absolute text-xs text-gray-400 border-l pl-1 select-none" 
                                     style={{ left: (i * 10 * PIXELS_PER_SECOND) }}>
                                    {i * 10}s
                                </div>
                            ))}
                            <div 
                                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                                style={{ left: (currentTime * PIXELS_PER_SECOND), height: '1000px' }}
                            />
                        </div>
                    </div>

                    {project.tracks.map(track => (
                        <div key={track.id} className="mb-2 relative h-12 bg-gray-200 rounded">
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gray-300 flex items-center justify-center text-xs z-10">
                                {track.type === 'video' ? 'V' : track.type === 'av' ? 'AV' : 'A'}
                            </div>
                            <div className="ml-8 relative h-full">
                                {track.clips.map(clip => {
                                    const isSelected = selectedClips.includes(clip.id);
                                    
                                    let visualStart = clip.start_time;
                                    let isDraggingThis = false;
                                    
                                    if (dragState && dragState.active) {
                                        const draggingClip = dragState.initialClips.find(c => c.id === clip.id);
                                        if (draggingClip) {
                                            isDraggingThis = true;
                                            visualStart = Math.max(0, draggingClip.start + dragState.currentDelta);
                                        }
                                    }

                                    return (
                                        <ContextMenu key={clip.id}>
                                            <ContextMenuTrigger>
                                                <div 
                                                    className={`absolute top-1 bottom-1 rounded border px-2 flex items-center justify-between overflow-hidden text-xs cursor-pointer transition-none
                                                        ${clip.type === 'video' ? 'bg-blue-200 border-blue-400' : 'bg-green-200 border-green-400'}
                                                        ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-blue-500 z-10 shadow-lg' : ''}
                                                        ${isDraggingThis ? 'opacity-80 z-20' : ''}
                                                    `}
                                                    style={{
                                                        left: visualStart * PIXELS_PER_SECOND,
                                                        width: (clip.end_time - clip.start_time) * PIXELS_PER_SECOND,
                                                        transition: isDraggingThis ? 'none' : 'all 0.1s' 
                                                    }}
                                                    onMouseDown={(e) => handleClipMouseDown(e, track.id, clip)}
                                                    onClick={(e) => e.stopPropagation()} 
                                                >
                                                    <span className="truncate">{clip.source_path.split('/').pop()}</span>
                                                </div>
                                            </ContextMenuTrigger>
                                            <ContextMenuContent>
                                                {/* Merge Option */}
                                                {isSelected && selectedClips.filter(id => track.clips.some(c => c.id === id)).length >= 2 && (
                                                    <ContextMenuItem onClick={() => {
                                                        const selectedOnTrack = selectedClips.filter(id => track.clips.some(c => c.id === id));
                                                        onMergeClips(track.id, selectedOnTrack);
                                                    }}>
                                                        Connect into one
                                                    </ContextMenuItem>
                                                )}
                                                
                                                {(clip.type === 'audio' || clip.linked_id) && (
                                                    <ContextMenuItem onClick={() => {
                                                        const vol = prompt("Volume (0.0 - 2.0)", clip.volume.toString());
                                                        if (vol) onUpdateClip(track.id, clip.id, { volume: parseFloat(vol) });
                                                    }}>
                                                        Adjust Volume...
                                                    </ContextMenuItem>
                                                )}
                                                <ContextMenuItem onClick={() => {
                                                     const speed = prompt("Speed (0.5 - 2.0)", (clip.speed || 1.0).toString());
                                                     if (speed) onUpdateClip(track.id, clip.id, { speed: parseFloat(speed) });
                                                }}>
                                                    Change Speed...
                                                </ContextMenuItem>
                                                {/* Unlink Option */}
                                                {clip.linked_id && (
                                                    <ContextMenuItem onClick={() => onUnlinkClip(track.id, clip.id)}>
                                                        Unlink Audio/Video
                                                    </ContextMenuItem>
                                                )}
                                                {/* Specialized Deletion Options */}
                                                {clip.type === 'video' && clip.linked_id && (
                                                    <ContextMenuItem className="text-red-600" onClick={() => {
                                                        // Find Linked Audio Clip
                                                        const linkedClip = project.tracks.flatMap(t => t.clips).find(c => c.id === clip.linked_id);
                                                        if (linkedClip) {
                                                            onDeleteClip(linkedClip.track_id, linkedClip.id);
                                                            // Also unlink this video clip
                                                            onUnlinkClip(track.id, clip.id);
                                                        }
                                                    }}>
                                                        Delete Linked Audio
                                                    </ContextMenuItem>
                                                )}
                                                <ContextMenuItem className="text-red-600" onClick={() => onDeleteClip(track.id, clip.id)}>
                                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                </ContextMenuItem>
                                            </ContextMenuContent>
                                        </ContextMenu>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
