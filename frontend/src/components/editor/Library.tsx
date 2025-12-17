import React, { useState, useRef, useEffect } from 'react';
import { UploadResponse, TextOverlay, ShapeOverlay } from '@/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Pencil, Check, X, ArrowRight, Minus, Type, Mic, Square, Settings, Upload, Monitor, Video } from 'lucide-react';

interface AudioDevice {
    deviceId: string;
    label: string;
}

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
    onDragStart: (item: UploadResponse) => void;
    onDragEnd: () => void;
}

export function Library({ items, textOverlays, shapeOverlays, onUpload, onAddToTimeline, onRecordAudio, onAddTextOverlay, onUpdateTextOverlay, onDeleteTextOverlay, onAddShapeOverlay, onUpdateShapeOverlay, onDeleteShapeOverlay, onDragStart, onDragEnd }: LibraryProps) {
    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [showRecordingSettings, setShowRecordingSettings] = useState(false);
    const [recordingVolume, setRecordingVolume] = useState(100);
    const [noiseReduction, setNoiseReduction] = useState(50);
    const [tempVolume, setTempVolume] = useState(100);
    const [tempNoiseReduction, setTempNoiseReduction] = useState(50);

    // Microphone selection state
    const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [tempDeviceId, setTempDeviceId] = useState<string>('');

    // Audio recording refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Screen recording state
    const [isScreenRecording, setIsScreenRecording] = useState(false);
    const [showScreenRecordingSettings, setShowScreenRecordingSettings] = useState(false);
    const [screenRecordingMicId, setScreenRecordingMicId] = useState<string>('');
    const [tempScreenMicId, setTempScreenMicId] = useState<string>('');
    const [includeAudio, setIncludeAudio] = useState(true);
    const [tempIncludeAudio, setTempIncludeAudio] = useState(true);

    // Screen recording refs
    const screenRecorderRef = useRef<MediaRecorder | null>(null);
    const screenChunksRef = useRef<Blob[]>([]);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Load available audio devices
    const loadAudioDevices = async () => {
        try {
            // Request permission first to get device labels
            await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices
                .filter(device => device.kind === 'audioinput')
                .map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `Microphone ${index + 1}`
                }));
            
            setAudioDevices(audioInputs);
            
            // Set default device if none selected
            if (!selectedDeviceId && audioInputs.length > 0) {
                setSelectedDeviceId(audioInputs[0].deviceId);
            }
        } catch (err) {
            console.error('Error loading audio devices:', err);
        }
    };

    // Load devices when settings modal opens
    useEffect(() => {
        if (showRecordingSettings) {
            loadAudioDevices();
        }
    }, [showRecordingSettings]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
        }
    };

    const openRecordingSettings = () => {
        setTempVolume(recordingVolume);
        setTempNoiseReduction(noiseReduction);
        setTempDeviceId(selectedDeviceId);
        setShowRecordingSettings(true);
    };

    const saveRecordingSettings = () => {
        setRecordingVolume(tempVolume);
        setNoiseReduction(tempNoiseReduction);
        setSelectedDeviceId(tempDeviceId);
        setShowRecordingSettings(false);
    };

    const startRecording = async () => {
        try {
            const audioConstraints: MediaTrackConstraints = {
                autoGainControl: noiseReduction > 0,
                noiseSuppression: noiseReduction > 30,
                echoCancellation: noiseReduction > 50,
                channelCount: 1,
                sampleRate: 48000
            };
            
            // Use selected device if available
            if (selectedDeviceId) {
                audioConstraints.deviceId = { exact: selectedDeviceId };
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: audioConstraints
            });
            
            streamRef.current = stream;
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            
            const source = audioContext.createMediaStreamSource(stream);
            const gainNode = audioContext.createGain();
            gainNode.gain.value = recordingVolume / 100;
            
            const destination = audioContext.createMediaStreamDestination();
            
            if (noiseReduction > 20) {
                const highpassFilter = audioContext.createBiquadFilter();
                highpassFilter.type = 'highpass';
                highpassFilter.frequency.value = 80 + (noiseReduction * 0.5);
                source.connect(highpassFilter);
                highpassFilter.connect(gainNode);
            } else {
                source.connect(gainNode);
            }
            
            gainNode.connect(destination);
            
            const mediaRecorder = new MediaRecorder(destination.stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
                if (audioContextRef.current) {
                    audioContextRef.current.close();
                    audioContextRef.current = null;
                }
                
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
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        }
    };

    // Screen Recording Settings
    const openScreenRecordingSettings = () => {
        setTempScreenMicId(screenRecordingMicId);
        setTempIncludeAudio(includeAudio);
        loadAudioDevices();
        setShowScreenRecordingSettings(true);
    };

    const saveScreenRecordingSettings = () => {
        setScreenRecordingMicId(tempScreenMicId);
        setIncludeAudio(tempIncludeAudio);
        setShowScreenRecordingSettings(false);
    };

    const startScreenRecording = async () => {
        try {
            // Get screen/display stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'monitor'
                },
                audio: false // We'll handle audio separately for better control
            });

            screenStreamRef.current = screenStream;
            
            let combinedStream = screenStream;

            // If audio is enabled, get microphone stream and combine
            if (includeAudio) {
                try {
                    // Use specific device if selected, otherwise use default microphone
                    const audioConstraints: MediaTrackConstraints = screenRecordingMicId 
                        ? { deviceId: { exact: screenRecordingMicId } }
                        : true;
                    
                    const micStream = await navigator.mediaDevices.getUserMedia({
                        audio: audioConstraints
                    });
                    micStreamRef.current = micStream;

                    // Combine video from screen and audio from mic
                    const tracks = [
                        ...screenStream.getVideoTracks(),
                        ...micStream.getAudioTracks()
                    ];
                    combinedStream = new MediaStream(tracks);
                } catch (micErr) {
                    console.warn('Could not access microphone for screen recording:', micErr);
                    // Continue with screen only
                }
            }

            const screenRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9'
            });
            screenRecorderRef.current = screenRecorder;
            screenChunksRef.current = [];

            screenRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    screenChunksRef.current.push(event.data);
                }
            };

            screenRecorder.onstop = async () => {
                const videoBlob = new Blob(screenChunksRef.current, { type: 'video/webm' });
                
                // Clean up streams
                if (screenStreamRef.current) {
                    screenStreamRef.current.getTracks().forEach(track => track.stop());
                    screenStreamRef.current = null;
                }
                if (micStreamRef.current) {
                    micStreamRef.current.getTracks().forEach(track => track.stop());
                    micStreamRef.current = null;
                }

                // Create a File object from the blob
                const file = new File([videoBlob], `screen-recording-${Date.now()}.webm`, {
                    type: 'video/webm'
                });
                
                // Upload the recording
                onUpload(file);
                setIsScreenRecording(false);
            };

            // Handle when user stops sharing via browser UI
            screenStream.getVideoTracks()[0].onended = () => {
                if (isScreenRecording) {
                    stopScreenRecording();
                }
            };

            screenRecorder.start();
            setIsScreenRecording(true);
        } catch (err) {
            console.error('Error starting screen recording:', err);
            alert('Could not start screen recording. Please ensure you have granted permission.');
        }
    };

    const stopScreenRecording = () => {
        if (screenRecorderRef.current && isScreenRecording) {
            if (screenRecorderRef.current.state !== 'inactive') {
                screenRecorderRef.current.stop();
            }
        }
    };

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

    // Tailwind color palette - designer recommended colors
    const tailwindColors: { name: string; shades: { shade: string; hex: string }[] }[] = [
        {
            name: 'Slate',
            shades: [
                { shade: '50', hex: '#f8fafc' }, { shade: '100', hex: '#f1f5f9' }, { shade: '200', hex: '#e2e8f0' },
                { shade: '300', hex: '#cbd5e1' }, { shade: '400', hex: '#94a3b8' }, { shade: '500', hex: '#64748b' },
                { shade: '600', hex: '#475569' }, { shade: '700', hex: '#334155' }, { shade: '800', hex: '#1e293b' },
                { shade: '900', hex: '#0f172a' }, { shade: '950', hex: '#020617' }
            ]
        },
        {
            name: 'Red',
            shades: [
                { shade: '50', hex: '#fef2f2' }, { shade: '100', hex: '#fee2e2' }, { shade: '200', hex: '#fecaca' },
                { shade: '300', hex: '#fca5a5' }, { shade: '400', hex: '#f87171' }, { shade: '500', hex: '#ef4444' },
                { shade: '600', hex: '#dc2626' }, { shade: '700', hex: '#b91c1c' }, { shade: '800', hex: '#991b1b' },
                { shade: '900', hex: '#7f1d1d' }, { shade: '950', hex: '#450a0a' }
            ]
        },
        {
            name: 'Orange',
            shades: [
                { shade: '50', hex: '#fff7ed' }, { shade: '100', hex: '#ffedd5' }, { shade: '200', hex: '#fed7aa' },
                { shade: '300', hex: '#fdba74' }, { shade: '400', hex: '#fb923c' }, { shade: '500', hex: '#f97316' },
                { shade: '600', hex: '#ea580c' }, { shade: '700', hex: '#c2410c' }, { shade: '800', hex: '#9a3412' },
                { shade: '900', hex: '#7c2d12' }, { shade: '950', hex: '#431407' }
            ]
        },
        {
            name: 'Yellow',
            shades: [
                { shade: '50', hex: '#fefce8' }, { shade: '100', hex: '#fef9c3' }, { shade: '200', hex: '#fef08a' },
                { shade: '300', hex: '#fde047' }, { shade: '400', hex: '#facc15' }, { shade: '500', hex: '#eab308' },
                { shade: '600', hex: '#ca8a04' }, { shade: '700', hex: '#a16207' }, { shade: '800', hex: '#854d0e' },
                { shade: '900', hex: '#713f12' }, { shade: '950', hex: '#422006' }
            ]
        },
        {
            name: 'Green',
            shades: [
                { shade: '50', hex: '#f0fdf4' }, { shade: '100', hex: '#dcfce7' }, { shade: '200', hex: '#bbf7d0' },
                { shade: '300', hex: '#86efac' }, { shade: '400', hex: '#4ade80' }, { shade: '500', hex: '#22c55e' },
                { shade: '600', hex: '#16a34a' }, { shade: '700', hex: '#15803d' }, { shade: '800', hex: '#166534' },
                { shade: '900', hex: '#14532d' }, { shade: '950', hex: '#052e16' }
            ]
        },
        {
            name: 'Cyan',
            shades: [
                { shade: '50', hex: '#ecfeff' }, { shade: '100', hex: '#cffafe' }, { shade: '200', hex: '#a5f3fc' },
                { shade: '300', hex: '#67e8f9' }, { shade: '400', hex: '#22d3ee' }, { shade: '500', hex: '#06b6d4' },
                { shade: '600', hex: '#0891b2' }, { shade: '700', hex: '#0e7490' }, { shade: '800', hex: '#155e75' },
                { shade: '900', hex: '#164e63' }, { shade: '950', hex: '#083344' }
            ]
        },
        {
            name: 'Blue',
            shades: [
                { shade: '50', hex: '#eff6ff' }, { shade: '100', hex: '#dbeafe' }, { shade: '200', hex: '#bfdbfe' },
                { shade: '300', hex: '#93c5fd' }, { shade: '400', hex: '#60a5fa' }, { shade: '500', hex: '#3b82f6' },
                { shade: '600', hex: '#2563eb' }, { shade: '700', hex: '#1d4ed8' }, { shade: '800', hex: '#1e40af' },
                { shade: '900', hex: '#1e3a8a' }, { shade: '950', hex: '#172554' }
            ]
        },
        {
            name: 'Violet',
            shades: [
                { shade: '50', hex: '#f5f3ff' }, { shade: '100', hex: '#ede9fe' }, { shade: '200', hex: '#ddd6fe' },
                { shade: '300', hex: '#c4b5fd' }, { shade: '400', hex: '#a78bfa' }, { shade: '500', hex: '#8b5cf6' },
                { shade: '600', hex: '#7c3aed' }, { shade: '700', hex: '#6d28d9' }, { shade: '800', hex: '#5b21b6' },
                { shade: '900', hex: '#4c1d95' }, { shade: '950', hex: '#2e1065' }
            ]
        },
        {
            name: 'Pink',
            shades: [
                { shade: '50', hex: '#fdf2f8' }, { shade: '100', hex: '#fce7f3' }, { shade: '200', hex: '#fbcfe8' },
                { shade: '300', hex: '#f9a8d4' }, { shade: '400', hex: '#f472b6' }, { shade: '500', hex: '#ec4899' },
                { shade: '600', hex: '#db2777' }, { shade: '700', hex: '#be185d' }, { shade: '800', hex: '#9d174d' },
                { shade: '900', hex: '#831843' }, { shade: '950', hex: '#500724' }
            ]
        }
    ];

    // Quick pick colors (most commonly used)
    const quickColors = [
        '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
        '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    // State for showing color palette popups
    const [showColorPalette, setShowColorPalette] = useState<string | null>(null);

    // Color Picker Component with Tailwind Palette
    const ColorPickerWithPalette = ({ 
        value, 
        onChange, 
        id 
    }: { 
        value: string; 
        onChange: (color: string) => void; 
        id: string;
    }) => (
        <div className="relative">
            <div className="flex gap-1 items-center">
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-6 border rounded cursor-pointer"
                    title="Custom color picker"
                />
                <button
                    type="button"
                    onClick={() => setShowColorPalette(showColorPalette === id ? null : id)}
                    className="flex-1 h-6 px-2 text-[10px] border rounded hover:bg-gray-100 flex items-center justify-center gap-1"
                    title="Show recommended colors"
                >
                    <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: value }}></span>
                    Palette
                </button>
            </div>
            
            {showColorPalette === id && (
                <div className="fixed z-[9999] bg-white border rounded-lg shadow-2xl p-3 w-64" style={{ marginLeft: '60px', marginTop: '-10px' }}>
                    <div className="text-[10px] text-gray-500 mb-2 font-medium">
                        ✨ Designer-recommended colors from Tailwind
                    </div>
                    
                    {/* Quick Pick Row */}
                    <div className="mb-2">
                        <div className="text-[9px] text-gray-400 mb-1">Quick Pick</div>
                        <div className="flex gap-1">
                            {quickColors.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => { onChange(color); setShowColorPalette(null); }}
                                    className={`w-5 h-5 rounded border-2 hover:scale-110 transition-transform ${
                                        value === color ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-300'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                    
                    {/* Full Palette */}
                    <div className="max-h-48 overflow-y-auto">
                        {tailwindColors.map(colorGroup => (
                            <div key={colorGroup.name} className="mb-1">
                                <div className="text-[9px] text-gray-400 mb-0.5">{colorGroup.name}</div>
                                <div className="flex gap-0.5">
                                    {colorGroup.shades.filter((_, i) => i % 2 === 0 || i === colorGroup.shades.length - 1).map(shade => (
                                        <button
                                            key={shade.hex}
                                            type="button"
                                            onClick={() => { onChange(shade.hex); setShowColorPalette(null); }}
                                            className={`w-4 h-4 rounded-sm border hover:scale-125 transition-transform ${
                                                value === shade.hex ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'
                                            }`}
                                            style={{ backgroundColor: shade.hex }}
                                            title={`${colorGroup.name} ${shade.shade}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-2 pt-2 border-t">
                        <div className="text-[9px] text-gray-400">
                            Or use the color picker for custom colors
                        </div>
                    </div>
                    
                    <button 
                        type="button"
                        onClick={() => setShowColorPalette(null)}
                        className="absolute top-1 right-1 text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}
        </div>
    );

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
            {/* Recording Settings Modal */}
            {showRecordingSettings && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="font-semibold text-lg mb-4">Recording Settings</h3>
                        
                        {/* Microphone Selection */}
                        <div className="mb-4">
                            <label className="text-sm text-gray-600 block mb-2">
                                <Mic className="w-4 h-4 inline mr-1" />
                                Microphone
                            </label>
                            <select
                                value={tempDeviceId}
                                onChange={(e) => setTempDeviceId(e.target.value)}
                                className="w-full p-2 text-sm border rounded bg-white"
                            >
                                {audioDevices.length === 0 ? (
                                    <option value="">Loading microphones...</option>
                                ) : (
                                    audioDevices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label}
                                        </option>
                                    ))
                                )}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                                {audioDevices.length} microphone{audioDevices.length !== 1 ? 's' : ''} available
                            </p>
                        </div>
                        
                        {/* Volume Control */}
                        <div className="mb-4">
                            <label className="text-sm text-gray-600 block mb-2">
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
                                    className="w-16 p-1 text-sm border rounded text-center"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">100% = normal, 200% = 2x boost</p>
                        </div>
                        
                        {/* Noise Reduction Control */}
                        <div className="mb-6">
                            <label className="text-sm text-gray-600 block mb-2">
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
                                    className="w-16 p-1 text-sm border rounded text-center"
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Higher = more noise filtering</p>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button onClick={saveRecordingSettings} className="flex-1">
                                <Check className="w-4 h-4 mr-1" /> Save
                            </Button>
                            <Button onClick={() => setShowRecordingSettings(false)} variant="outline" className="flex-1">
                                <X className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Screen Recording Settings Modal */}
            {showScreenRecordingSettings && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-96">
                        <h3 className="font-semibold text-lg mb-4">
                            <Monitor className="w-5 h-5 inline mr-2" />
                            Screen Recording Settings
                        </h3>
                        
                        <p className="text-sm text-gray-500 mb-4">
                            When you start recording, your browser will ask you to select which screen or window to record.
                        </p>
                        
                        {/* Include Audio Toggle */}
                        <div className="mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={tempIncludeAudio}
                                    onChange={(e) => setTempIncludeAudio(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm text-gray-700">Include microphone audio</span>
                            </label>
                        </div>
                        
                        {/* Microphone Selection (only shown if audio is enabled) */}
                        {tempIncludeAudio && (
                            <div className="mb-4">
                                <label className="text-sm text-gray-600 block mb-2">
                                    <Mic className="w-4 h-4 inline mr-1" />
                                    Microphone
                                </label>
                                <select
                                    value={tempScreenMicId}
                                    onChange={(e) => setTempScreenMicId(e.target.value)}
                                    className="w-full p-2 text-sm border rounded bg-white"
                                >
                                    {audioDevices.length === 0 ? (
                                        <option value="">Loading microphones...</option>
                                    ) : (
                                        audioDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    {audioDevices.length} microphone{audioDevices.length !== 1 ? 's' : ''} available
                                </p>
                            </div>
                        )}
                        
                        <div className="flex gap-2">
                            <Button onClick={saveScreenRecordingSettings} className="flex-1">
                                <Check className="w-4 h-4 mr-1" /> Save
                            </Button>
                            <Button onClick={() => setShowScreenRecordingSettings(false)} variant="outline" className="flex-1">
                                <X className="w-4 h-4 mr-1" /> Cancel
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
                    {/* Upload Media Button */}
                    <div className="mb-2">
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            className="hidden" 
                            id="video-file-upload" 
                        />
                        <Button asChild className="w-full" size="sm">
                            <label htmlFor="video-file-upload" className="cursor-pointer flex items-center justify-center">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Media
                            </label>
                        </Button>
                    </div>
                    
                    {/* Record Screen Button */}
                    <div className="mb-3 flex gap-1">
                        <Button 
                            onClick={() => isScreenRecording ? stopScreenRecording() : startScreenRecording()}
                            variant={isScreenRecording ? "destructive" : "outline"}
                            size="sm"
                            className={`flex-1 ${isScreenRecording ? 'animate-pulse' : ''}`}
                        >
                            {isScreenRecording ? (
                                <>
                                    <Square className="w-3 h-3 mr-1" />
                                    Stop Recording
                                </>
                            ) : (
                                <>
                                    <Monitor className="w-3 h-3 mr-1" />
                                    Record Screen
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={openScreenRecordingSettings}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Screen Recording Settings"
                            disabled={isScreenRecording}
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    {videos.map(item => (
                         <div 
                             key={item.id} 
                             className="p-2 border mb-2 rounded cursor-grab hover:bg-gray-100 active:cursor-grabbing transition-opacity"
                             draggable
                             onDragStart={(e) => {
                                 e.dataTransfer.setData('application/json', JSON.stringify(item));
                                 e.dataTransfer.effectAllowed = 'copy';
                                 
                                 // Notify parent of drag start
                                 onDragStart(item);
                                 
                                 // Reduce opacity of the source element
                                 (e.target as HTMLElement).style.opacity = '0.4';
                                 
                                 // Create semi-transparent drag ghost with white tint
                                 const ghost = (e.target as HTMLElement).cloneNode(true) as HTMLElement;
                                 ghost.style.opacity = '0.25';
                                 ghost.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                                 ghost.style.position = 'absolute';
                                 ghost.style.top = '-1000px';
                                 ghost.style.pointerEvents = 'none';
                                 ghost.style.borderRadius = '4px';
                                 ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                 document.body.appendChild(ghost);
                                 e.dataTransfer.setDragImage(ghost, 0, 0);
                                 // Clean up ghost after drag starts
                                 setTimeout(() => document.body.removeChild(ghost), 0);
                             }}
                             onDragEnd={(e) => {
                                 // Restore opacity
                                 (e.target as HTMLElement).style.opacity = '1';
                                 onDragEnd();
                             }}
                             onClick={() => onAddToTimeline(item)}
                         >
                             <div className="text-sm font-medium truncate">{item.filename}</div>
                             <div className="text-xs text-gray-500">Video • {item.duration.toFixed(1)}s</div>
                         </div>
                    ))}
                </TabsContent>
                <TabsContent value="audios" className="flex-1 overflow-y-auto">
                    {/* Upload Media Button */}
                    <div className="mb-2">
                        <input 
                            type="file" 
                            onChange={handleFileChange} 
                            className="hidden" 
                            id="audio-file-upload" 
                        />
                        <Button asChild className="w-full" size="sm">
                            <label htmlFor="audio-file-upload" className="cursor-pointer flex items-center justify-center">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Media
                            </label>
                        </Button>
                    </div>
                    
                    {/* Record Audio Button */}
                    <div className="mb-3 flex gap-1">
                        <Button 
                            onClick={() => isRecording ? stopRecording() : startRecording()}
                            variant={isRecording ? "destructive" : "outline"}
                            size="sm"
                            className={`flex-1 ${isRecording ? 'animate-pulse' : ''}`}
                        >
                            {isRecording ? (
                                <>
                                    <Square className="w-3 h-3 mr-1" />
                                    Stop Recording
                                </>
                            ) : (
                                <>
                                    <Mic className="w-3 h-3 mr-1" />
                                    Record Audio
                                </>
                            )}
                        </Button>
                        <Button
                            onClick={openRecordingSettings}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            title="Recording Settings"
                            disabled={isRecording}
                        >
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>
                    
                    {audios.map(item => (
                         <div 
                             key={item.id} 
                             className="p-2 border mb-2 rounded cursor-grab hover:bg-gray-100 active:cursor-grabbing transition-opacity"
                             draggable
                             onDragStart={(e) => {
                                 e.dataTransfer.setData('application/json', JSON.stringify(item));
                                 e.dataTransfer.effectAllowed = 'copy';
                                 
                                 // Notify parent of drag start
                                 onDragStart(item);
                                 
                                 // Reduce opacity of the source element
                                 (e.target as HTMLElement).style.opacity = '0.4';
                                 
                                 // Create semi-transparent drag ghost with white tint
                                 const ghost = (e.target as HTMLElement).cloneNode(true) as HTMLElement;
                                 ghost.style.opacity = '0.25';
                                 ghost.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                                 ghost.style.position = 'absolute';
                                 ghost.style.top = '-1000px';
                                 ghost.style.pointerEvents = 'none';
                                 ghost.style.borderRadius = '4px';
                                 ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                                 document.body.appendChild(ghost);
                                 e.dataTransfer.setDragImage(ghost, 0, 0);
                                 // Clean up ghost after drag starts
                                 setTimeout(() => document.body.removeChild(ghost), 0);
                             }}
                             onDragEnd={(e) => {
                                 // Restore opacity
                                 (e.target as HTMLElement).style.opacity = '1';
                                 onDragEnd();
                             }}
                             onClick={() => onAddToTimeline(item)}
                         >
                             <div className="text-sm font-medium truncate">{item.filename}</div>
                             <div className="text-xs text-gray-500">Audio • {item.duration.toFixed(1)}s</div>
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
                                <ColorPickerWithPalette 
                                    value={newColor} 
                                    onChange={setNewColor} 
                                    id="new-text-color" 
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
                                            <ColorPickerWithPalette 
                                                value={editColor} 
                                                onChange={setEditColor} 
                                                id="edit-text-color" 
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
                                <ColorPickerWithPalette 
                                    value={newShapeColor} 
                                    onChange={setNewShapeColor} 
                                    id="new-shape-color" 
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
                                            <ColorPickerWithPalette 
                                                value={editShapeColor} 
                                                onChange={setEditShapeColor} 
                                                id="edit-shape-color" 
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

