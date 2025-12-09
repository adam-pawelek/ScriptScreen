import React, { useState, useRef } from 'react';
import { UploadResponse, TextOverlay, ShapeOverlay } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, Square, Plus, Trash2, Type, Pencil, Check, X, ArrowRight, Minus, Settings } from 'lucide-react';

interface LibraryProps {
    items: UploadResponse[];
    textOverlays: TextOverlay[];
    shapeOverlays: ShapeOverlay[];
    onUpload: (file: File) => void;
    onAddToTimeline: (item: UploadResponse) => void;
    onRecordAudio: (blob: Blob) => Promise<UploadResponse | undefined>;
    onAddTextOverlay: (overlay: Omit<TextOverlay, 'id'>) => void;
    onUpdateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
    onDeleteTextOverlay: (id: string) => void;
    onAddShapeOverlay: (overlay: Omit<ShapeOverlay, 'id'>) => void;
    onUpdateShapeOverlay: (id: string, updates: Partial<ShapeOverlay>) => void;
    onDeleteShapeOverlay: (id: string) => void;
}

export function Library({ items, textOverlays, shapeOverlays, onUpload, onAddToTimeline, onRecordAudio, onAddTextOverlay, onUpdateTextOverlay, onDeleteTextOverlay, onAddShapeOverlay, onUpdateShapeOverlay, onDeleteShapeOverlay }: LibraryProps) {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Recording settings state
    const [showRecordingSettings, setShowRecordingSettings] = useState(false);
    const [recordingVolume, setRecordingVolume] = useState(100); // 0-200%
    const [noiseReduction, setNoiseReduction] = useState(50);    // 0-100%
    
    // Temp values for settings modal
    const [tempVolume, setTempVolume] = useState(100);
    const [tempNoiseReduction, setTempNoiseReduction] = useState(50);

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

    // Text editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editStartTime, setEditStartTime] = useState(0);
    const [editEndTime, setEditEndTime] = useState(5);
    const [editX, setEditX] = useState(50);
    const [editY, setEditY] = useState(10);
    const [editFontSize, setEditFontSize] = useState(48);
    const [editFontFamily, setEditFontFamily] = useState('Sans');
    const [editColor, setEditColor] = useState('#ffffff');

    // Shape overlay form state
    const [newShapeName, setNewShapeName] = useState('');
    const [newShapeType, setNewShapeType] = useState<'line' | 'arrow'>('arrow');
    const [newShapeStartTime, setNewShapeStartTime] = useState(0);
    const [newShapeEndTime, setNewShapeEndTime] = useState(5);
    const [newShapeX1, setNewShapeX1] = useState(20);
    const [newShapeY1, setNewShapeY1] = useState(50);
    const [newShapeX2, setNewShapeX2] = useState(80);
    const [newShapeY2, setNewShapeY2] = useState(50);
    const [newShapeColor, setNewShapeColor] = useState('#ffffff');
    const [newShapeWidth, setNewShapeWidth] = useState(3);

    // Shape editing state
    const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
    const [editShapeName, setEditShapeName] = useState('');
    const [editShapeType, setEditShapeType] = useState<'line' | 'arrow'>('arrow');
    const [editShapeStartTime, setEditShapeStartTime] = useState(0);
    const [editShapeEndTime, setEditShapeEndTime] = useState(5);
    const [editShapeX1, setEditShapeX1] = useState(20);
    const [editShapeY1, setEditShapeY1] = useState(50);
    const [editShapeX2, setEditShapeX2] = useState(80);
    const [editShapeY2, setEditShapeY2] = useState(50);
    const [editShapeColor, setEditShapeColor] = useState('#ffffff');
    const [editShapeWidth, setEditShapeWidth] = useState(3);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    const openRecordingSettings = () => {
        setTempVolume(recordingVolume);
        setTempNoiseReduction(noiseReduction);
        setShowRecordingSettings(true);
    };

    const saveRecordingSettings = () => {
        setRecordingVolume(tempVolume);
        setNoiseReduction(tempNoiseReduction);
        setShowRecordingSettings(false);
    };

    const cancelRecordingSettings = () => {
        setShowRecordingSettings(false);
    };

    const startRecording = async () => {
        try {
            // Use MediaStream constraints for noise suppression
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    autoGainControl: noiseReduction > 0,
                    noiseSuppression: noiseReduction > 30,
                    echoCancellation: noiseReduction > 50,
                    channelCount: 1,
                    sampleRate: 48000
                } 
            });
            
            // Store stream reference for cleanup
            streamRef.current = stream;

            // Set up Web Audio API for volume control
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            
            const source = audioContext.createMediaStreamSource(stream);
            const gainNode = audioContext.createGain();
            gainNodeRef.current = gainNode;
            
            // Set gain based on volume setting (100 = 1.0, 200 = 2.0, etc.)
            gainNode.gain.value = recordingVolume / 100;
            
            // Create a destination to capture the processed audio
            const destination = audioContext.createMediaStreamDestination();
            
            // Optional: Add high-pass filter if noise reduction is enabled
            if (noiseReduction > 20) {
                const highpassFilter = audioContext.createBiquadFilter();
                highpassFilter.type = 'highpass';
                highpassFilter.frequency.value = 80 + (noiseReduction * 0.5); // 80-130Hz based on setting
                source.connect(highpassFilter);
                highpassFilter.connect(gainNode);
            } else {
                source.connect(gainNode);
            }
            
            gainNode.connect(destination);
            
            // Record from the processed stream
            const mediaRecorder = new MediaRecorder(destination.stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Create blob from collected chunks
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
                // Clean up stream and audio context AFTER recorder has stopped
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
                
                // Upload the recording - backend will fix WebM duration metadata
                await onRecordAudio(audioBlob);
                setIsRecording(false);
            };

            // Start recording
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please ensure you have granted permission.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            // Just stop the recorder - cleanup happens in onstop callback
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
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

    // Shape handlers
    const handleAddShape = () => {
        if (newShapeEndTime <= newShapeStartTime) {
            alert('End time must be greater than start time');
            return;
        }
        onAddShapeOverlay({
            name: newShapeName || `${newShapeType} ${shapeOverlays.length + 1}`,
            type: newShapeType,
            start_time: newShapeStartTime,
            end_time: newShapeEndTime,
            x1: newShapeX1,
            y1: newShapeY1,
            x2: newShapeX2,
            y2: newShapeY2,
            color: newShapeColor,
            width: newShapeWidth
        });
        setNewShapeName('');
    };

    const startEditingShape = (shape: ShapeOverlay) => {
        setEditingShapeId(shape.id);
        setEditShapeName(shape.name ?? '');
        setEditShapeType(shape.type);
        setEditShapeStartTime(shape.start_time);
        setEditShapeEndTime(shape.end_time);
        setEditShapeX1(shape.x1 ?? 20);
        setEditShapeY1(shape.y1 ?? 50);
        setEditShapeX2(shape.x2 ?? 80);
        setEditShapeY2(shape.y2 ?? 50);
        setEditShapeColor(shape.color ?? '#ffffff');
        setEditShapeWidth(shape.width ?? 3);
    };

    const saveShapeEdit = () => {
        if (!editingShapeId) return;
        if (editShapeEndTime <= editShapeStartTime) {
            alert('End time must be greater than start time');
            return;
        }
        onUpdateShapeOverlay(editingShapeId, {
            name: editShapeName,
            type: editShapeType,
            start_time: editShapeStartTime,
            end_time: editShapeEndTime,
            x1: editShapeX1,
            y1: editShapeY1,
            x2: editShapeX2,
            y2: editShapeY2,
            color: editShapeColor,
            width: editShapeWidth
        });
        setEditingShapeId(null);
    };

    const cancelShapeEdit = () => {
        setEditingShapeId(null);
    };

    const videos = items.filter(i => i.type === 'video');
    const audios = items.filter(i => i.type === 'audio');

    return (
        <div className="w-64 border-r p-4 flex flex-col h-full relative">
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
                
                <div className="flex gap-1">
                    <Button 
                        onClick={() => isRecording ? stopRecording() : startRecording()}
                        variant={isRecording ? "destructive" : "outline"}
                        className={`flex-1 ${isRecording ? 'animate-pulse' : ''}`}
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
                    <Button
                        onClick={openRecordingSettings}
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0"
                        title="Recording Settings"
                        disabled={isRecording}
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>
                <div className="text-[9px] text-gray-400 text-right -mt-1 cursor-pointer hover:text-gray-600" onClick={openRecordingSettings}>
                    Recording Settings
                </div>
            </div>

            {/* Recording Settings Modal */}
            {showRecordingSettings && (
                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-[240px]">
                        <h3 className="font-semibold text-sm mb-3">Recording Settings</h3>
                        
                        {/* Volume Control */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-600 block mb-1">
                                Volume Gain: {tempVolume}%
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="200"
                                    value={tempVolume}
                                    onChange={(e) => setTempVolume(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    value={tempVolume}
                                    onChange={(e) => setTempVolume(Math.min(200, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="w-14 p-1 text-xs border rounded text-center"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                100% = normal, 200% = 2x boost
                            </p>
                        </div>
                        
                        {/* Noise Reduction Control */}
                        <div className="mb-4">
                            <label className="text-xs text-gray-600 block mb-1">
                                Noise Reduction: {tempNoiseReduction}%
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={tempNoiseReduction}
                                    onChange={(e) => setTempNoiseReduction(parseInt(e.target.value))}
                                    className="flex-1"
                                />
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={tempNoiseReduction}
                                    onChange={(e) => setTempNoiseReduction(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                    className="w-14 p-1 text-xs border rounded text-center"
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Higher = more noise filtering
                            </p>
                        </div>
                        
                        {/* Buttons */}
                        <div className="flex gap-2">
                            <Button onClick={saveRecordingSettings} size="sm" className="flex-1">
                                <Check className="w-3 h-3 mr-1" /> Save
                            </Button>
                            <Button onClick={cancelRecordingSettings} size="sm" variant="outline" className="flex-1">
                                <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Tabs defaultValue="videos" className="w-full flex-1 flex flex-col min-h-0">
                <div className="space-y-1 mb-2">
                    <TabsList className="w-full">
                        <TabsTrigger value="videos" className="flex-1 text-xs">Videos</TabsTrigger>
                        <TabsTrigger value="audios" className="flex-1 text-xs">Audio</TabsTrigger>
                    </TabsList>
                    <TabsList className="w-full">
                        <TabsTrigger value="text" className="flex-1 text-xs">Text</TabsTrigger>
                        <TabsTrigger value="shapes" className="flex-1 text-xs">Shapes</TabsTrigger>
                    </TabsList>
                </div>
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
                
                {/* Shapes Tab */}
                <TabsContent value="shapes" className="flex-1 overflow-y-auto">
                    {/* Add Shape Form */}
                    <div className="p-2 border rounded mb-3 bg-gray-50">
                        <div className="text-xs font-semibold mb-2 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" /> Add Shape
                        </div>
                        <div className="mb-2">
                            <label className="text-[10px] text-gray-500">Name (optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. Pointer 1"
                                value={newShapeName}
                                onChange={(e) => setNewShapeName(e.target.value)}
                                className="w-full p-1 text-xs border rounded"
                            />
                        </div>
                        <div className="mb-2">
                            <label className="text-[10px] text-gray-500">Type</label>
                            <select
                                value={newShapeType}
                                onChange={(e) => setNewShapeType(e.target.value as 'line' | 'arrow')}
                                className="w-full p-1 text-xs border rounded"
                            >
                                <option value="arrow">Arrow</option>
                                <option value="line">Line</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Start (s)</label>
                                <input
                                    type="number"
                                    value={newShapeStartTime}
                                    onChange={(e) => setNewShapeStartTime(parseFloat(e.target.value) || 0)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">End (s)</label>
                                <input
                                    type="number"
                                    value={newShapeEndTime}
                                    onChange={(e) => setNewShapeEndTime(parseFloat(e.target.value) || 0)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    step="0.1"
                                />
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1">Start Point</div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">X1 %</label>
                                <input
                                    type="number"
                                    value={newShapeX1}
                                    onChange={(e) => setNewShapeX1(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Y1 %</label>
                                <input
                                    type="number"
                                    value={newShapeY1}
                                    onChange={(e) => setNewShapeY1(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                />
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1">End Point</div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">X2 %</label>
                                <input
                                    type="number"
                                    value={newShapeX2}
                                    onChange={(e) => setNewShapeX2(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Y2 %</label>
                                <input
                                    type="number"
                                    value={newShapeY2}
                                    onChange={(e) => setNewShapeY2(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                    className="w-full p-1 text-xs border rounded"
                                    min="0"
                                    max="100"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 mb-2">
                            <div>
                                <label className="text-[10px] text-gray-500">Width</label>
                                <input
                                    type="number"
                                    value={newShapeWidth}
                                    onChange={(e) => setNewShapeWidth(parseInt(e.target.value) || 3)}
                                    className="w-full p-1 text-xs border rounded"
                                    min="1"
                                    max="20"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500">Color</label>
                                <input
                                    type="color"
                                    value={newShapeColor}
                                    onChange={(e) => setNewShapeColor(e.target.value)}
                                    className="w-full h-6 border rounded cursor-pointer"
                                />
                            </div>
                        </div>
                        <Button onClick={handleAddShape} size="sm" className="w-full">
                            <Plus className="w-3 h-3 mr-1" /> Add {newShapeType === 'arrow' ? 'Arrow' : 'Line'}
                        </Button>
                    </div>
                    
                    {/* Existing Shapes */}
                    {shapeOverlays.map(shape => (
                        <div key={shape.id} className="p-2 border mb-2 rounded bg-white">
                            {editingShapeId === shape.id ? (
                                // Edit Mode
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] text-gray-500">Name</label>
                                        <input
                                            type="text"
                                            value={editShapeName}
                                            onChange={(e) => setEditShapeName(e.target.value)}
                                            className="w-full p-1 text-xs border rounded"
                                            placeholder="Shape name"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500">Type</label>
                                        <select
                                            value={editShapeType}
                                            onChange={(e) => setEditShapeType(e.target.value as 'line' | 'arrow')}
                                            className="w-full p-1 text-xs border rounded"
                                        >
                                            <option value="arrow">Arrow</option>
                                            <option value="line">Line</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Start (s)</label>
                                            <input
                                                type="number"
                                                value={editShapeStartTime}
                                                onChange={(e) => setEditShapeStartTime(parseFloat(e.target.value) || 0)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                step="0.1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">End (s)</label>
                                            <input
                                                type="number"
                                                value={editShapeEndTime}
                                                onChange={(e) => setEditShapeEndTime(parseFloat(e.target.value) || 0)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">X1 %</label>
                                            <input
                                                type="number"
                                                value={editShapeX1}
                                                onChange={(e) => setEditShapeX1(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Y1 %</label>
                                            <input
                                                type="number"
                                                value={editShapeY1}
                                                onChange={(e) => setEditShapeY1(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">X2 %</label>
                                            <input
                                                type="number"
                                                value={editShapeX2}
                                                onChange={(e) => setEditShapeX2(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Y2 %</label>
                                            <input
                                                type="number"
                                                value={editShapeY2}
                                                onChange={(e) => setEditShapeY2(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                className="w-full p-1 text-xs border rounded"
                                                min="0"
                                                max="100"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Width</label>
                                            <input
                                                type="number"
                                                value={editShapeWidth}
                                                onChange={(e) => setEditShapeWidth(parseInt(e.target.value) || 3)}
                                                className="w-full p-1 text-xs border rounded"
                                                min="1"
                                                max="20"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Color</label>
                                            <input
                                                type="color"
                                                value={editShapeColor}
                                                onChange={(e) => setEditShapeColor(e.target.value)}
                                                className="w-full h-6 border rounded cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button onClick={saveShapeEdit} size="sm" className="flex-1">
                                            <Check className="w-3 h-3 mr-1" /> Save
                                        </Button>
                                        <Button onClick={cancelShapeEdit} size="sm" variant="outline" className="flex-1">
                                            <X className="w-3 h-3 mr-1" /> Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                // View Mode
                                <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium flex items-center gap-1 truncate">
                                            {shape.type === 'arrow' ? <ArrowRight className="w-3 h-3 flex-shrink-0" /> : <Minus className="w-3 h-3 flex-shrink-0" />}
                                            {shape.name || (shape.type === 'arrow' ? 'Arrow' : 'Line')}
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            {shape.start_time}s - {shape.end_time}s
                                        </div>
                                        <div className="text-[10px] text-gray-500">
                                            ({shape.x1}%, {shape.y1}%) → ({shape.x2}%, {shape.y2}%)
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => startEditingShape(shape)}
                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteShapeOverlay(shape.id)}
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

