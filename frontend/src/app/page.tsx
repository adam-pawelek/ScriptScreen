"use client";

import { useProject } from '@/hooks/useProject';
import { Library } from '@/components/editor/Library';
import { Timeline } from '@/components/editor/Timeline';
import { PreviewPlayer } from '@/components/editor/PreviewPlayer';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadResponse } from '@/types';

export default function Home() {
  const { 
    project, 
    library, 
    previewUrl, 
    isRendering, 
    uploadFile, 
    uploadRecording,
    addClip,
    addClipAtPosition,
    moveClipToTrack,
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
  } = useProject();

  const [currentTime, setCurrentTime] = useState(0);
  const [aspectRatio, setAspectRatio] = useState("16/9");
  const [draggingAsset, setDraggingAsset] = useState<UploadResponse | null>(null);

  return (
    <main className="flex h-screen w-full flex-col bg-white text-black">
      {/* Header */}
      <header className="h-12 border-b flex items-center px-4 bg-gray-50 shrink-0 justify-between">
        <h1 className="font-bold text-lg">Video Editor</h1>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Aspect Ratio:</span>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Ratio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16/9">16:9 (Widescreen)</SelectItem>
              <SelectItem value="9/16">9:16 (Vertical)</SelectItem>
              <SelectItem value="4/3">4:3 (Classic)</SelectItem>
              <SelectItem value="1/1">1:1 (Square)</SelectItem>
              <SelectItem value="21/9">21:9 (Ultrawide)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Library */}
        <Library 
            items={library} 
            textOverlays={project.text_overlays}
            shapeOverlays={project.shape_overlays}
            onUpload={uploadFile}
            onAddToTimeline={(item) => {
                let trackId = 'video-track-1';
                if (item.type === 'audio') {
                    const audioTrack = project.tracks.find(t => t.type === 'audio');
                    if (audioTrack) trackId = audioTrack.id;
                } else {
                    const videoTrack = project.tracks.find(t => t.type === 'video');
                    if (videoTrack) trackId = videoTrack.id;
                }
                
                addClip(trackId, item, 0); 
            }}
            onRecordAudio={uploadRecording}
            onAddTextOverlay={addTextOverlay}
            onUpdateTextOverlay={updateTextOverlay}
            onDeleteTextOverlay={deleteTextOverlay}
            onAddShapeOverlay={addShapeOverlay}
            onUpdateShapeOverlay={updateShapeOverlay}
            onDeleteShapeOverlay={deleteShapeOverlay}
            onDragStart={setDraggingAsset}
            onDragEnd={() => setDraggingAsset(null)}
        />

        {/* Right: Preview & Timeline */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Top: Preview (Fixed Height 70%) */}
            <div className="h-[70%] bg-gray-900 p-4 flex items-center justify-center border-b border-gray-700 overflow-hidden relative">
                <PreviewPlayer 
                    src={previewUrl} 
                    isRendering={isRendering} 
                    currentTime={currentTime}
                    onTimeUpdate={setCurrentTime}
                    aspectRatio={aspectRatio}
                />
            </div>

            {/* Bottom: Timeline (Flex Grow) */}
            <div className="flex-1 flex flex-col min-h-0">
                <Timeline 
                    project={project} 
                    onUpdateClip={updateClip} 
                    onDeleteClip={deleteClip}
                    onUnlinkClip={unlinkClip}
                    onSplitClip={splitClip}
                    onMergeClips={mergeClips}
                    onDropAsset={addClipAtPosition}
                    onMoveClipToTrack={moveClipToTrack}
                    onSeek={setCurrentTime}
                    currentTime={currentTime}
                    draggingAsset={draggingAsset}
                />
            </div>
        </div>
      </div>
    </main>
  );
}
