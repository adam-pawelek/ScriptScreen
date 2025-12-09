import React, { useState, useRef } from 'react';
import { UploadResponse, TextOverlay } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, Square, Plus, Trash2, Type, Pencil, Check, X } from 'lucide-react';

interface LibraryProps {
    items: UploadResponse[];
    textOverlays: TextOverlay[];
    onUpload: (file: File) => void;
    onAddToTimeline: (item: UploadResponse) => void;
    onRecordAudio: (blob: Blob) => Promise<UploadResponse | undefined>;
    onAddTextOverlay: (overlay: Omit<TextOverlay, 'id'>) => void;
    onUpdateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
    onDeleteTextOverlay: (id: string) => void;
}

export function Library({ items, textOverlays, onUpload, onAddToTimeline, onRecordAudio, onAddTextOverlay, onUpdateTextOverlay, onDeleteTextOverlay }: LibraryProps) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Available fonts (common system fonts)
    const availableFonts = [
        'Sans',
        'Serif', 
        'Mono',
        'Arial',
        'Helvetica',
        'Times New Roman',
        'Georgia',
        'Courier New',
        'Verdana',
        'Impact',
        'Comic Sans MS',
        'Trebuchet MS',
        'Arial Black',
        'Palatino'
    ];

    // Text overlay form state
    const [newText, setNewText] = useState('');
    const [newStartTime, setNewStartTime] = useState(0);
    const [newEndTime, setNewEndTime] = useState(5);
    const [newX, setNewX] = useState(50);
    const [newY, setNewY] = useState(10);
    const [newFontSize, setNewFontSize] = useState(48);
    const [newFontFamily, setNewFontFamily] = useState('Sans');
    const [newColor, setNewColor] = useState('#ffffff');

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editStartTime, setEditStartTime] = useState(0);
    const [editEndTime, setEditEndTime] = useState(5);
    const [editX, setEditX] = useState(50);
    const [editY, setEditY] = useState(10);
    const [editFontSize, setEditFontSize] = useState(48);
    const [editFontFamily, setEditFontFamily] = useState('Sans');
    const [editColor, setEditColor] = useState('#ffffff');

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

    const handleAddText = () => {
        if (!newText.trim()) {
            alert('Please enter some text');
            return;
        }
        if (newEndTime <= newStartTime) {
            alert('End time must be greater than start time');
            return;
        }
        onAddTextOverlay({
            text: newText,
            start_time: newStartTime,
            end_time: newEndTime,
            x: newX,
            y: newY,
            font_size: newFontSize,
            font_family: newFontFamily,
            color: newColor
        });
        setNewText('');
    };

    const startEditing = (overlay: TextOverlay) => {
        setEditingId(overlay.id);
        setEditText(overlay.text);
        setEditStartTime(overlay.start_time);
        setEditEndTime(overlay.end_time);
        setEditX(overlay.x ?? 50);
        setEditY(overlay.y ?? 10);
        setEditFontSize(overlay.font_size ?? 48);
        setEditFontFamily(overlay.font_family ?? 'Sans');
        setEditColor(overlay.color ?? '#ffffff');
    };

    const saveEdit = () => {
        if (!editingId) return;
        if (!editText.trim()) {
            alert('Please enter some text');
            return;
        }
        if (editEndTime <= editStartTime) {
            alert('End time must be greater than start time');
            return;
        }
        onUpdateTextOverlay(editingId, {
            text: editText,
            start_time: editStartTime,
            end_time: editEndTime,
            x: editX,
            y: editY,
            font_size: editFontSize,
            font_family: editFontFamily,
            color: editColor
        });
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
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

            <Tabs defaultValue="videos" className="w-full flex-1 flex flex-col min-h-0">
                <TabsList className="w-full">
                    <TabsTrigger value="videos" className="flex-1 text-xs">Videos</TabsTrigger>
                    <TabsTrigger value="audios" className="flex-1 text-xs">Audio</TabsTrigger>
                    <TabsTrigger value="text" className="flex-1 text-xs">Text</TabsTrigger>
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
                <TabsContent value="text" className="flex-1 overflow-y-auto">
                    {/* Add Text Form */}
                    <div className="p-2 border rounded mb-3 bg-gray-50">
                        <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                            <Type className="w-3 h-3" /> Add Text Overlay
                        </div>
                        <input
                            type="text"
                            placeholder="Enter text..."
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            className="w-full p-1 text-xs border rounded mb-2"
                        />
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Start (s)</label>
                                <input
                                    type="number"
                                    value={newStartTime}
                                    onChange={(e) => setNewStartTime(parseFloat(e.target.value) || 0)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">End (s)</label>
                                <input
                                    type="number"
                                    value={newEndTime}
                                    onChange={(e) => setNewEndTime(parseFloat(e.target.value) || 0)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    step="0.1"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">X % (from left)</label>
                                <input
                                    type="number"
                                    value={newX}
                                    onChange={(e) => setNewX(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                    step="1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Y % (from bottom)</label>
                                <input
                                    type="number"
                                    value={newY}
                                    onChange={(e) => setNewY(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                    step="1"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Size</label>
                                <input
                                    type="number"
                                    value={newFontSize}
                                    onChange={(e) => setNewFontSize(parseInt(e.target.value) || 48)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="12"
                                    max="200"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Color</label>
                                <input
                                    type="color"
                                    value={newColor}
                                    onChange={(e) => setNewColor(e.target.value)}
                                    className="w-full h-6 border rounded cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="mb-2">
                            <label className="text-[10px] text-gray-500">Font</label>
                            <select
                                value={newFontFamily}
                                onChange={(e) => setNewFontFamily(e.target.value)}
                                className="w-full p-1 text-xs border rounded"
                            >
                                {availableFonts.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                ))}
                            </select>
                        </div>
                        <Button onClick={handleAddText} size="sm" className="w-full">
                            <Plus className="w-3 h-3 mr-1" /> Add Text
                        </Button>
                    </div>
                    
                    {/* Existing Text Overlays */}
                    {textOverlays.map(overlay => (
                        <div key={overlay.id} className="p-2 border mb-2 rounded bg-white">
                            {editingId === overlay.id ? (
                                // Edit Mode
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full p-1 text-xs border rounded"
                                    />
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Start (s)</label>
                                            <input
                                                type="number"
                                                value={editStartTime}
                                                onChange={(e) => setEditStartTime(parseFloat(e.target.value) || 0)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                step="0.1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">End (s)</label>
                                            <input
                                                type="number"
                                                value={editEndTime}
                                                onChange={(e) => setEditEndTime(parseFloat(e.target.value) || 0)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">X %</label>
                                            <input
                                                type="number"
                                                value={editX}
                                                onChange={(e) => setEditX(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Y %</label>
                                            <input
                                                type="number"
                                                value={editY}
                                                onChange={(e) => setEditY(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Size</label>
                                            <input
                                                type="number"
                                                value={editFontSize}
                                                onChange={(e) => setEditFontSize(parseInt(e.target.value) || 48)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="12"
                                                max="200"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Color</label>
                                            <input
                                                type="color"
                                                value={editColor}
                                                onChange={(e) => setEditColor(e.target.value)}
                                                className="w-full h-6 border rounded cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500">Font</label>
                                        <select
                                            value={editFontFamily}
                                            onChange={(e) => setEditFontFamily(e.target.value)}
                                            className="w-full p-1 text-xs border rounded"
                                        >
                                            {availableFonts.map(font => (
                                                <option key={font} value={font}>{font}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button onClick={saveEdit} size="sm" className="flex-1">
                                            <Check className="w-3 h-3 mr-1" /> Save
                                        </Button>
                                        <Button onClick={cancelEdit} size="sm" variant="outline" className="flex-1">
                                            <X className="w-3 h-3 mr-1" /> Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // View Mode
                                <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{overlay.text}</div>
                                        <div className="text-[10px] text-gray-500">
                                            {overlay.start_time}s - {overlay.end_time}s | X:{overlay.x ?? 50}% Y:{overlay.y ?? 10}%
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => startEditing(overlay)}
                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteTextOverlay(overlay.id)}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </TabsContent>
            </Tabs>
        </div>
    );
}

