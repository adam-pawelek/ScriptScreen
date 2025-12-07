import React, { useRef, useEffect } from 'react';

interface PreviewPlayerProps {
    src: string | null;
    isRendering: boolean;
    currentTime: number;
    onTimeUpdate: (time: number) => void;
    aspectRatio?: string; // e.g. "16/9"
}

export function PreviewPlayer({ src, isRendering, currentTime, onTimeUpdate, aspectRatio = "16/9" }: PreviewPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const isSeekingRef = useRef(false);
    
    // Sync external currentTime to video element (Seek from Timeline)
    useEffect(() => {
        // Lower threshold for smoother scrubbing (0.1s)
        if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.1) {
            videoRef.current.currentTime = currentTime;
        }
    }, [currentTime]);

    useEffect(() => {
        if (src && videoRef.current) {
            const wasPlaying = !videoRef.current.paused;
            const savedTime = videoRef.current.currentTime;
            
            videoRef.current.src = src;
            videoRef.current.load();
            
            const handleLoaded = () => {
                if (videoRef.current) {
                    if (savedTime < videoRef.current.duration) {
                        videoRef.current.currentTime = savedTime;
                    }
                    if (wasPlaying) videoRef.current.play().catch(() => {});
                }
            };
            
            videoRef.current.addEventListener('loadedmetadata', handleLoaded, { once: true });
        }
    }, [src]);

    return (
        <div className="flex-1 flex items-center justify-center bg-black relative w-full h-full">
            {isRendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 text-white font-bold">
                    Rendering...
                </div>
            )}
            
            {/* Aspect Ratio Container */}
            <div 
                className="relative bg-black transition-all duration-300"
                style={{
                    aspectRatio: aspectRatio.replace(':', '/'),
                    height: '100%',
                    maxHeight: '100%',
                    maxWidth: '100%'
                }}
            >
                {src ? (
                    <video 
                        ref={videoRef}
                        controls 
                        className="w-full h-full object-contain bg-black"
                        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 border border-gray-800">
                        No Preview
                    </div>
                )}
            </div>
        </div>
    );
}
