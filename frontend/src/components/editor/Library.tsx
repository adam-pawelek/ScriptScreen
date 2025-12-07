import React, { useState } from 'react';
import { UploadResponse } from '@/types';
import { Button } from '@/components/ui/button'; // Assuming shadcn button exists
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LibraryProps {
    items: UploadResponse[];
    onUpload: (file: File) => void;
    onAddToTimeline: (item: UploadResponse) => void;
}

export function Library({ items, onUpload, onAddToTimeline }: LibraryProps) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    const videos = items.filter(i => i.type === 'video');
    const audios = items.filter(i => i.type === 'audio');

    return (
        <div className="w-64 border-r p-4 flex flex-col h-full">
            <h2 className="text-xl font-bold mb-4">Library</h2>
            <div className="mb-4">
                <input 
                    type="file" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    id="file-upload" 
                />
                <Button asChild className="w-full">
                    <label htmlFor="file-upload">Upload Media</label>
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

