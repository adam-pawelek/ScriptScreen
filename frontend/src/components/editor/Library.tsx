import React, { useState, useRef } from 'react';
import { UploadResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, Square } from 'lucide-react';

interface LibraryProps {
    items: UploadResponse[];
    onUpload: (file: File) => void;
    onAddToTimeline: (item: UploadResponse) => void;
    onRecordAudio: (blob: Blob) => Promise<UploadResponse | undefined>;
}

export function Library({ items, onUpload, onAddToTimeline, onRecordAudio }: LibraryProps) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                // Upload the recording
                await onRecordAudio(audioBlob);
                setIsRecording(false);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please ensure you have granted permission.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
        }
    };

    const videos = items.filter(i => i.type === 'video');
    const audios = items.filter(i => i.type === 'audio');

    return (
        <div className="w-64 border-r p-4 flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">Library</h2>
            <div className="mb-4 flex flex-col gap-2">
                <input 
                    type="file" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    id="file-upload" 
                />
                <Button asChild className="w-full">
                    <label htmlFor="file-upload">Upload Media</label>
                </Button>
                
                <Button 
                    onClick={() => isRecording ? stopRecording() : startRecording()}
                    variant={isRecording ? "destructive" : "outline"}
                    className={`w-full ${isRecording ? 'animate-pulse' : ''}`}
                >
                    {isRecording ? (
                        <>
                            <Square className="w-4 h-4 mr-2" />
                            Stop Recording
                        </>
                    ) : (
                        <>
                            <Mic className="w-4 h-4 mr-2" />
                            Record Audio
                        </>
                    )}
                </Button>
            </div>

            <Tabs defaultValue="videos" className="w-full flex-1 flex flex-col">
                <TabsList className="w-full">
                    <TabsTrigger value="videos" className="flex-1">Videos</TabsTrigger>
                    <TabsTrigger value="audios" className="flex-1">Audio</TabsTrigger>
                </TabsList>
                <TabsContent value="videos" className="flex-1 overflow-y-auto">
                    {videos.map(item => (
                         <div key={item.id} className="p-2 border mb-2 rounded cursor-pointer hover:bg-gray-100"
                              onClick={() => onAddToTimeline(item)}>
                             <div className="text-sm font-medium truncate">{item.filename}</div>
                             <div className="text-xs text-gray-500">Video</div>
                         </div>
                    ))}
                </TabsContent>
                <TabsContent value="audios" className="flex-1 overflow-y-auto">
                    {audios.map(item => (
                         <div key={item.id} className="p-2 border mb-2 rounded cursor-pointer hover:bg-gray-100"
                              onClick={() => onAddToTimeline(item)}>
                             <div className="text-sm font-medium truncate">{item.filename}</div>
                             <div className="text-xs text-gray-500">Audio</div>
                         </div>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}

