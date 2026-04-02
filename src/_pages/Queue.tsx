import React, { useState, useEffect, useRef, useCallback } from "react"
import {
    Play, Pause, Square, ChevronDown, ChevronUp, ChevronRight,
    X, Mic, Monitor, Zap, Send,
    Loader2, Sparkles, MessageSquare, History,
    GripHorizontal, HelpCircle, MessageCircleQuestion, FileText,
    Scaling, Copy, Check, CheckCheck, Trash2, Mail,
    Calendar, Clock, ArrowRight, AlertCircle, Upload, UserCog,
    Eye, EyeOff, MessageCircle, Terminal, Edit2, RefreshCw, Plus, Maximize,
    Video, Image, Code, Maximize2, Download
} from "lucide-react"
import moubelyIcon from "../../assets/Moubely_icon.png"

// --- IMPORTS FOR FORMULAS & HIGHLIGHTING ---
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';

import 'highlight.js/styles/atom-one-dark.css';
import { SkeletonMedia } from "../components/ui/SkeletonMedia";

// --- TYPES ---
interface ScreenshotData {
    path: string;
    preview: string;
}

interface Message {
    id: string
    role: "user" | "ai"
    text: string
    queuedScreenshots?: ScreenshotData[];
    queuedAttachments?: { name: string; path: string; type: string, localPath?: string }[];
    timestamp: number
    isStreaming?: boolean
    isMedia?: boolean
}

interface TranscriptItem {
    id: string
    text: string
    timestamp: number
    displayTime: string
}

interface MeetingSession {
    id: string
    date: number
    transcript: TranscriptItem[]
    emailDraft: string
    title?: string
}

interface ChatSession {
    id: string;
    date: number;
    prompt: string;
    response: string;
    messages?: Message[];
    images?: ScreenshotData[];
    lastMedia?: { path: string; type: string; localPath?: string };
}

interface ChatContext {
    isInMeeting: boolean;
    uploadedFilesContent: string;
    meetingTranscript: string;
    userImage?: string;
}

// --- HELPERS ---
const truncateToWords = (text: string, limit: number) => {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= limit) return text;
    return words.slice(0, limit).join(' ') + '...';
};

// --- TITLE CLEANER UTILITY ---
const cleanMeetingTitle = (rawTitle: string): string => {
    if (!rawTitle) return "Untitled Meeting";
    return rawTitle
        .replace(/[#*`"']/g, '')
        .replace(/^Title:\s*/i, '')
        .replace(/Meeting Title:\s*/i, '')
        .trim();
};

const preparePayload = (userMessage: string, context: ChatContext) => {
    let systemInstruction = "";
    let dataToSend = "";

    if (context.userImage) {
        systemInstruction = `
      You are an expert Coding Assistant with Vision capabilities.
      The user has attached an image/screenshot.

      INSTRUCTIONS:
      1. FIRST, answer the USER'S QUESTION directly. Do not ignore the text prompt.
      2. SECOND, analyze the image to support your answer or provide context.
      3. Use LaTeX for math formulas (e.g., $A = \\pi r^2$).
      4. Use **bold** to highlight key variables or terms.
      5. If the image contains code, analyze it for bugs or improvements.
    `;
        if (!userMessage || !userMessage.trim()) {
            userMessage = "Analyze this screen and describe what is shown.";
        }
    }
    else if (context.isInMeeting) {
        systemInstruction = `
      You are a Technical Interview Assistant. 
      The user is currently in a live coding interview or meeting. 
      Use the provided CONTEXT (files and transcript) to answer the user's question.
      
      RULES:
      - Focus STRICTLY on the code, algorithm, or behavioral questions found in the context.
      - Use LaTeX for time complexity (e.g., $O(n)$) and math formulas.
      - Use **bold** for key variable names or terms to emphasize them.
    `;
        dataToSend = `CONTEXT FROM FILES:\n${context.uploadedFilesContent}\n\nLIVE TRANSCRIPT:\n${context.meetingTranscript}`;
    }
    else {
        systemInstruction = "You are a helpful assistant for the Moubely application. Use LaTeX for math formulas. Use **bold** to highlight key terms or variables.";
    }

    const finalPrompt = `${systemInstruction}\n\n${dataToSend ? dataToSend + "\n\n" : ""}USER QUESTION: ${userMessage}`;
    return finalPrompt;
};

// --- HELPER: Recursively extract text from React children ---
const extractTextFromChildren = (children: any): string => {
    if (typeof children === 'string') return children;
    if (typeof children === 'number') return String(children);
    if (Array.isArray(children)) {
        return children.map(extractTextFromChildren).join('');
    }
    if (children && children.props && children.props.children) {
        return extractTextFromChildren(children.props.children);
    }
    return '';
};

// --- VISUALIZER COMPONENT ---
const AudioVisualizer = ({ audioContext, source }: { audioContext: AudioContext | null, source: MediaStreamAudioSourceNode | null }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number>();

    useEffect(() => {
        if (!audioContext || !source || !canvasRef.current) return;

        if (!analyserRef.current) {
            try {
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 64;
                source.connect(analyser);
                analyserRef.current = analyser;
            } catch (e) { return; }
        }

        const analyser = analyserRef.current;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const draw = () => {
            if (!ctx) return;
            rafRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = dataArray[i] / 2;
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [audioContext, source]);

    return <canvas ref={canvasRef} width={200} height={40} className="w-32 h-8 opacity-80" />;
};

// --- HELPER: Message Content Renderer ---
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
    return (
        <div className="text-[14px] leading-relaxed text-gray-200 markdown-content">
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                    h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2 text-blue-400 border-b border-white/10 pb-2">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2 text-purple-300">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-md font-semibold mt-2 mb-1 text-gray-100 uppercase tracking-wide opacity-80">{children}</h3>,
                    strong: ({ children }) => <strong className="font-bold text-yellow-400">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc ml-5 my-2 space-y-1 text-gray-300">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-5 my-2 space-y-1 text-gray-300">{children}</ol>,
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500/50 pl-4 my-2 italic text-gray-400 bg-white/5 py-1 rounded-r">{children}</blockquote>,
                    div: ({ node, className, children, ...props }) => {
                        return <div className={`my-4 p-2 rounded-lg text-center overflow-x-auto ${className || ''}`} {...props}>{children}</div>
                    },
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4 border border-white/10 rounded-xl bg-white/5 shadow-sm">
                            <table className="w-full text-left border-collapse text-sm" {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-white/5 text-gray-100" {...props} />,
                    th: ({ node, ...props }) => <th className="p-3 border-b border-white/10 font-semibold text-xs uppercase tracking-wider text-blue-300" {...props} />,
                    tbody: ({ node, ...props }) => <tbody className="divide-y divide-white/5" {...props} />,
                    tr: ({ node, ...props }) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
                    td: ({ node, ...props }) => <td className="p-3 text-gray-300" {...props} />,
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const codeText = extractTextFromChildren(children).replace(/\n$/, '');
                        const [isCopied, setIsCopied] = useState(false)
                        const handleCopyCode = () => {
                            navigator.clipboard.writeText(codeText)
                            setIsCopied(true)
                            setTimeout(() => setIsCopied(false), 2000)
                        }
                        return !inline ? (
                            <div className="rounded-lg overflow-hidden my-3 bg-[#1e1e1e] border border-white/10 shadow-lg group relative">
                                <div className="bg-white/5 px-3 py-1.5 text-[10px] text-gray-500 border-b border-white/5 flex justify-between items-center uppercase font-mono tracking-wider">
                                    <span>{match?.[1] || 'text'}</span>
                                    <button onClick={handleCopyCode} className="flex items-center gap-1.5 hover:text-white text-gray-400 transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded cursor-pointer">
                                        {isCopied ? <CheckCheck size={12} className="text-green-400" /> : <Copy size={12} />}
                                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                    </button>
                                </div>
                                <code className={`${className} block p-3 overflow-x-auto text-xs font-mono`} {...props}>{children}</code>
                            </div>
                        ) : (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-pink-300 text-xs font-mono border border-white/5" {...props}>{children}</code>
                        )
                    }
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
};

const CollapsibleUserMessage: React.FC<{ text: string }> = ({ text }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTruncatable, setIsTruncatable] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            // Check if scrollHeight naturally exceeds ~5 lines threshold (120px)
            if (contentRef.current.scrollHeight > 120) {
                setIsTruncatable(true);
            } else {
                setIsTruncatable(false);
            }
        }
    }, [text]);

    return (
        <div className="relative group/collapse pr-6">
            <div
                ref={contentRef}
                className={`whitespace-pre-wrap word-break-words transition-all duration-300 ease-in-out ${!isExpanded && isTruncatable ? 'line-clamp-5' : ''}`}
            >
                {text}
            </div>

            {/* Expand / Collapse Button exactly matching the User Reference Picture */}
            {isTruncatable && (
                <div className="absolute top-0 right-0 flex items-center justify-center z-10 mt-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="p-1 text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >
                        {isExpanded ? (
                            <ChevronUp size={16} />
                        ) : (
                            <ChevronDown size={16} />
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

// --- STUDENT SETUP MODAL ---
const StudentModeSetupModal = ({ open, onClose, onSave }: { open: boolean, onClose: () => void, onSave: (files: File[]) => void, mode: string }) => {
    const [files, setFiles] = useState<File[]>([]);
    if (!open) return null;
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const uploaded = Array.from(e.target.files).slice(0, 6);
            setFiles(uploaded);
        }
    };
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 interactive">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-xl font-semibold text-white mb-2">Student Mode Setup</h2>
                <p className="text-gray-400 text-sm mb-4">Upload resume or project files (max 6).</p>
                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors relative cursor-pointer">
                    <input type="file" multiple accept=".pdf,.txt,.md,.ts,.js,.py" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload size={32} className="text-blue-400 mb-2" />
                    <span className="text-sm text-gray-300">Click to upload files</span>
                </div>
                {files.length > 0 && (
                    <div className="mt-4 space-y-2">
                        {files.map((f, i) => <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 p-2 rounded"><FileText size={12} /><span className="truncate">{f.name}</span></div>)}
                    </div>
                )}
                <div className="flex gap-3 mt-6 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Skip</button>
                    <button onClick={() => onSave(files)} className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                        {files.length === 0 ? "Continue" : "Save & Enable"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- GLOBAL MEDIA RESOLUTION HELPER ---
const getResolvedMediaUrl = (file: { path: string, localPath?: string }): string => {
    let resolvedSrc = file.localPath || file.path;
    if (resolvedSrc.includes('moubely_screenshots')) {
        const decoded = decodeURIComponent(resolvedSrc.replace('moubely-local://', '').replace('moubely://', ''));
        const filename = decoded.split(/[/\\]/).pop();
        return `http://127.0.0.1:5181/screenshots/${filename}`;
    }
    if (resolvedSrc.includes('moubely_attachments')) {
        const decoded = decodeURIComponent(resolvedSrc.replace('moubely-local://', '').replace('moubely://', ''));
        const filename = decoded.split(/[/\\]/).pop();
        return `http://127.0.0.1:5181/attachments/${filename}`;
    }

    // Fallback: If it's an absolute local path without a protocol, wrap it in moubely-local://
    if (!resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('moubely') && !resolvedSrc.startsWith('data:') && (resolvedSrc.includes(':') || resolvedSrc.startsWith('/') || resolvedSrc.startsWith('\\'))) {
        return `moubely-local://${encodeURIComponent(resolvedSrc)}`;
    }

    return resolvedSrc;
};

// --- TEXT FILE PREVIEW COMPONENT ---
const TextFilePreview = ({ url }: { url: string }) => {
    const [text, setText] = useState<string>('Loading source...');
    useEffect(() => {
        fetch(url)
            .then(res => res.text())
            .then(data => setText(data.slice(0, 10000) + (data.length > 10000 ? '\n\n...[Truncated for Performance]' : '')))
            .catch(() => setText('Failed to stream text content.'));
    }, [url]);
    return <pre className="text-[11px] font-mono text-gray-300 w-full h-full p-4 overflow-auto custom-scrollbar whitespace-pre-wrap select-text text-left">{text}</pre>;
};

// --- UNIVERSAL MEDIA LIGHTBOX COMPONENT ---
const UniversalMediaLightbox = ({ file, onClose, onDownload, savedId }: {
    file: { path: string, type: string, name?: string, localPath?: string },
    onClose: () => void,
    onDownload: (url: string, name: string, id: string) => void,
    savedId: string | null
}) => {
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const src = getResolvedMediaUrl(file);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center interactive p-4 md:p-10"
            onWheel={(e) => { if (file.type === 'image') setScale(s => Math.min(Math.max(0.5, s - e.deltaY * 0.005), 5)); }}
            onPointerDown={(e) => {
                if (file.type !== 'image') return;
                isDragging.current = true;
                dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
            }}
            onPointerUp={() => isDragging.current = false}
            onPointerMove={(e) => {
                if (isDragging.current && file.type === 'image') {
                    setPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
                }
            }}
            onPointerLeave={() => isDragging.current = false}
        >
            <div className="absolute top-4 right-4 z-50 flex gap-4">
                {file.type === 'image' && (
                    <button onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur">
                        <Maximize size={20} />
                    </button>
                )}
                {(file.type === 'image' || file.type === 'video') && (
                    <button
                        onClick={() => onDownload(file.localPath || file.path, file.name || 'exported_media', 'lightbox')}
                        className={`p-2 rounded-full backdrop-blur transition-all ${savedId === 'lightbox' ? 'bg-green-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        title="Save to folder"
                    >
                        {savedId === 'lightbox' ? <Check size={20} /> : <Download size={20} />}
                    </button>
                )}
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-red-500/80 rounded-full text-white backdrop-blur transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="w-full h-full flex items-center justify-center overflow-hidden">
                {file.type === 'video' ? (
                    <video controls autoPlay src={src} className="max-w-full max-h-full rounded-lg shadow-2xl shadow-purple-500/10" />
                ) : file.type === 'pdf' ? (
                    <iframe src={`${src}#toolbar=1`} className="w-full h-full bg-white rounded-lg shadow-2xl" title="PDF Preview" />
                ) : file.type === 'image' ? (
                    <img
                        src={src}
                        className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 ease-out rounded-lg shadow-2xl"
                        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
                        alt="Fullscreen View"
                    />
                ) : file.type === 'text' ? (
                    <div className="w-[80vw] h-[80vh] flex items-start justify-start bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <TextFilePreview url={src} />
                        <div className="absolute top-4 right-6 text-xs text-white/30 font-mono select-none pointer-events-none">{file.name}</div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6 p-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-2xl">
                        <div className="p-6 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                            <Code size={64} className="text-blue-400" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xl text-white font-semibold">{file.name || 'File Preview'}</span>
                            <span className="text-xs text-gray-400 uppercase tracking-widest font-mono">Source format • {file.type}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const Queue: React.FC<any> = () => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [activeTab, setActiveTab] = useState<"Chat" | "Transcript" | "Email" | "History">("Chat")
    const [isInputFocused, setIsInputFocused] = useState(false)
    const [fullscreenFile, setFullscreenFile] = useState<{ path: string, type: string, name?: string, localPath?: string } | null>(null)
    const [hoverImage, setHoverImage] = useState<string | null>(null)
    const [hoverAttachment, setHoverAttachment] = useState<{ name: string, path: string, type: string, localPath?: string } | null>(null)
    const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)
    const [needsEmailGeneration, setNeedsEmailGeneration] = useState(false)

    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([])
    const [isThinking, setIsThinking] = useState(false)
    const [thinkingStep, setThinkingStep] = useState("")

    // --- DOWNLOAD FEEDBACK ---
    const [savedId, setSavedId] = useState<string | null>(null);

    // --- Multi-Screenshot State ---
    const [queuedScreenshots, setQueuedScreenshots] = useState<ScreenshotData[]>([]);
    const [queuedAttachments, setQueuedAttachments] = useState<{ name: string, path: string, type: string, localPath?: string }[]>([]);

    const handleAttachFile = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!window.electronAPI) return;
        try {
            const files = await window.electronAPI.openFilePicker();
            if (files && files.length > 0) {
                setQueuedAttachments(prev => [...prev, ...files]);
            }
        } catch (err) {
            console.error("Failed to attach files", err);
        }
    };

    const handleRemoveAttachedFile = (pathToRemove: string) => {
        setQueuedAttachments(prev => prev.filter(f => f.path !== pathToRemove));
        if (window.electronAPI && window.electronAPI.deleteChatFiles) {
            window.electronAPI.deleteChatFiles([pathToRemove]);
        }
    };

    // --- Slow Loader State & Timer Ref ---
    const [showSlowLoader, setShowSlowLoader] = useState(false)
    const loadingTimerRef = useRef<any>(null)

    // --- MODE STATE (PERSISTED) ---
    const [mode, setMode] = useState(() => sessionStorage.getItem("moubely_mode") || "General")
    const [showModeMenu, setShowModeMenu] = useState(false)
    const [isSmartMode, setIsSmartMode] = useState(false)

    // --- BRAIN/GENERATION MODELS ---
    const [selectedModel, setSelectedModel] = useState("imagen-4-generate");
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [isArtActive, setIsArtActive] = useState(false);

    const GENERATIVE_MODELS = [
        { id: 'imagen-4.0-generate-001', name: 'Imagen 4', type: 'image' },
        { id: 'imagen-4.0-ultra-generate-001', name: 'Imagen 4 Ultra', type: 'image' },
        { id: 'imagen-4.0-fast-generate-001', name: 'Imagen 4 Fast', type: 'image' },
        { id: 'gemini-2.5-flash-image', name: 'Nano Banana', type: 'image' },
        { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', type: 'image' },
        { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', type: 'image' },
        { id: 'veo-3.1-generate-preview', name: 'Veo 3.1', type: 'video' },
        { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', type: 'video' },
    ];

    const [isRecording, setIsRecording] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [transcriptLogs, setTranscriptLogs] = useState<TranscriptItem[]>([])
    const [showPostMeeting, setShowPostMeeting] = useState(false)
    const [emailDraft, setEmailDraft] = useState("")
    const [transcriptError, setTranscriptError] = useState<string | null>(null)
    const [meetingStartTime, setMeetingStartTime] = useState<number>(0)

    const [pastMeetings, setPastMeetings] = useState<MeetingSession[]>([])
    const [pastChats, setPastChats] = useState<ChatSession[]>([])

    // --- HISTORY MODAL STATE ---
    const [historyTab, setHistoryTab] = useState<"Chats" | "Meetings">("Chats");
    const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
    const [loadedSessionType, setLoadedSessionType] = useState<"Chat" | "Meeting" | null>(null);

    const [showStudentModal, setShowStudentModal] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    // --- DICTATION STATE ---
    const [isDictating, setIsDictating] = useState(false);
    const dictationRecorderRef = useRef<MediaRecorder | null>(null);
    const dictationChunksRef = useRef<Blob[]>([]);

    // --- MODES STATE ---
    const [isStealth, setIsStealth] = useState(false);
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [isHoveringChat, setIsHoveringChat] = useState(false);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    // --- AUDIO REFS ---
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
    const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
    const meetingStartTimeRef = useRef<number>(0)
    const transcriptLengthRef = useRef(0);

    // --- URGENCY REF ---
    const isUrgentRef = useRef(false);

    // --- SYNC SMART MODE TO URGENCY (NEW) ---
    useEffect(() => {
        isUrgentRef.current = isSmartMode;
        console.log(`[UI] ⚡ Smart Mode Toggled: ${isSmartMode ? "ON (Always Urgent)" : "OFF (Casual)"}`);
    }, [isSmartMode]);

    const chatEndRef = useRef<HTMLDivElement>(null)
    const transcriptEndRef = useRef<HTMLDivElement>(null)
    const resizeRef = useRef<{ startX: number, startY: number, startW: number, startH: number } | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const isAtBottomRef = useRef(true)
    const didJumpRef = useRef(false)

    const isExpandedRef = useRef(isExpanded);
    const isRecordingRef = useRef(isRecording);
    const isPausedRef = useRef(isPaused);

    useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);
    useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { transcriptLengthRef.current = transcriptLogs.length; }, [transcriptLogs]);

    const MAX_QUEUE_SIZE = 12;

    const handleExpandToggle = () => {
        if (window.electronAPI) {
            const nextState = !isExpanded;
            window.electronAPI.toggleExpand(nextState);
            setIsExpanded(nextState);
        } else {
            setIsExpanded(!isExpanded);
        }
    }

    // --- VOICE DICTATION LOGIC ---
    const toggleDictation = async () => {
        if (isDictating && dictationRecorderRef.current) {
            // STOP RECORDING
            if (dictationRecorderRef.current.state !== 'inactive') {
                dictationRecorderRef.current.stop();
            }
            setIsDictating(false);
            return;
        }

        // START RECORDING
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            dictationRecorderRef.current = mediaRecorder;
            dictationChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) dictationChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(dictationChunksRef.current, { type: 'audio/webm' });

                // Cleanup tracks so the mic icon disappears immediately
                stream.getTracks().forEach(track => track.stop());

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];

                    if (window.electronAPI) {
                        try {
                            const transcribedText = await window.electronAPI.transcribeDictation(base64Audio, 'audio/webm');
                            if (transcribedText && !transcribedText.startsWith("Error")) {
                                setInput(prev => {
                                    const el = textareaRef.current;
                                    if (!el) return prev + (prev.length > 0 ? " " : "") + transcribedText;

                                    const startPos = el.selectionStart;
                                    const endPos = el.selectionEnd;

                                    const insertText = (prev.length > 0 && startPos > 0 && prev[startPos - 1] !== ' ') ? " " + transcribedText : transcribedText;

                                    const newText = prev.substring(0, startPos) + insertText + prev.substring(endPos);

                                    // Schedule setting cursor pos after react render
                                    setTimeout(() => {
                                        if (textareaRef.current) {
                                            const newPos = startPos + insertText.length;
                                            textareaRef.current.setSelectionRange(newPos, newPos);
                                            textareaRef.current.focus();
                                        }
                                    }, 0);

                                    return newText;
                                });
                            }
                        } catch (err) {
                            console.error("Dictation transcription failed:", err);
                        } finally {
                            setIsDictating(false);
                        }
                    }

                    // Duplicate cleanup removed
                };
            };

            mediaRecorder.start();
            setIsDictating(true);
        } catch (err) {
            console.error("Microphone access denied for dictation:", err);
        }
    };

    // --- SCREENSHOT CAPTURE LOGIC (Wrapped in useCallback) ---
    const handleCapture = useCallback(async () => {
        try {
            if (!window.electronAPI) {
                console.error("[UI] Electron API is undefined.");
                return;
            }

            console.log(`[UI] 📸 Starting capture (Action)`);

            const result: ScreenshotData = await window.electronAPI.takeScreenshot();
            if (!result || !result.path) {
                console.warn("[UI] Capture failed or returned empty result.");
                return;
            }

            setQueuedScreenshots(prev => {
                const newQueue = [...prev, result];
                if (newQueue.length > MAX_QUEUE_SIZE) newQueue.shift();
                return newQueue;
            });

            // Ensure window is expanded to show the queue
            if (!isExpandedRef.current) {
                if (window.electronAPI) {
                    window.electronAPI.toggleExpand(true);
                    setIsExpanded(true);
                } else {
                    setIsExpanded(true);
                }
            }
            setActiveTab("Chat");

        } catch (e) {
            console.error("[UI] Screenshot Failed:", e);
        }
    }, []); // Empty deps as we use refs/functional updates where needed

    const handleUseScreen = () => { handleCapture(); }

    const handleRemoveQueuedScreenshot = async (pathToRemove: string) => {
        if (!window.electronAPI) return;
        await window.electronAPI.deleteScreenshot(pathToRemove);
        setQueuedScreenshots(prev => prev.filter(img => img.path !== pathToRemove));
    };

    const handleClearQueue = async () => {
        if (!window.electronAPI) return;
        await Promise.all(queuedScreenshots.map(img => window.electronAPI.deleteScreenshot(img.path)));
        setQueuedScreenshots([]);
    };

    const handleClearAttachments = async () => {
        if (!window.electronAPI) return;
        if (queuedAttachments.length > 0) {
            const paths = queuedAttachments.map(a => a.path);
            await window.electronAPI.deleteChatFiles(paths);
            setQueuedAttachments([]);
        }
    };

    useEffect(() => {
        if (window.electronAPI) {
            if (window.electronAPI.getStealthMode) {
                window.electronAPI.getStealthMode().then(setIsStealth).catch(console.error);
            }
            if (window.electronAPI.getPrivateMode) {
                window.electronAPI.getPrivateMode().then(setIsPrivateMode).catch(console.error);
            }
        }

        const savedMeetings = localStorage.getItem('moubely_meetings')
        if (savedMeetings) {
            try { setPastMeetings(JSON.parse(savedMeetings)) } catch (e) { }
        }

        const savedChats = localStorage.getItem('moubely_chats')
        if (savedChats) {
            try { setPastChats(JSON.parse(savedChats)) } catch (e) { }
        }

        let cleanupStream = () => { };
        if (window.electronAPI && window.electronAPI.onTokenReceived) {
            cleanupStream = window.electronAPI.onTokenReceived((token) => {
                if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
                setShowSlowLoader(false);

                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'ai' && lastMsg.isStreaming) {
                        return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + token }];
                    }
                    return prev;
                });
                // isAtBottomRef.current = true;  <-- CORRECT: Commented out to allow scrolling up
            });
        }

        const cleanupFunctions: (() => void)[] = [];

        if (window.electronAPI) {
            cleanupFunctions.push(
                window.electronAPI.onResetView(() => {
                    resetChat();
                    setTranscriptLogs([]);
                    setShowPostMeeting(false);
                    setTranscriptError(null);
                    handleStopSession();
                })
            );

            cleanupFunctions.push(
                window.electronAPI.onScreenshotAction((data) => {
                    if (data.action === "take-and-queue") {
                        handleCapture();
                    }
                })
            );

            cleanupFunctions.push(
                window.electronAPI.onStealthModeToggled((enabled) => {
                    console.log(`[Queue] 🛡️ Stealth Toggle -> ${enabled}`);
                    setIsStealth(enabled);
                })
            );

            cleanupFunctions.push(
                window.electronAPI.onPrivateModeToggled((enabled) => {
                    console.log(`[Queue] 🕶️ Private Toggle -> ${enabled}`);
                    setIsPrivateMode(enabled);
                })
            );
        }

        // --- ADDED: CTRL+H LISTENER FOR LOCAL CAPTURE & CTRL FOR SCROLL PORTAL ---
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
                e.preventDefault();
                console.log("[UI] ⌨️ Ctrl+H Detected -> Triggering Capture");
                handleCapture();
            }
            if (e.key === 'Control') {
                setIsCtrlPressed(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') {
                setIsCtrlPressed(false);
            }
        };

        // RELIABLE CTRL DETECTION: Use mouse events to sync Ctrl state 
        // because mouse events are forwarded even when window is not focused!
        const handleMouseUpdate = (e: MouseEvent | WheelEvent) => {
            if (isPrivateMode) {
                setIsCtrlPressed(e.ctrlKey);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseUpdate);
        window.addEventListener('wheel', handleMouseUpdate);

        return () => {
            cleanupFunctions.forEach(fn => fn());
            cleanupStream();
            if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseUpdate);
            window.removeEventListener('wheel', handleMouseUpdate);
        };
    }, [handleCapture, isPrivateMode])

    // --- SCROLL PORTAL EFFECT ---
    useEffect(() => {
        if (!window.electronAPI || !isPrivateMode) return;

        // If (Hovering Chat) AND (Ctrl Pressed) -> Temporary interactive mode
        if (isHoveringChat && isCtrlPressed) {
            console.log("[ScrollPortal] 🌀 Portal OPEN: Window Interactive (Hovering + Ctrl)");
            window.electronAPI.toggleMouseIgnore(false);
        } else {
            // Otherwise, go back to ignoring events as per Private Mode rules
            window.electronAPI.toggleMouseIgnore(true);
        }
    }, [isHoveringChat, isCtrlPressed, isPrivateMode]);
    const resetChat = () => {
        setMessages([{ id: "init", role: "ai", text: "Hi there. I'm Moubely. I'm ready to listen.", timestamp: Date.now() }]);
    }

    const handleToggleStealth = async () => {
        if (window.electronAPI) {
            const newState = await window.electronAPI.toggleStealthMode();
            setIsStealth(newState);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        // SMART THRESHOLD: 30px proximity counts as "Bottom"
        isAtBottomRef.current = distanceToBottom < 30;
    };

    useEffect(() => {
        if (activeTab === "Chat") {
            if (isThinking && !didJumpRef.current) {
                // INITIAL JUMP: AI just started thinking/streaming
                isAtBottomRef.current = true;
                didJumpRef.current = true;
                chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
            } else if (isAtBottomRef.current && chatContainerRef.current) {
                // STICKY SCROLL: Follow the text as it tokens in
                chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'auto' });
            }

            // Reset jump trigger when AI is done
            if (!isThinking && messages.every(m => !m.isStreaming)) {
                didJumpRef.current = false;
            }
        }

        if (activeTab === "Transcript" && transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, transcriptLogs, activeTab, isExpanded, isThinking])

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [input]);

    const startRecordingLoop = () => {
        if (!isRecordingRef.current || !destinationRef.current || !window.electronAPI) return;
        const recorder = new MediaRecorder(destinationRef.current.stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = recorder;
        let chunks: Blob[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

        // [NEW] SILENCE DETECTION: Monitor audio variance to detect pauses
        let silenceFrames = 0;
        const SILENCE_THRESHOLD_FRAMES = 30; // 30 * 100ms = 3 seconds
        let analyser: AnalyserNode | null = null;
        let silenceCheckInterval: NodeJS.Timeout | null = null;

        if (isUrgentRef.current && audioContextRef.current) {
            try {
                // Create analyser node to monitor audio levels
                analyser = audioContextRef.current.createAnalyser();
                analyser.fftSize = 2048;
                const bufferLength = analyser.fftSize;
                const dataArray = new Uint8Array(bufferLength);

                // Connect analyser to audio stream
                if (sourceNodeRef.current) {
                    sourceNodeRef.current.connect(analyser);
                }

                // Track previous volume to calculate variance
                let previousVolumes: number[] = [];
                const VARIANCE_WINDOW = 5; // Track last 5 samples

                silenceCheckInterval = setInterval(() => {
                    if (!analyser || recorder.state !== 'recording') return;

                    // Get current volume
                    analyser.getByteTimeDomainData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        const normalized = (dataArray[i] - 128) / 128; // Convert to -1 to 1
                        sum += normalized * normalized;
                    }
                    const rms = Math.sqrt(sum / bufferLength);
                    const db = 20 * Math.log10(rms);

                    // Track volume history
                    previousVolumes.push(db);
                    if (previousVolumes.length > VARIANCE_WINDOW) {
                        previousVolumes.shift();
                    }

                    // Calculate variance
                    if (previousVolumes.length >= VARIANCE_WINDOW) {
                        const mean = previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;
                        const variance = previousVolumes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / previousVolumes.length;

                        // Silence = low variance AND low volume
                        const isSilent = (variance < 2 && db < -35);

                        if (isSilent) {
                            silenceFrames++;
                            if (silenceFrames >= SILENCE_THRESHOLD_FRAMES) {
                                console.log(`[UI] 🤫 3s silence detected. Triggering early transcription.`);
                                if (recorder.state === 'recording') {
                                    recorder.stop();
                                }
                                if (silenceCheckInterval) clearInterval(silenceCheckInterval);
                            }
                        } else {
                            silenceFrames = 0; // Reset counter if speech detected
                        }
                    }
                }, 100); // Check every 100ms
            } catch (e) {
                console.error('[UI] ❌ Failed to setup silence detection:', e);
            }
        }

        recorder.onstop = async () => {
            // Clean up silence detection
            if (silenceCheckInterval) clearInterval(silenceCheckInterval);
            if (analyser && sourceNodeRef.current) {
                try {
                    sourceNodeRef.current.disconnect(analyser);
                } catch (e) { /* Already disconnected */ }
            }

            if (isPausedRef.current || !window.electronAPI) return;
            const blob = new Blob(chunks, { type: 'audio/webm' });
            if (blob.size > 0) {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];

                    // FIX 1: Generate "Ticket Number" (Timestamp) HERE
                    const chunkTimestamp = Date.now();

                    try {
                        const urgencyState = isUrgentRef.current;

                        // FIX 2: Pass Timestamp ID to backend
                        const result = await window.electronAPI.analyzeAudioFromBase64(base64Audio, 'audio/webm', urgencyState, chunkTimestamp);

                        if (result.text && result.text.length > 0) {
                            // Use the TICKET timestamp for display time calculation
                            const elapsed = Math.floor((chunkTimestamp - meetingStartTimeRef.current) / 1000);
                            const mins = Math.floor(elapsed / 60);
                            const secs = elapsed % 60;
                            const displayTime = `${mins}:${secs.toString().padStart(2, '0')}`;

                            // FIX 3: Sort Logs by Timestamp (Fixes Race Condition)
                            setTranscriptLogs(prev => {
                                const newLog = {
                                    id: chunkTimestamp.toString(),
                                    text: result.text,
                                    timestamp: chunkTimestamp,
                                    displayTime
                                };
                                return [...prev, newLog].sort((a, b) => a.timestamp - b.timestamp);
                            });
                        }
                    } catch (e: any) {
                        if (e.message && e.message.includes("API key")) {
                            setTranscriptError("API Key Invalid.");
                            setIsRecording(false);
                        }
                    }
                };
            }
            if (isRecordingRef.current && !isPausedRef.current) { setTimeout(() => startRecordingLoop(), 100); }
        };
        recorder.start();
        // [OPTIMIZED] Smart Mode uses 6-second chunks (complete sentences + Groq speed)
        const chunkDuration = isUrgentRef.current ? 6000 : 5000;
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, chunkDuration);
    };

    const handleStartSession = async () => {
        try {
            setTranscriptError(null);
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });

            let systemStream: MediaStream | null = null;
            try { systemStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true }); } catch (err) { }

            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const destination = audioCtx.createMediaStreamDestination();

            const micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(destination);
            sourceNodeRef.current = micSource;

            if (systemStream && systemStream.getAudioTracks().length > 0) {
                const systemSource = audioCtx.createMediaStreamSource(systemStream);
                systemSource.connect(destination);
            }

            destinationRef.current = destination;

            // Preserve existing chat & loaded session state so user's current view isn't interrupted
            setTranscriptLogs([]);
            setShowPostMeeting(false);
            setEmailDraft("");
            setNeedsEmailGeneration(false);

            const startT = Date.now();
            setMeetingStartTime(startT);
            meetingStartTimeRef.current = startT;

            setIsRecording(true);
            setIsPaused(false);
            setIsFinalizing(false);
            isRecordingRef.current = true;
            isPausedRef.current = false;

            if (!isExpanded) handleExpandToggle();
            setActiveTab("Transcript");

            startRecordingLoop();

        } catch (err) {
            console.error("Microphone access error:", err);
            setTranscriptError("Microphone access denied. Please allow microphone access.");
        }
    }

    const handlePauseToggle = () => {
        if (isPaused) {
            setIsPaused(false);
            isPausedRef.current = false;
            if (isRecordingRef.current) startRecordingLoop();
        } else {
            setIsPaused(true);
            isPausedRef.current = true;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        }
    }

    // [NEW] SYNC SMART MODE: Instantly update ref so the recording loop sees it immediately.
    useEffect(() => {
        isUrgentRef.current = isSmartMode;
        console.log(`[UI] ⚡ Smart Mode Toggled: ${isSmartMode}`);
    }, [isSmartMode]);

    const handleStopSession = () => {
        setIsRecording(false);
        setIsPaused(false);
        isRecordingRef.current = false;
        isPausedRef.current = false;

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        if (sourceNodeRef.current && sourceNodeRef.current.mediaStream) {
            sourceNodeRef.current.mediaStream.getTracks().forEach(track => track.stop());
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        sourceNodeRef.current = null;
        destinationRef.current = null;

        setIsFinalizing(true);
        handleMeetingEnd();
    }

    const handleMeetingEnd = async () => {
        if (transcriptLogs.length === 0 && !isFinalizing) return;

        setShowPostMeeting(true);
        if (!isExpanded) handleExpandToggle();
        setActiveTab("Email");
        setIsThinking(true);
        setThinkingStep("Finalizing transcript...");

        let stableCount = 0;
        let lastLength = transcriptLengthRef.current;

        if (lastLength > 0 || isFinalizing) {
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 1000));
                const currentLength = transcriptLengthRef.current;

                if (currentLength === lastLength) stableCount++;
                else { stableCount = 0; lastLength = currentLength; }

                if (i >= 14 && stableCount >= 2) {
                    break;
                }
            }
        }

        setThinkingStep("Drafting summary...");
        setIsFinalizing(false);
        setNeedsEmailGeneration(true);
    }

    useEffect(() => {
        const generateEmailAfterFinalize = async () => {
            if (needsEmailGeneration && showPostMeeting && !emailDraft && transcriptLogs.length > 0 && window.electronAPI) {
                setNeedsEmailGeneration(false);
                setIsThinking(true);
                setThinkingStep("Drafting summary...");
                const fullTranscript = transcriptLogs.map(t => t.text).join(" ");
                let generatedEmail = "";
                let generatedTitle = `Meeting ${new Date().toLocaleDateString()}`;
                try {
                    const [emailResponse, titleResponse] = await Promise.all([
                        window.electronAPI.invoke("gemini-chat", {
                            message: `Based on this transcript, draft a professional follow-up email:\n\n${fullTranscript}`,
                            type: "general",
                            isCandidateMode: false
                        }),
                        window.electronAPI.invoke("gemini-chat", {
                            message: `Based on this transcript, generate a very short, concise title (under 6 words) for this meeting. No quotes, no markdown:\n\n${fullTranscript}`,
                            type: "title",
                            isCandidateMode: false
                        })
                    ]);

                    generatedEmail = emailResponse;
                    generatedTitle = cleanMeetingTitle(titleResponse);

                    setEmailDraft(emailResponse);
                    const newMeeting: MeetingSession = {
                        id: Date.now().toString(),
                        date: Date.now(),
                        transcript: transcriptLogs,
                        emailDraft: generatedEmail,
                        title: generatedTitle
                    };
                    const updatedHistory = [newMeeting, ...pastMeetings];
                    setPastMeetings(updatedHistory);
                    localStorage.setItem('moubely_meetings', JSON.stringify(updatedHistory));
                } catch (e) {
                    console.error("[Queue] Failed to generate email/title:", e);
                    setEmailDraft("Failed to generate content.");
                }
                finally {
                    setIsThinking(false);
                }
            } else if (needsEmailGeneration && showPostMeeting && isThinking) {
                // FALLBACK: empty transcript
                console.warn("[Queue] Meeting ended but skipping email generation (likely empty transcript).");
                setNeedsEmailGeneration(false);
                setIsThinking(false);
            }
        };
        generateEmailAfterFinalize();
    }, [needsEmailGeneration, showPostMeeting, isThinking, emailDraft, transcriptLogs, pastMeetings]);

    // --- INTERACTION FEEDBACK STATES ---
    const [isCopied, setIsCopied] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isRegeneratingEmail, setIsRegeneratingEmail] = useState(false);

    const handleCopyEmail = () => {
        if (!emailDraft) return;
        navigator.clipboard.writeText(emailDraft);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleRegenerateEmail = async () => {
        if (!transcriptLogs.length || !window.electronAPI || isRegeneratingEmail) return;

        setIsRegeneratingEmail(true);
        // We do NOT clear emailDraft here so the user can still read the old one while waiting.

        try {
            const fullTranscript = transcriptLogs.map(t => t.text).join(" ");
            const emailResponse = await window.electronAPI.invoke("gemini-chat", {
                message: `Based on this transcript, draft a professional follow-up email:\n\n${fullTranscript}`,
                type: "general",
                isCandidateMode: false
            });

            setEmailDraft(emailResponse);

            // Update the matching history entry so the new email persists
            if (pastMeetings.length > 0) {
                // Determine the currently active meeting ID (assume the most recent one if actively viewing a post-meeting)
                // If the user loaded an old meeting, it's matching the current transcript.
                // It's safer to identify the meeting by comparing transcripts or ensuring we have an activeId state.
                // Assuming the first meeting in pastMeetings is the current one for newly finished sessions,
                // or we find by matching the exact transcript logs (which is robust enough for this UI).

                const currentTranscriptText = transcriptLogs.map(t => t.text).join(" ");
                const updatedHistory = pastMeetings.map(meeting => {
                    const meetingTranscriptText = meeting.transcript.map(t => t.text).join(" ");
                    if (meetingTranscriptText === currentTranscriptText) {
                        return { ...meeting, emailDraft: emailResponse };
                    }
                    return meeting;
                });

                setPastMeetings(updatedHistory);
                localStorage.setItem('moubely_meetings', JSON.stringify(updatedHistory));
            }

        } catch (e) {
            // Only show error if we completely failed
            // setEmailDraft("Failed to generate content."); 
        } finally {
            setIsRegeneratingEmail(false);
        }
    };

    const handleCloseMeeting = () => {
        setLoadedSessionId(null);
        setLoadedSessionType(null);
        setTranscriptLogs([]);
        setMessages([]);
        setEmailDraft("");
        setShowPostMeeting(false);
        setActiveTab("Chat");
    };

    // --- EDITING STATE ---
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");

    const handleStartEdit = (msg: Message) => {
        setEditingMsgId(msg.id);
        setEditText(msg.text);
    };

    const handleSaveEdit = async (msgId: string) => {
        if (!editText.trim()) return;

        setEditingMsgId(null);

        const msgIndex = messages.findIndex(m => m.id === msgId);
        if (msgIndex === -1) return;

        // Strip everything after the edited message
        const initialMessages: Message[] = messages.slice(0, msgIndex + 1).map(m =>
            m.id === msgId ? { ...m, text: editText } : m
        );

        const aiMsgId = `${Date.now()}-ai`;
        initialMessages.push({
            id: aiMsgId,
            role: "ai",
            text: "",
            timestamp: Date.now(),
            isStreaming: true,
            isMedia: isArtActive
        });

        setMessages(initialMessages);

        setIsThinking(true);
        setThinkingStep(isArtActive ? "Generating Art..." : "Regenerating response...");

        const contextData = {
            isInMeeting: isRecording || showPostMeeting,
            meetingTranscript: transcriptLogs.map(t => t.text).join("\n"),
            uploadedFilesContent: "",
            userImage: undefined
        };
        const finalPrompt = preparePayload(editText, contextData);

        try {
            let fullResponse = "";
            let generatedMedia = null;

            if (isArtActive) {
                const result = await window.electronAPI.generateMedia({ prompt: editText, model: selectedModel });
                generatedMedia = result;
            } else {
                fullResponse = await window.electronAPI.invoke("gemini-chat", {
                    message: finalPrompt,
                    mode: mode,
                    history: initialMessages.slice(0, -1).map(m => ({ role: m.role, text: m.text })),
                    type: "general",
                    isCandidateMode: mode === 'Student'
                });
            }

            const finalMessages = initialMessages.map(m => {
                if (m.id === aiMsgId) {
                    return {
                        ...m,
                        text: fullResponse,
                        isStreaming: false,
                        queuedAttachments: generatedMedia ? [{ name: "Generated " + generatedMedia.type, path: generatedMedia.localUri, type: generatedMedia.type }] : undefined
                    };
                }
                return m;
            });
            setMessages(finalMessages);
            saveChatToHistory(finalMessages);
        } catch (e: any) {
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: "Error: " + e.message, isStreaming: false } : m));
        } finally {
            setIsThinking(false);
            setShowSlowLoader(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingMsgId(null);
        setEditText("");
    };
    const handleModeSelect = async (selectedMode: string) => {
        setMode(selectedMode);
        sessionStorage.setItem("moubely_mode", selectedMode);
        setShowModeMenu(false);

        if (selectedMode === "Student" && window.electronAPI) {
            const exists = await window.electronAPI.checkProfileExists();
            if (!exists) setShowStudentModal(true);
        }
    };

    const handleSaveStudentFiles = async (files: File[]) => {
        if (!window.electronAPI) return;
        if (files.length > 0) {
            const fileDataArray = await Promise.all(files.map(async (file) => {
                const arrayBuffer = await file.arrayBuffer();
                return { name: file.name, data: arrayBuffer };
            }));
            await window.electronAPI.saveStudentFiles(fileDataArray);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "Student profile updated. I've analyzed your files.", timestamp: Date.now() }]);
        }
        setShowStudentModal(false);
    };


    const handleCopyUserMessage = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }

    const handleCopyAiMessage = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }
    const startResize = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: document.body.offsetWidth, startH: document.body.offsetHeight }; document.addEventListener('mousemove', doResize); document.addEventListener('mouseup', stopResize); }
    const doResize = (e: MouseEvent) => {
        if (!resizeRef.current || !window.electronAPI) return;
        const diffX = e.clientX - resizeRef.current.startX;
        const diffY = e.clientY - resizeRef.current.startY;
        const newWidth = Math.max(600, resizeRef.current.startW + diffX); // Safety floor: match Electron minWidth
        const newHeight = Math.max(200, resizeRef.current.startH + diffY); // Minimum for collapsed state
        window.electronAPI.setWindowSize({ width: newWidth, height: newHeight });
    }
    const stopResize = () => { resizeRef.current = null; document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }
    const loadMeeting = (m: MeetingSession) => { setTranscriptLogs(m.transcript); setEmailDraft(m.emailDraft); setShowPostMeeting(true); setActiveTab("Transcript"); setMessages([{ id: Date.now().toString(), role: "ai", text: `Loaded meeting: ${new Date(m.date).toLocaleString()}`, timestamp: Date.now() }]); }
    const deleteMeeting = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const u = pastMeetings.filter(m => m.id !== id); setPastMeetings(u); localStorage.setItem('moubely_meetings', JSON.stringify(u)); }

    const deleteChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const chatToDelete = pastChats.find(c => c.id === id);
        if (chatToDelete && window.electronAPI && window.electronAPI.deleteChatFiles) {
            const allImagePaths: string[] = [];
            chatToDelete.messages?.forEach(m => {
                if (m.queuedScreenshots) {
                    m.queuedScreenshots.forEach(img => allImagePaths.push(img.preview));
                }
            });
            if (allImagePaths.length > 0) {
                window.electronAPI.deleteChatFiles(allImagePaths);
            }
        }

        const u = pastChats.filter(c => c.id !== id);
        setPastChats(u);
        localStorage.setItem('moubely_chats', JSON.stringify(u));
    };

    const handleDownloadMedia = async (url: string, promptText: string, msgId?: string) => {
        if (!window.electronAPI) return;
        const filenamePrefix = promptText
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 0)
            .slice(0, 5)
            .join('_');
        const extension = url.toLowerCase().endsWith('mp4') ? 'mp4' : 'jpg';
        const filename = `${filenamePrefix || 'generated_media'}_${Date.now()}.${extension}`;
        try {
            const result = await window.electronAPI.downloadMedia(url, filename);
            if (result.success) {
                if (msgId) {
                    setSavedId(msgId);
                    setTimeout(() => setSavedId(null), 2000);
                }
            } else if (result.error && !result.error.includes('canceled')) {
                console.error("Download failed:", result.error);
            }
        } catch (e) {
            console.error("Download execution error:", e);
        }
    };

    const handleResetDownloadPath = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!window.electronAPI) return;
        await window.electronAPI.resetSavePath();
    };

    const handleClearLoadedSession = () => {
        setLoadedSessionId(null);
        setLoadedSessionType(null);
        resetChat();
        setTranscriptLogs([]);
        setShowPostMeeting(false);
        setActiveTab("Chat");
    };

    const handleLoadPastChat = (chat: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadedSessionId(chat.id);
        setLoadedSessionType("Chat");

        if (chat.messages && chat.messages.length > 0) {
            setMessages(chat.messages);
        } else {
            setMessages([
                { id: "prompt_" + chat.id, role: "user", text: chat.prompt, timestamp: chat.date },
                { id: "resp_" + chat.id, role: "ai", text: chat.response, timestamp: chat.date + 1 }
            ]);
        }

        setShowPostMeeting(false); // Essential! Keeps Action Buttons visible.
        setActiveTab("Chat");
    };

    const handleLoadPastMeeting = (meeting: MeetingSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setLoadedSessionId(meeting.id);
        setLoadedSessionType("Meeting");
        const title = meeting.title || new Date(meeting.date).toLocaleDateString();

        setTranscriptLogs(meeting.transcript);
        setEmailDraft(meeting.emailDraft);

        setMessages([{ id: Date.now().toString(), role: "ai", text: `Loaded meeting: ${title}`, timestamp: Date.now() }]);

        setShowPostMeeting(true);
        setActiveTab("Transcript");
    };

    const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);
    const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

    const handleCopyHistoryTranscript = (meetingId: string, transcript: TranscriptItem[], e: React.MouseEvent) => {
        e.stopPropagation();
        const text = transcript.map(t => t.text).join(" ");
        navigator.clipboard.writeText(text);
        setCopiedTranscriptId(meetingId);
        setTimeout(() => setCopiedTranscriptId(null), 2000);
    }

    const handleCopyHistoryEmail = (meetingId: string, email: string, e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(email);
        setCopiedEmailId(meetingId);
        setTimeout(() => setCopiedEmailId(null), 2000);
    }

    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [editingTitleText, setEditingTitleText] = useState("");

    const handleStartEditTitle = (m: MeetingSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTitleId(m.id);
        setEditingTitleText(m.title || new Date(m.date).toLocaleDateString());
    };

    const handleSaveTitle = (m: MeetingSession, e: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
        e.stopPropagation();
        if (!editingTitleText.trim()) return;

        const updatedHistory = pastMeetings.map((meeting) =>
            meeting.id === m.id ? { ...meeting, title: editingTitleText.trim() } : meeting
        );
        setPastMeetings(updatedHistory);
        localStorage.setItem('moubely_meetings', JSON.stringify(updatedHistory));
        setEditingTitleId(null);
    };

    const handleCancelEditTitle = (e: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
        e.stopPropagation();
        setEditingTitleId(null);
    };

    // --- EDITING CHAT TITLES ---
    const [editingChatTitleId, setEditingChatTitleId] = useState<string | null>(null);
    const [editingChatTitleText, setEditingChatTitleText] = useState("");

    const handleStartEditChatTitle = (chat: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingChatTitleId(chat.id);
        setEditingChatTitleText(chat.prompt || new Date(chat.date).toLocaleDateString());
    };

    const handleSaveChatTitle = (chat: ChatSession, e: React.MouseEvent | React.KeyboardEvent | React.FocusEvent) => {
        e.stopPropagation();
        const newTitle = editingChatTitleText.trim();
        setPastChats(prev => {
            const updated = prev.map(c => c.id === chat.id ? { ...c, prompt: newTitle || c.prompt } : c);
            localStorage.setItem('moubely_chats', JSON.stringify(updated));
            return updated;
        });
        setEditingChatTitleId(null);
    };

    const handleCancelEditChatTitle = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation();
        setEditingChatTitleId(null);
    };

    const [expandedChats, setExpandedChats] = useState<Record<string, boolean>>({});
    const [expandedMeetings, setExpandedMeetings] = useState<Record<string, boolean>>({});
    const [expandedEmails, setExpandedEmails] = useState<Record<string, boolean>>({});

    const toggleChat = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedChats(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleMeeting = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedMeetings(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleEmail = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedEmails(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const generateAndSaveTitle = async (sessionId: string, userText: string) => {
        if (!window.electronAPI) return;
        try {
            const title = await window.electronAPI.invoke("gemini-chat", {
                message: `Create a very short title (max 5 words, no quotes) for this chat prompt. Output only the title. Prompt: ${userText}`,
                mode: "general",
                history: [],
                type: "general",
                isCandidateMode: false
            });
            const cleanTitle = title.replace(/['"]/g, '').trim();
            setPastChats(prev => {
                const targetChat = prev.find(c => c.id === sessionId);
                if (!targetChat) return prev;
                // If the user already manually renamed the chat or it no longer matches the initial userText, skip AI rename
                if (targetChat.prompt !== userText) return prev;

                const updated = prev.map(c => c.id === sessionId ? { ...c, prompt: cleanTitle } : c);
                localStorage.setItem('moubely_chats', JSON.stringify(updated));
                return updated;
            });
        } catch (e) {
            console.error("Title generation generation failed:", e);
        }
    };

    const saveChatToHistory = (messagesToSave: Message[], sessionIdArg?: string | null, presetTitle?: string) => {
        if (!messagesToSave || messagesToSave.length === 0) return;

        const firstUserMessage = presetTitle || messagesToSave.find(m => m.role === 'user')?.text || "Chat Session";
        const lastAiMessage = messagesToSave.filter(m => m.role === 'ai').pop()?.text || "";

        // Extract last generated media for thumbnail preview
        const lastMediaMsg = [...messagesToSave].reverse().find(m => m.role === 'ai' && m.queuedAttachments && m.queuedAttachments.length > 0);
        const lastMedia = lastMediaMsg && lastMediaMsg.queuedAttachments ? {
            path: lastMediaMsg.queuedAttachments[0].path,
            type: lastMediaMsg.queuedAttachments[0].type,
            localPath: lastMediaMsg.queuedAttachments[0].localPath
        } : undefined;

        let activeSessionId = sessionIdArg !== undefined ? sessionIdArg : loadedSessionId;

        // If not loaded from history and not already initialized eagerly, create a new session
        if (!activeSessionId) {
            activeSessionId = Date.now().toString();
            setLoadedSessionId(activeSessionId);
            setLoadedSessionType("Chat");
        }

        setPastChats(prev => {
            const existingIndex = prev.findIndex(c => c.id === activeSessionId);
            if (existingIndex >= 0) {
                // Update existing
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    response: lastAiMessage,
                    messages: messagesToSave,
                    lastMedia: lastMedia || updated[existingIndex].lastMedia
                };
                localStorage.setItem('moubely_chats', JSON.stringify(updated));
                return updated;
            } else {
                // Create new
                const newChat: ChatSession = {
                    id: activeSessionId,
                    date: parseInt(activeSessionId) || Date.now(),
                    prompt: firstUserMessage,
                    response: lastAiMessage,
                    messages: messagesToSave,
                    lastMedia: lastMedia
                };
                const updated = [newChat, ...prev];
                localStorage.setItem('moubely_chats', JSON.stringify(updated));

                // Auto-generate title ONLY if no preset title was provided
                if (!presetTitle) {
                    generateAndSaveTitle(activeSessionId, firstUserMessage);
                }

                return updated;
            }
        });
    };

    const handleCancelGeneration = () => {
        if (!window.electronAPI) return;
        window.electronAPI.cancelChat();
        setIsThinking(false);
        setShowSlowLoader(false);
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };

    const handleSend = async (overrideText?: string) => {
        if (!window.electronAPI) return;

        const textToSend = overrideText || input
        const attachmentsToSend = [
            ...queuedScreenshots.map(s => ({ path: s.path, type: 'image' })),
            ...queuedAttachments
        ];
        const hasAttachments = attachmentsToSend.length > 0;

        if (!textToSend.trim() && !hasAttachments) return
        if (isThinking) return;

        // Eager Session Initialization
        let currentSessionId = loadedSessionId;
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
            setLoadedSessionId(currentSessionId);
            setLoadedSessionType("Chat");
        }

        const now = Date.now();
        const aiMsgId = `${now}-ai`;
        const userId = `${now}-user`;

        const newMessages: Message[] = [
            ...messages,
            {
                id: userId,
                role: "user",
                text: textToSend || (hasAttachments ? `Analyze ${attachmentsToSend.length} attachments.` : ""),
                queuedScreenshots: queuedScreenshots.length > 0 ? queuedScreenshots : undefined,
                queuedAttachments: queuedAttachments.length > 0 ? queuedAttachments : undefined,
                timestamp: Date.now()
            },
            {
                id: aiMsgId,
                role: "ai",
                text: "",
                timestamp: Date.now(),
                isStreaming: true,
                isMedia: isArtActive
            }
        ];

        setMessages(newMessages)
        setInput("")

        setIsThinking(true)
        setThinkingStep(hasAttachments ? `Vision processing ${attachmentsToSend.length} attachments...` : "Thinking...")
        isAtBottomRef.current = true;

        setShowSlowLoader(false);
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = setTimeout(() => {
            setShowSlowLoader(true);
        }, 2000);

        const contextData = {
            isInMeeting: isRecording || showPostMeeting,
            meetingTranscript: transcriptLogs.map(t => t.text).join("\n"),
            uploadedFilesContent: "",
            userImage: queuedScreenshots.length > 0 ? queuedScreenshots[0].preview : undefined
        };

        const finalPrompt = preparePayload(textToSend, contextData);

        try {
            let fullResponse = "";
            const isMediaModel = isArtActive;
            let generatedMedia: any = null;

            if (isMediaModel) {
                const activeModelObj = GENERATIVE_MODELS.find(m => m.id === selectedModel);
                setThinkingStep(`Generating ${activeModelObj?.type || 'Art'}...`);
                const result = await window.electronAPI.generateMedia({ prompt: textToSend, model: selectedModel });
                generatedMedia = result;
                fullResponse = ""; // Raw media only, no repeated text
            } else {
                const args = {
                    message: finalPrompt,
                    mode: mode,
                    history: messages.map(m => ({ role: m.role, text: m.text })),
                    type: "general",
                    isCandidateMode: mode === 'Student'
                };

                if (hasAttachments) {
                    fullResponse = await window.electronAPI.chatWithAttachments(finalPrompt, attachmentsToSend, "answer")
                } else {
                    fullResponse = await window.electronAPI.invoke("gemini-chat", args)
                }
            }

            const finalMessages = newMessages.map(m => {
                if (m.id === aiMsgId) {
                    return {
                        ...m,
                        text: fullResponse,
                        isStreaming: false,
                        queuedAttachments: generatedMedia ? [{ name: "Generated " + generatedMedia.type, path: generatedMedia.localUri, type: generatedMedia.type }] : undefined
                    };
                }
                return m;
            });
            setMessages(finalMessages);

            // Save to Local History
            saveChatToHistory(finalMessages);

        } catch (error: any) {
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, text: "Error: " + error.message, isStreaming: false } : m
            ));
        } finally {
            if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
            setShowSlowLoader(false);
            setIsThinking(false);

            if (hasAttachments) {
                setQueuedScreenshots([]);
                setQueuedAttachments([]);
            }
        }
    }

    // --- UPDATED: 5-BUTTON LOGIC & DIGITAL TWIN ---
    const triggerAssistAction = async (actionType: "assist" | "reply" | "answer" | "ask" | "recap") => {
        if (!window.electronAPI) return;

        // --- URGENT MODE ACTIVATION ---
        isUrgentRef.current = true;
        // Reset back to Casual after 10s
        setTimeout(() => { isUrgentRef.current = false; }, 10000);

        if (isThinking) return;

        // Eager Session Initialization
        let currentSessionId = loadedSessionId;
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
            setLoadedSessionId(currentSessionId);
            setLoadedSessionType("Chat");
        }

        // 1. Get Context
        let transcriptText = transcriptLogs.map(t => t.text).join(" ");
        if (!transcriptText.trim() && messages.length > 0) {
            transcriptText = messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
        }

        if (!transcriptText.trim() && actionType !== 'answer') {
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "I need more context or conversation history first.", timestamp: Date.now() }]);
            return;
        }

        // 2. Set UI State
        setActiveTab("Chat")
        setIsThinking(true)
        setThinkingStep("Processing...");

        // UPDATED: Set the Slow Loader Timer (2s)
        setShowSlowLoader(false);
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = setTimeout(() => {
            setShowSlowLoader(true);
        }, 2000);

        // 3. Add User Message
        let userDisplayMessage = "";
        switch (actionType) {
            case "assist": userDisplayMessage = "Assist me with facts."; break;
            case "reply": userDisplayMessage = "What should I say?"; break;
            case "answer": userDisplayMessage = "Answer this for me (Digital Twin)."; break;
            case "ask": userDisplayMessage = "What should I ask?"; break;
            case "recap": userDisplayMessage = "Recap the discussion."; break;
        }

        const hasAttachments = queuedScreenshots.length > 0 || queuedAttachments.length > 0;
        const now = Date.now();
        const userId = `${now}-user`;
        const aiMsgId = `${now}-ai`;

        if (hasAttachments) {
            userDisplayMessage += " (Attachments included)";
        }

        const initialMessages: Message[] = [
            ...messages,
            {
                id: userId,
                role: "user",
                text: userDisplayMessage,
                queuedScreenshots: queuedScreenshots.length > 0 ? [...queuedScreenshots] : undefined,
                queuedAttachments: queuedAttachments.length > 0 ? [...queuedAttachments] : undefined,
                timestamp: now
            },
            { id: aiMsgId, role: "ai", text: "", timestamp: now, isStreaming: true }
        ];
        setMessages(initialMessages);

        // 4. Call AI
        try {
            const history = messages.map(m => ({ role: m.role, text: m.text }));
            const isCandidateMode = actionType === 'answer' || mode === 'Student';
            let response = "";

            if (hasAttachments) {
                const attachmentsToSend = [
                    ...queuedScreenshots.map(s => ({ path: s.path, type: 'image' })),
                    ...queuedAttachments
                ];
                // Use chatWithAttachments for visual context
                response = await window.electronAPI.chatWithAttachments(
                    transcriptText || userDisplayMessage,
                    attachmentsToSend,
                    actionType as any
                );
                setQueuedScreenshots([]);
                setQueuedAttachments([]);
            } else {
                response = await window.electronAPI.invoke("gemini-chat", {
                    message: transcriptText || "Context from files",
                    mode: mode,
                    history: history,
                    type: actionType,
                    isCandidateMode: isCandidateMode
                });
            }

            const finalMessages = initialMessages.map(m => m.id === aiMsgId ? { ...m, text: response, isStreaming: false } : m);
            setMessages(finalMessages);

            // Determine Preset Title based on Action
            let presetTitle = "";
            switch (actionType) {
                case "assist": presetTitle = "Fact-Checking Assistant"; break;
                case "reply": presetTitle = "Communication Support"; break;
                case "answer": presetTitle = "Digital Twin Explanation"; break;
                case "ask": presetTitle = "Interview Question Analysis"; break;
                case "recap": presetTitle = "Discussion Recap"; break;
            }

            saveChatToHistory(finalMessages, undefined, presetTitle);
        } catch (e: any) {
            console.error(e);
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: "Error: " + e.message, isStreaming: false } : m));
        } finally {
            // Clear timer and stop thinking
            if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
            setShowSlowLoader(false);
            setIsThinking(false);
        }
    }

    // --- NEW: TRIGGER SOLVE ACTION ---
    const triggerSolveAction = async () => {
        if (!window.electronAPI) return;

        // 1. Activate Urgent Mode (10s burst)
        isUrgentRef.current = true;
        setTimeout(() => { isUrgentRef.current = false; }, 10000);

        if (isThinking) return;

        // Eager Session Initialization
        let currentSessionId = loadedSessionId;
        if (!currentSessionId) {
            currentSessionId = Date.now().toString();
            setLoadedSessionId(currentSessionId);
            setLoadedSessionType("Chat");
        }

        // 2. Prepare Context (Images or Transcript)
        const hasAttachments = queuedScreenshots.length > 0 || queuedAttachments.length > 0;
        let contextText = transcriptLogs.map(t => t.text).join(" ");

        if (!contextText.trim() && messages.length > 0) {
            contextText = messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
        }

        // 3. UI Setup
        setActiveTab("Chat");
        setIsThinking(true);
        setThinkingStep("Solving problem...");

        setShowSlowLoader(false);
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = setTimeout(() => { setShowSlowLoader(true); }, 2000);

        // 4. Add User Message
        const now = Date.now();
        const aiMsgId = `${now}-ai`;
        const userId = `${now}-user`;
        const userDisplayMessage = hasAttachments ? "Solve this coding problem (Attachments included)." : "Solve this coding problem based on the discussion.";

        const initialMessages: Message[] = [
            ...messages,
            {
                id: userId,
                role: "user",
                text: userDisplayMessage,
                queuedScreenshots: queuedScreenshots.length > 0 ? [...queuedScreenshots] : undefined,
                queuedAttachments: queuedAttachments.length > 0 ? [...queuedAttachments] : undefined,
                timestamp: now
            },
            { id: aiMsgId, role: "ai", text: "", timestamp: now, isStreaming: true }
        ];
        setMessages(initialMessages);

        // 5. Call API
        try {
            let response = "";

            if (hasAttachments) {
                // --- PATH A: VISION BRAIN (Screenshots Attached) ---
                // Pass "solve" type so the backend uses the 6-section STAR prompt with Post-Code Analysis
                const attachmentsToSend = [
                    ...queuedScreenshots.map(s => ({ path: s.path, type: 'image' })),
                    ...queuedAttachments
                ];
                response = await window.electronAPI.chatWithAttachments(
                    "Solve the coding problem shown in these attachments.",
                    attachmentsToSend,
                    "solve"
                );
                setQueuedScreenshots([]);
                setQueuedAttachments([]);

            } else {
                // --- PATH B: TEXT BRAIN (Transcript Only) ---
                response = await window.electronAPI.invoke("gemini-chat", {
                    message: contextText || "Solve the current coding problem.",
                    mode: mode,
                    history: messages.map(m => ({ role: m.role, text: m.text })),
                    type: "solve",
                    isCandidateMode: true
                });
            }

            const finalMessages = initialMessages.map(m => m.id === aiMsgId ? { ...m, text: response, isStreaming: false } : m);
            setMessages(finalMessages);
            saveChatToHistory(finalMessages, undefined, "Coding Problem Solution");

        } catch (e: any) {
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: "Error: " + e.message, isStreaming: false } : m));
        } finally {
            if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
            setShowSlowLoader(false);
            setIsThinking(false);
        }
    }

    const handleInputFocus = () => {
        setIsInputFocused(true);
        if (!isExpanded) handleExpandToggle();
    }

    return (
        <div className={`moubely-window ${isExpanded ? 'expanded' : ''} flex flex-col h-full relative overflow-hidden`}>
            {fullscreenFile && (
                <UniversalMediaLightbox
                    file={fullscreenFile}
                    onClose={() => setFullscreenFile(null)}
                    onDownload={handleDownloadMedia}
                    savedId={savedId}
                />
            )}
            {hoverImage && !fullscreenFile && (
                <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <img
                        src={hoverImage}
                        className="max-w-[85%] max-h-[85%] object-contain rounded-xl border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                        alt="Hover Preview"
                    />
                </div>
            )}
            <StudentModeSetupModal
                open={showStudentModal}
                onClose={() => {
                    setShowStudentModal(false);
                    if (mode === "Student") {
                        setMode("General");
                        sessionStorage.setItem("moubely_mode", "General");
                    }
                }}
                onSave={handleSaveStudentFiles}
                mode={mode}
            />

            <div className="px-4 pt-3 pb-0 z-50 shrink-0">
                {!isExpanded && (
                    <div className="flex justify-center mb-3 animate-in fade-in slide-in-from-top-2">
                        <button onClick={isRecording ? handlePauseToggle : handleStartSession} className={`status-pill interactive hover:scale-105 transition-all no-drag ${isRecording ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}>
                            {!isRecording ? <><Play size={12} fill="currentColor" /><span>Start Moubely</span></> :
                                isPaused ? <><Play size={12} fill="currentColor" /><span>Resume Session</span></> :
                                    <><span>Session in progress</span><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1" /></>}
                        </button>
                    </div>
                )}
                <div className="compact-bar interactive no-drag">

                    <div className="flex items-center gap-2">
                        {!isRecording ? (
                            <button
                                onClick={handleStartSession}
                                className="icon-btn hover:text-green-400 hover:bg-green-400/10"
                                title={isStealth ? undefined : "Start Meeting"}
                            >
                                <Play size={18} fill="currentColor" />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handlePauseToggle}
                                    className={`icon-btn ${isPaused ? 'text-yellow-400' : 'text-blue-400'}`}
                                    title={isStealth ? undefined : (isPaused ? "Resume" : "Pause")}
                                >
                                    {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
                                </button>
                                <button
                                    onClick={handleStopSession}
                                    className="icon-btn hover:text-red-400 hover:bg-red-400/10"
                                    title={isStealth ? undefined : "Stop Meeting"}
                                >
                                    <Square size={16} fill="currentColor" className="text-red-400" />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => { resetChat(); setTranscriptLogs([]); setShowPostMeeting(false); }}
                            className="icon-btn hover:text-red-400"
                            title={isStealth ? undefined : "Reset Chat & Transcripts"}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="flex-1 flex justify-center"><div className="draggable cursor-grab active:cursor-grabbing p-2 rounded hover:bg-white/5 group"><GripHorizontal size={20} className="text-gray-600 group-hover:text-gray-400" /></div></div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleToggleStealth}
                            className={`icon-btn ${isStealth ? 'text-gray-500 hover:text-white' : 'text-yellow-500 hover:text-yellow-400'}`}
                            title={isStealth ? undefined : "Stealth Mode OFF (Visible)"}
                        >
                            {isStealth ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>

                        <button
                            onClick={handleExpandToggle}
                            className="icon-btn"
                            title={isStealth ? undefined : (isExpanded ? "Collapse View" : "Expand View")}
                        >
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>


                    </div>
                </div>
            </div>
            {isExpanded && (
                <div className="flex-1 flex flex-col min-h-0 interactive animate-in fade-in slide-in-from-top-4 duration-500 delay-75">

                    <div className="tab-nav justify-start overflow-x-auto no-scrollbar shrink-0 border-b border-white/5 relative flex items-center">
                        <button onClick={() => setActiveTab("Chat")} className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`}>Chat</button>
                        <button onClick={() => setActiveTab("Transcript")} className={`tab-btn ${activeTab === 'Transcript' ? 'active' : ''}`}>Transcript</button>

                        {showPostMeeting && <button onClick={() => setActiveTab("Email")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'Email' ? 'active' : ''}`}><Mail size={14} /> Email</button>}
                        <button onClick={() => setActiveTab("History")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'History' ? 'active' : ''}`}><History size={14} /> History</button>

                        <div className="flex-1" />
                        <button
                            onClick={handleClearLoadedSession}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded transition-colors shrink-0 outline-none"
                        >
                            <Plus size={14} /> New Chat
                        </button>
                    </div>

                    {(showPostMeeting || loadedSessionType === "Chat") && (
                        <div className="flex items-center justify-between px-4 py-2 bg-blue-500/10 border-b border-white/5 shrink-0">
                            <div className="text-xs text-blue-300 font-medium flex items-center gap-2">
                                <History size={14} className="text-blue-400" />
                                <span>{loadedSessionType === "Chat" ? "Viewing Chat Session" : "Viewing Loaded Meeting"}</span>
                            </div>
                            <button
                                onClick={loadedSessionType === "Chat" ? handleClearLoadedSession : handleCloseMeeting}
                                className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-gray-400 text-xs rounded transition-colors shrink-0 outline-none"
                            >
                                <X size={12} /> {loadedSessionType === "Chat" ? "Close Loaded Chat" : "Close Meeting"}
                            </button>
                        </div>
                    )}

                    {!showPostMeeting && (
                        <div className="flex justify-center items-center gap-3 px-3 py-3 border-b border-white/5 bg-black/20 shrink-0 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => triggerAssistAction("assist")}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium transition-colors border border-blue-500/10 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Sparkles size={13} /> <span>Assist</span>
                            </button>

                            <button
                                onClick={() => triggerAssistAction("reply")}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition-colors border border-emerald-500/10 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <MessageCircle size={13} /> <span>Reply</span>
                            </button>

                            <button
                                onClick={() => triggerAssistAction("answer")}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 text-xs font-bold transition-all border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/20 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Zap size={13} className="fill-purple-400/50" /> <span>Answer</span>
                            </button>

                            <button
                                onClick={triggerSolveAction}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 text-xs font-bold transition-all border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/20 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Terminal size={13} className="fill-indigo-400/50" /> <span>Solve</span>
                            </button>

                            <button
                                onClick={() => triggerAssistAction("ask")}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 text-xs font-medium transition-colors border border-orange-500/10 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <HelpCircle size={13} /> <span>Ask</span>
                            </button>

                            <button
                                onClick={() => triggerAssistAction("recap")}
                                disabled={isThinking}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors border border-white/5 ${isThinking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <FileText size={13} /> <span>Recap</span>
                            </button>
                        </div>
                    )}

                    <div className="content-area flex-1 overflow-hidden flex flex-col">
                        {activeTab === "Chat" && (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div
                                    className="flex-1 overflow-y-auto chat-scroll-area pb-4 px-2"
                                    ref={chatContainerRef}
                                    onScroll={handleScroll}
                                    onMouseEnter={() => {
                                        console.log("[ScrollPortal] Mouse ENTER Chat Area");
                                        setIsHoveringChat(true);
                                    }}
                                    onMouseLeave={() => {
                                        console.log("[ScrollPortal] Mouse LEAVE Chat Area");
                                        setIsHoveringChat(false);
                                    }}
                                >
                                    <div className="max-w-3xl w-full mx-auto flex flex-col space-y-5">
                                        {messages.map((msg) => (
                                            <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                                                {msg.role === "user" && (
                                                    <div className={`group relative w-full max-w-[85%] sm:max-w-[80%] flex flex-col items-end`}>
                                                        {(() => {
                                                            const visualMedia = [
                                                                ...(msg.queuedScreenshots || []).map(s => ({ preview: s.preview, originalPath: s.path, type: 'image' })),
                                                                ...(msg.queuedAttachments || []).filter(a => a.type === 'image' || a.type === 'video').map(a => ({ preview: getResolvedMediaUrl(a), originalPath: a.path, type: a.type }))
                                                            ];
                                                            const textMedia = (msg.queuedAttachments || []).filter(a => a.type !== 'image' && a.type !== 'video');

                                                            return (
                                                                <>
                                                                    {(visualMedia.length > 0 || textMedia.length > 0) && (
                                                                        <div className="mb-3 flex flex-wrap gap-2 w-full justify-end items-start">
                                                                            {visualMedia.map((media, index) => {
                                                                                const sizeClass = visualMedia.length === 1 && textMedia.length === 0 ? 'w-full max-w-[400px]' : 'w-[calc(50%-4px)]';
                                                                                return media.type === 'video' ? (
                                                                                    <div key={index} className={`relative rounded-lg overflow-hidden border border-white/10 bg-black/20 cursor-pointer hover:opacity-90 transition-opacity shrink-0 ${sizeClass}`} onClick={(e) => { e.stopPropagation(); setFullscreenFile({ path: media.originalPath, localPath: media.preview, type: 'video' }); }}>
                                                                                        <video src={media.preview} className="w-full h-[140px] sm:h-[160px] object-cover pointer-events-none" />
                                                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Play size={24} className="text-white opacity-80" /></div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <img
                                                                                        key={index}
                                                                                        src={media.preview}
                                                                                        alt={`Visual Media ${index + 1}`}
                                                                                        className={`rounded-lg border border-white/10 bg-black/20 cursor-pointer hover:opacity-90 transition-opacity h-[140px] sm:h-[160px] object-cover shrink-0 ${sizeClass}`}
                                                                                        onClick={(e) => { e.stopPropagation(); setFullscreenFile({ path: media.originalPath, localPath: media.preview, type: 'image' }); }}
                                                                                    />
                                                                                );
                                                                            })}

                                                                            {textMedia.length > 0 && (
                                                                                <div className={`flex flex-col gap-2 ${visualMedia.length === 0 ? 'w-full justify-end items-end' : 'w-[calc(50%-4px)]'} min-h-[40px] justify-start`}>
                                                                                    {textMedia.map((file, idx) => {
                                                                                        const useLocal = getResolvedMediaUrl(file);
                                                                                        return (
                                                                                            <div
                                                                                                key={idx}
                                                                                                className="flex shrink-0 items-center justify-between gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm transition-all cursor-pointer h-fit w-full"
                                                                                                onMouseEnter={(e) => { setHoverAttachment(file); setHoverRect(e.currentTarget.getBoundingClientRect()); }}
                                                                                                onMouseLeave={() => { setHoverAttachment(null); setHoverRect(null); }}
                                                                                                onClick={() => setFullscreenFile({ path: file.path, localPath: useLocal, type: file.type, name: file.name })}
                                                                                            >
                                                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                                                    <div className="p-1 bg-white/5 rounded-md shrink-0">
                                                                                                        {file.type === 'pdf' ? <FileText size={14} className="text-red-400" /> : <Code size={14} className="text-blue-400" />}
                                                                                                    </div>
                                                                                                    <span className="text-[11px] text-gray-200 truncate font-medium leading-none">{file.name}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}

                                                        {editingMsgId === msg.id ? (
                                                            <div className="flex flex-col gap-3 bg-[#1a1a1a] p-3 rounded-xl border border-blue-500/50 w-[95vw] sm:w-[500px] md:w-[600px] max-w-full shadow-2xl relative z-10">
                                                                <textarea
                                                                    ref={(el) => {
                                                                        if (el) {
                                                                            el.style.height = 'auto';
                                                                            el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 120)}px`;
                                                                        }
                                                                    }}
                                                                    value={editText}
                                                                    onChange={(e) => setEditText(e.target.value)}
                                                                    className="w-full bg-black/20 text-white text-sm p-3 outline-none resize-y min-h-[40px] max-h-[120px] rounded-lg border border-white/5 focus:border-white/10 custom-scrollbar overflow-y-auto leading-relaxed"
                                                                    autoFocus
                                                                />
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={handleCancelEdit} className="px-4 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Cancel</button>
                                                                    <button onClick={() => handleSaveEdit(msg.id)} className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20">Update</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 w-full justify-end">
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                    <button
                                                                        onClick={() => handleCopyUserMessage(msg.id, msg.text)}
                                                                        className={`p-1.5 transition-colors rounded-full ${copiedId === msg.id ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:text-white bg-black/40'}`}
                                                                    >
                                                                        {copiedId === msg.id ? <CheckCheck size={12} /> : <Copy size={12} />}
                                                                    </button>
                                                                    <button onClick={() => handleStartEdit(msg)} className="p-1.5 text-gray-400 hover:text-white bg-black/40 rounded-full"><Edit2 size={12} /></button>
                                                                </div>
                                                                <div className="user-bubble text-left relative max-w-full">
                                                                    <CollapsibleUserMessage text={msg.text} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {msg.role === "ai" && (
                                                    <div className="flex gap-4 items-start w-full">
                                                        <div className="shrink-0 flex items-center justify-center mt-0.5">
                                                            <img src={moubelyIcon} alt="Moubely AI" className="w-[28px] h-[28px] rounded-xl shadow-lg border border-white/10 object-contain p-0.5 bg-black/40" />
                                                        </div>
                                                        <div className="ai-message w-full group flex flex-col items-start space-y-1">
                                                            {(() => {
                                                                const visualMedia = [
                                                                    ...(msg.queuedScreenshots || []).map(s => ({ preview: s.preview, originalPath: s.path, type: 'image' })),
                                                                    ...(msg.queuedAttachments || []).filter(a => a.type === 'image' || a.type === 'video').map(a => ({ preview: getResolvedMediaUrl(a), originalPath: a.path, type: a.type }))
                                                                ];
                                                                const textMedia = (msg.queuedAttachments || []).filter(a => a.type !== 'image' && a.type !== 'video');

                                                                return (
                                                                    <>
                                                                        {msg.isStreaming && msg.isMedia && (
                                                                            <div className="mb-3 w-full max-w-[400px]">
                                                                                <SkeletonMedia type={GENERATIVE_MODELS.find(m => m.id === selectedModel)?.type as any || 'image'} />
                                                                            </div>
                                                                        )}
                                                                        {(visualMedia.length > 0 || textMedia.length > 0) && (
                                                                            <div className="mb-3 flex flex-wrap gap-2 w-full justify-start items-start">
                                                                                {visualMedia.map((media, index) => {
                                                                                    const sizeClass = visualMedia.length === 1 && textMedia.length === 0 ? 'w-full max-w-[400px]' : 'w-[calc(50%-4px)]';
                                                                                    return media.type === 'video' ? (
                                                                                        <div key={index} className={`relative rounded-lg overflow-hidden border border-white/10 bg-black/20 cursor-pointer hover:opacity-90 transition-opacity shrink-0 ${sizeClass}`} onClick={(e) => { e.stopPropagation(); setFullscreenFile({ path: media.originalPath, localPath: media.preview, type: 'video' }); }}>
                                                                                            <video src={media.preview} className="w-full h-[140px] sm:h-[160px] object-cover pointer-events-none" />
                                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Play size={24} className="text-white opacity-80" /></div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <img
                                                                                            key={index}
                                                                                            src={media.preview}
                                                                                            alt={`Generated Media ${index + 1}`}
                                                                                            className={`rounded-lg border border-white/10 bg-black/20 cursor-pointer hover:opacity-90 transition-opacity h-[140px] sm:h-[160px] object-cover shrink-0 ${sizeClass}`}
                                                                                            onClick={(e) => { e.stopPropagation(); setFullscreenFile({ path: media.originalPath, localPath: media.preview, type: 'image' }); }}
                                                                                        />
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                            {msg.isStreaming && showSlowLoader && !isArtActive && (
                                                                <div className="flex items-center gap-3 text-sm text-gray-400 pt-1">
                                                                    <Loader2 size={16} className="animate-spin text-blue-400" />
                                                                    <span className="animate-pulse">{thinkingStep}</span>
                                                                </div>
                                                            )}
                                                            <MessageContent text={msg.text} />
                                                            <div className="flex items-center mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleCopyAiMessage(msg.id, msg.text)}
                                                                    className={`flex items-center gap-1.5 px-2 py-1 transition-colors rounded-md text-xs font-medium ${copiedId === msg.id ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                >
                                                                    {copiedId === msg.id ? <CheckCheck size={13} /> : <Copy size={13} />}
                                                                    <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                                                                </button>
                                                                {msg.queuedAttachments && msg.queuedAttachments.length > 0 && (
                                                                    <button
                                                                        onClick={() => handleDownloadMedia(msg.queuedAttachments![0].path, msg.text, msg.id)}
                                                                        onContextMenu={handleResetDownloadPath}
                                                                        className={`flex items-center gap-1.5 px-2 py-1 transition-colors rounded-md text-xs font-medium ${savedId === msg.id ? 'text-green-400 bg-green-500/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                                                        title="Download (Right-click to reset folder)"
                                                                    >
                                                                        {savedId === msg.id ? <Check size={13} /> : <Download size={13} />}
                                                                        <span>{savedId === msg.id ? 'Saved!' : 'Save'}</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <div ref={chatEndRef} />
                                    </div>
                                </div>
                            </div>
                        )}
                        {activeTab === "Transcript" && (
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="max-w-3xl mx-auto w-full space-y-2">
                                    <div className="flex flex-col items-center justify-center sticky top-0 bg-[#0f0f14]/80 backdrop-blur-md p-4 mb-2 z-10 rounded-xl border border-white/5 shadow-lg">
                                        {isRecording ? (<> <AudioVisualizer audioContext={audioContextRef.current} source={sourceNodeRef.current} /> <div className="text-xs text-blue-400 mt-2 font-medium animate-pulse">Listening...</div> </>) : transcriptError ? (<div className="flex flex-col items-center text-red-400 gap-2 p-2 bg-red-500/10 rounded-lg"> <AlertCircle size={20} /> <span className="text-xs font-semibold text-center">{transcriptError}</span> </div>) : (<div className="text-gray-500 text-xs">Microphone inactive</div>)}
                                    </div>
                                    {transcriptLogs.length === 0 && !transcriptError && (<div className="text-gray-500 text-center mt-10 text-sm"> Speak clearly to see text appear here. </div>)}
                                    {transcriptLogs.map((log) => (<div key={log.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300"> <div className="text-[11px] text-gray-500 font-mono mb-0.5">{log.displayTime}</div> <div className="text-gray-200 leading-relaxed text-[15px] pl-2 border-l-2 border-blue-500/30"> {log.text} </div> </div>))}
                                    <div ref={transcriptEndRef} />
                                </div>
                            </div>
                        )}
                        {activeTab === "Email" && showPostMeeting && (
                            <div className="flex-1 overflow-y-auto p-2">
                                <div className="max-w-3xl mx-auto w-full h-full flex flex-col">
                                    {emailDraft ? (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-2xl">
                                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                                                <h3 className="text-white font-medium flex items-center gap-2">
                                                    <Mail size={16} /> Generated Follow-up
                                                </h3>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={handleRegenerateEmail}
                                                        disabled={isRegeneratingEmail}
                                                        className={`text-xs flex items-center gap-1 transition-colors ${isRegeneratingEmail ? 'text-blue-400 cursor-not-allowed opacity-80' : 'hover:text-blue-400 text-gray-400'}`}
                                                    >
                                                        <RefreshCw size={12} className={isRegeneratingEmail ? 'animate-spin' : ''} />
                                                        {isRegeneratingEmail ? 'Regenerating...' : 'Regenerate'}
                                                    </button>
                                                    <button
                                                        onClick={handleCopyEmail}
                                                        className={`text-xs flex items-center gap-1 transition-colors ${isCopied ? 'text-green-400' : 'hover:text-white text-gray-400'}`}
                                                    >
                                                        {isCopied ? <CheckCheck size={12} /> : <Copy size={12} />}
                                                        {isCopied ? 'Copied!' : 'Copy Draft'}
                                                    </button>
                                                </div>
                                            </div>
                                            <MessageContent text={emailDraft} />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 gap-3">
                                            <Loader2 size={24} className="animate-spin text-blue-400" />
                                            <span>Drafting email...</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === "History" && (
                            <div className="flex-1 flex flex-col min-h-0 interactive">
                                <div className="flex justify-center p-3 shrink-0 border-b border-white/5">
                                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 scale-90">
                                        <button onClick={() => setHistoryTab("Chats")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${historyTab === "Chats" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>💬 Chat Sessions</button>
                                        <button onClick={() => setHistoryTab("Meetings")} className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${historyTab === "Meetings" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}>🎙️ Meeting Transcripts</button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                                    <div className="max-w-3xl mx-auto w-full space-y-3">
                                        {historyTab === "Chats" ? (
                                            pastChats.length === 0 ? (
                                                <div className="text-center text-gray-500 mt-10 text-sm">No saved chats yet.</div>
                                            ) : (
                                                pastChats.map(chat => (
                                                    <div key={chat.id} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-blue-500/50 transition-all group relative">
                                                        <div className={`flex justify-between items-center ${expandedChats[chat.id] ? 'mb-3' : ''}`}>
                                                            <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm flex-1 min-w-0">
                                                                <button
                                                                    onClick={(e) => toggleChat(chat.id, e)}
                                                                    className="flex items-center text-blue-400 hover:text-blue-300 transition-colors p-1 rounded hover:bg-white/5 shrink-0 outline-none"
                                                                >
                                                                    {expandedChats[chat.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                </button>
                                                                <MessageSquare size={14} className="shrink-0 text-blue-400" />
                                                                {editingChatTitleId === chat.id ? (
                                                                    <div className="flex items-center gap-1.5 w-full relative" onClick={(e) => e.stopPropagation()}>
                                                                        <input type="text" autoFocus value={editingChatTitleText} onChange={(e) => setEditingChatTitleText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveChatTitle(chat, e); if (e.key === 'Escape') handleCancelEditChatTitle(e); }} onBlur={(e) => handleSaveChatTitle(chat, e)} className="bg-black/40 text-blue-300 text-xs px-2 py-1 rounded w-full border border-blue-500/50 outline-none" />
                                                                        <button onMouseDown={(e) => { e.preventDefault(); handleSaveChatTitle(chat, e); }} className="p-1 hover:text-green-400 transition-colors"><Check size={14} /></button>
                                                                        <button onMouseDown={(e) => { e.preventDefault(); handleCancelEditChatTitle(e); }} className="p-1 hover:text-red-400 transition-colors"><X size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center min-w-0 flex-1">
                                                                        <div className="marquee-container flex-1" onMouseEnter={(e) => { const span = e.currentTarget.querySelector('.marquee-content') as HTMLElement; if (span && span.scrollWidth > span.clientWidth) { span.style.setProperty('--scroll-dist', `-${span.scrollWidth - span.clientWidth + 20}px`); span.classList.add('can-marquee'); } }} onMouseLeave={(e) => { const span = e.currentTarget.querySelector('.marquee-content') as HTMLElement; if (span) span.classList.remove('can-marquee'); }}>
                                                                            <span className="marquee-content">{chat.prompt}</span>
                                                                        </div>
                                                                        <span className="text-gray-500 shrink-0 mx-1">•</span>
                                                                        <Clock size={12} className="shrink-0 text-gray-400" />
                                                                        <span className="shrink-0 text-gray-400 font-medium text-[10px] ml-0.5">{new Date(chat.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {editingChatTitleId !== chat.id && (
                                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                                                    <button onClick={(e) => handleLoadPastChat(chat, e)} className="px-2 py-0.5 bg-blue-600/20 text-blue-400 hover:bg-blue-500/40 hover:text-white rounded text-[9px] uppercase tracking-wider font-bold border border-blue-500/20 transition-all flex items-center gap-1"><ArrowRight size={10} /> Open</button>
                                                                    <button onClick={(e) => handleStartEditChatTitle(chat, e)} className="p-1 px-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Edit2 size={12} /></button>
                                                                    <button onClick={(e) => deleteChat(chat.id, e)} className="p-1 px-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={12} /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {expandedChats[chat.id] && (
                                                            <div className="mt-4 pt-4 border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col items-center">
                                                                {chat.lastMedia && (
                                                                    <div 
                                                                        className="mb-6 w-full max-w-[400px] aspect-video sm:aspect-auto sm:min-h-[200px] rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl cursor-pointer hover:opacity-90 transition-all group/media relative"
                                                                        onClick={(e) => { e.stopPropagation(); setFullscreenFile(chat.lastMedia!); }}
                                                                    >
                                                                        {chat.lastMedia.type === 'video' ? (
                                                                            <div className="w-full h-full flex items-center justify-center bg-black">
                                                                                <video src={getResolvedMediaUrl(chat.lastMedia)} className="max-w-full max-h-[300px] pointer-events-none" />
                                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-black/40 transition-colors">
                                                                                    <Play size={40} className="text-white opacity-60 group-hover/media:opacity-100 transition-opacity" />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <img 
                                                                                src={getResolvedMediaUrl(chat.lastMedia)} 
                                                                                className="w-full h-auto max-h-[400px] object-contain mx-auto" 
                                                                                alt="Session Media"
                                                                            />
                                                                        )}
                                                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity">
                                                                            <div className="flex items-center gap-2 text-[10px] text-white/70 font-medium">
                                                                                <Maximize2 size={10} /> Click to expand
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="w-full bg-black/40 rounded-lg p-4 border border-white/5 text-sm overflow-x-auto text-left">
                                                                    <MessageContent text={chat.response} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )
                                        ) : (
                                            pastMeetings.length === 0 ? (
                                                <div className="text-center text-gray-500 mt-10 text-sm">No recorded meetings yet.</div>
                                            ) : (
                                                pastMeetings.map((meeting) => (
                                                    <div key={meeting.id} className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2 hover:border-blue-500/50 transition-all group relative">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="flex items-center gap-1.5 text-blue-300 font-bold text-sm flex-1 min-w-0">
                                                                <Calendar size={14} className="shrink-0 text-blue-400" />
                                                                {editingTitleId === meeting.id ? (
                                                                    <div className="flex items-center gap-1.5 w-full relative" onClick={(e) => e.stopPropagation()}>
                                                                        <input type="text" autoFocus value={editingTitleText} onChange={(e) => setEditingTitleText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(meeting, e); if (e.key === 'Escape') handleCancelEditTitle(e); }} onBlur={(e) => handleSaveTitle(meeting, e)} className="bg-black/40 text-blue-300 text-xs px-2 py-1 rounded w-full border border-blue-500/50 outline-none" />
                                                                        <button onMouseDown={(e) => { e.preventDefault(); handleSaveTitle(meeting, e); }} className="p-1 hover:text-green-400 transition-colors"><Check size={14} /></button>
                                                                        <button onMouseDown={(e) => { e.preventDefault(); handleCancelEditTitle(e); }} className="p-1 hover:text-red-400 transition-colors"><X size={14} /></button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center min-w-0 flex-1">
                                                                        <div
                                                                            className="marquee-container"
                                                                            onMouseEnter={(e) => {
                                                                                const span = e.currentTarget.querySelector('.marquee-content') as HTMLElement;
                                                                                if (span && span.scrollWidth > span.clientWidth) {
                                                                                    span.style.setProperty('--scroll-dist', `-${span.scrollWidth - span.clientWidth + 20}px`);
                                                                                    span.classList.add('can-marquee');
                                                                                }
                                                                            }}
                                                                            onMouseLeave={(e) => {
                                                                                const span = e.currentTarget.querySelector('.marquee-content') as HTMLElement;
                                                                                if (span) span.classList.remove('can-marquee');
                                                                            }}
                                                                        >
                                                                            <span className="marquee-content">{meeting.title || new Date(meeting.date).toLocaleDateString()}</span>
                                                                        </div>
                                                                        <span className="text-gray-500 shrink-0 mx-1">•</span>
                                                                        <Clock size={12} className="shrink-0 text-gray-400" />
                                                                        <span className="shrink-0 text-gray-400 font-medium text-[10px] ml-0.5">{new Date(meeting.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {editingTitleId !== meeting.id && (
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                                                    <button onClick={(e) => handleLoadPastMeeting(meeting, e)} className="px-2 py-0.5 bg-blue-600/20 text-blue-400 hover:bg-blue-500/40 hover:text-white rounded text-[9px] uppercase tracking-wider font-bold border border-blue-500/20 transition-all flex items-center gap-1"><ArrowRight size={10} /> Open</button>
                                                                    <button onClick={(e) => handleStartEditTitle(meeting, e)} className="p-1 px-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"><Edit2 size={12} /></button>
                                                                    <button onClick={(e) => deleteMeeting(meeting.id, e)} className="p-1 px-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={12} /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="relative group/transcript text-sm mb-4">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <button onClick={(e) => toggleMeeting(meeting.id, e)} className="text-[11px] font-semibold text-blue-400/80 hover:text-blue-300 transition-colors uppercase tracking-wider flex items-center gap-1 focus:outline-none"> {expandedMeetings[meeting.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Transcript </button>
                                                                <button
                                                                    onClick={(e) => handleCopyHistoryTranscript(meeting.id, meeting.transcript, e)}
                                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all border opacity-0 group-hover/transcript:opacity-100 ${copiedTranscriptId === meeting.id ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-black/40 text-gray-500 border-white/5 hover:border-white/20 hover:text-white'}`}
                                                                >
                                                                    {copiedTranscriptId === meeting.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                                                                </button>
                                                            </div>
                                                            {expandedMeetings[meeting.id] ? (
                                                                <div className="bg-black/50 rounded-lg p-3 border border-white/5 animate-in fade-in slide-in-from-top-1">
                                                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar pr-1 text-xs text-gray-200"> {meeting.transcript.map(t => (<div key={t.id} className="mb-2 border-l border-blue-500/40 pl-2"> <span className="text-[9px] text-gray-400 block font-medium">{t.displayTime}</span> {t.text} </div>))} </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-black/40 hover:bg-black/80 hover:border-blue-500/50 transition-all rounded-lg p-3 border border-white/5 text-xs text-gray-300 hover:text-gray-100 hover:shadow-[0_0_15px_rgba(59,130,246,0.1)] line-clamp-2 cursor-pointer shadow-inner" onClick={(e) => toggleMeeting(meeting.id, e)}> {meeting.transcript.map(t => t.text).join(' ').slice(0, 120)}... </div>
                                                            )}
                                                        </div>
                                                        {meeting.emailDraft && (
                                                            <div className="relative group/email text-sm">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <button onClick={(e) => toggleEmail(meeting.id, e)} className="text-[11px] font-semibold text-purple-400/80 hover:text-purple-300 transition-colors uppercase gap-1 flex items-center focus:outline-none"> {expandedEmails[meeting.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Email </button>
                                                                    <button
                                                                        onClick={(e) => handleCopyHistoryEmail(meeting.id, meeting.emailDraft, e)}
                                                                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all border opacity-0 group-hover/email:opacity-100 ${copiedEmailId === meeting.id ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-black/40 text-gray-500 border-white/5 hover:border-white/20 hover:text-white'}`}
                                                                    >
                                                                        {copiedEmailId === meeting.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                                                                    </button>
                                                                </div>
                                                                {expandedEmails[meeting.id] ? (
                                                                    <div className="bg-black/50 p-3 rounded-lg border border-purple-500/20 animate-in fade-in slide-in-from-top-1 text-xs text-gray-200"> <MessageContent text={meeting.emailDraft} /> </div>
                                                                ) : (
                                                                    <div className="bg-black/40 hover:bg-black/80 hover:border-purple-500/40 transition-all p-3 rounded-lg border border-transparent text-xs text-gray-300 hover:text-gray-100 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)] line-clamp-2 cursor-pointer shadow-inner" onClick={(e) => toggleEmail(meeting.id, e)}> {meeting.emailDraft.slice(0, 120)}... </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {activeTab === "Chat" && (
                        <div className="p-5 bg-gradient-to-t from-black via-black/90 to-transparent shrink-0 flex flex-col items-center">
                            <div className="max-w-3xl w-full mx-auto relative">
                                {queuedScreenshots.length > 0 && (
                                    <div className="mb-3 flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl overflow-x-auto w-full">
                                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{queuedScreenshots.length}/{MAX_QUEUE_SIZE} screens ready:</span>
                                        {queuedScreenshots.map((img, index) => (
                                            <div key={img.path} className="relative group shrink-0">
                                                <img
                                                    src={img.preview}
                                                    className="w-10 h-8 rounded object-cover border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                                                    alt={`Queued Image ${index + 1}`}
                                                    onClick={(e) => { e.stopPropagation(); setFullscreenFile({ path: img.preview, type: 'image', localPath: img.path }); setHoverImage(null); }}
                                                    onMouseEnter={() => setHoverImage(img.preview)}
                                                    onMouseLeave={() => setHoverImage(null)}
                                                />
                                                <button
                                                    onClick={() => handleRemoveQueuedScreenshot(img.path)}
                                                    className="absolute -top-2 -right-2 p-0.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={10} className="text-white" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={handleClearQueue}
                                            className="flex items-center gap-1 text-red-400 text-xs hover:text-red-300 transition-colors whitespace-nowrap"
                                        >
                                            <Trash2 size={12} /> Clear All
                                        </button>
                                    </div>
                                )}

                                {queuedAttachments.length > 0 && (
                                    <div className="mb-3 flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl overflow-x-auto w-full">
                                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{queuedAttachments.length} attached:</span>
                                        {queuedAttachments.map((file) => {
                                            const isVideo = file.type === 'video';
                                            const isPDF = file.type === 'pdf';
                                            const isImage = file.type === 'image';
                                            const isCode = file.type === 'text' && (file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.py') || file.name.endsWith('.cs'));

                                            return (
                                                <div
                                                    key={file.path}
                                                    className="relative group shrink-0 flex items-center justify-between border border-white/5 bg-white/10 rounded-lg hover:bg-white/20 transition-colors pr-2"
                                                >
                                                    <div
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg cursor-pointer"
                                                        onMouseEnter={(e) => { setHoverAttachment(file); setHoverRect(e.currentTarget.getBoundingClientRect()); }}
                                                        onMouseLeave={() => { setHoverAttachment(null); setHoverRect(null); }}
                                                        onClick={() => setFullscreenFile({ ...file, localPath: file.localPath || file.path })}
                                                    >
                                                        {isVideo ? <Video size={14} className="text-purple-400 drop-shadow-sm" /> :
                                                            isPDF ? <FileText size={14} className="text-red-400 drop-shadow-sm" /> :
                                                                isImage ? <Image size={14} className="text-emerald-400 drop-shadow-sm" /> :
                                                                    isCode ? <Code size={14} className="text-blue-400 drop-shadow-sm" /> :
                                                                        <FileText size={14} className="text-gray-400" />}
                                                        <span className="text-[10px] text-gray-200 max-w-[80px] truncate">{file.name}</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveAttachedFile(file.path); }}
                                                        className="absolute -top-2 -right-2 p-0.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                                    >
                                                        <X size={10} className="text-white" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <button
                                            onClick={handleClearAttachments}
                                            className="flex items-center gap-1 text-red-400 text-xs hover:text-red-300 transition-colors whitespace-nowrap ml-auto"
                                        >
                                            <Trash2 size={12} /> Clear All
                                        </button>
                                    </div>
                                )}

                                {/* UNIVERSAL HOVER PREVIEW PORTAL */}
                                {hoverAttachment && (
                                    <div
                                        className="fixed z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                                        style={(() => {
                                            if (!hoverRect) return { bottom: '140px', left: '50%', transform: 'translateX(-50%)' };
                                            const margin = 12;
                                            const windowHeight = window.innerHeight;
                                            const windowWidth = window.innerWidth;
                                            const previewWidth = 320;

                                            // Prefer LEFT if trigger is on the right half of the screen
                                            const isOnRight = hoverRect.left > windowWidth / 2;

                                            let style: React.CSSProperties = { position: 'fixed' };

                                            if (isOnRight) {
                                                // Place to the left of the pill
                                                style.right = `${windowWidth - hoverRect.left + margin}px`;
                                                style.bottom = `${Math.min(windowHeight - hoverRect.bottom, windowHeight - 320)}px`;
                                            } else {
                                                // Place above the pill (for queue mostly)
                                                style.bottom = `${windowHeight - hoverRect.top + margin}px`;
                                                style.left = `${Math.max(margin, Math.min(hoverRect.left, windowWidth - previewWidth - margin))}px`;
                                            }

                                            return style;
                                        })()}
                                    >
                                        <div className="bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-[320px] w-screen">
                                            <div className="w-full aspect-video bg-black/40 flex items-center justify-center overflow-hidden">
                                                {(() => {
                                                    const hoverSrc = getResolvedMediaUrl(hoverAttachment);

                                                    if (hoverAttachment.type === 'video') {
                                                        return (
                                                            <video
                                                                src={hoverSrc}
                                                                autoPlay
                                                                muted
                                                                loop
                                                                className="w-full h-full object-contain"
                                                            />
                                                        );
                                                    } else if (hoverAttachment.type === 'pdf') {
                                                        return (
                                                            <iframe
                                                                src={`${hoverSrc}#toolbar=0&view=FitH`}
                                                                className="w-full h-full border-none pointer-events-none scale-[1.0] origin-top bg-white"
                                                                title="PDF Hover"
                                                            />
                                                        );
                                                    } else if (hoverAttachment.type === 'image') {
                                                        return (
                                                            <img
                                                                src={hoverSrc}
                                                                className="w-full h-full object-contain shadow-inner"
                                                                alt="Preview"
                                                            />
                                                        );
                                                    } else if (hoverAttachment.type === 'text') {
                                                        return <TextFilePreview url={hoverSrc} />;
                                                    } else {
                                                        return (
                                                            <div className="flex flex-col items-center gap-2 p-10">
                                                                <Code size={40} className="text-blue-500 opacity-40" />
                                                                <span className="text-[10px] text-gray-500 font-mono">Source File</span>
                                                            </div>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                            <div className="p-3 border-t border-white/5 flex flex-col gap-1">
                                                <span className="text-xs text-white font-semibold truncate leading-none">{hoverAttachment.name}</span>
                                                <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                                                    {hoverAttachment.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mb-3 w-full bg-white/5 hover:bg-white/10 focus-within:bg-white/10 border border-white/10 focus-within:border-white/20 rounded-2xl transition-all shadow-lg flex items-center px-1">
                                    <div className="flex items-center gap-1 px-1 shrink-0">
                                        <button onClick={handleAttachFile} className="p-2 text-gray-400 hover:text-blue-400 cursor-pointer transition-colors" title={isStealth ? undefined : "Attach File"}>
                                            <Plus size={18} />
                                        </button>

                                        <div className="relative flex items-center">
                                            <button
                                                onClick={() => {
                                                    if (isArtActive) {
                                                        setIsArtActive(false);
                                                        setShowModelMenu(false);
                                                    } else {
                                                        setShowModelMenu(!showModelMenu);
                                                    }
                                                }}
                                                className={`p-2 rounded-xl transition-all ${isArtActive
                                                    ? 'text-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.2)] active-art-pulse'
                                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                                                    }`}
                                                title={isStealth ? undefined : (isArtActive ? "Reset to Text Mode" : "Generate Art & Video")}
                                            >
                                                <Sparkles size={18} />
                                            </button>

                                            {showModelMenu && (
                                                <div className="absolute bottom-full left-0 mb-4 w-56 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1 z-[100] max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2">
                                                    <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 mb-1 bg-white/5">Studio Models</div>
                                                    {GENERATIVE_MODELS.map((m) => (
                                                        <button
                                                            key={m.id}
                                                            onClick={() => {
                                                                setSelectedModel(m.id);
                                                                setIsArtActive(true);
                                                                setShowModelMenu(false);
                                                            }}
                                                            className={`w-full text-left px-4 py-2.5 text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${selectedModel === m.id && isArtActive ? 'text-blue-400 bg-white/10' : 'text-gray-300 hover:text-white'}`}
                                                        >
                                                            <span>{m.name}</span>
                                                            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">{m.type}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        disabled={isThinking}
                                        onFocus={handleInputFocus}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); handleSend(); } }}
                                        onPaste={async (e) => {
                                            const items = e.clipboardData?.items;
                                            if (!items) return;
                                            for (let i = 0; i < items.length; i++) {
                                                if (items[i].type.indexOf('image') !== -1) {
                                                    e.preventDefault();
                                                    const file = items[i].getAsFile();
                                                    if (file && window.electronAPI && window.electronAPI.saveChatFile) {
                                                        const arrayBuffer = await file.arrayBuffer();
                                                        const ext = file.name.split('.').pop() || 'png';
                                                        try {
                                                            const protocolUrl = await window.electronAPI.saveChatFile(arrayBuffer, ext);
                                                            setQueuedScreenshots(prev => {
                                                                const newQueue = [...prev, { path: protocolUrl, preview: protocolUrl }];
                                                                if (newQueue.length > MAX_QUEUE_SIZE) newQueue.shift();
                                                                return newQueue;
                                                            });
                                                        } catch (err) { console.error("Failed to save pasted image", err); }
                                                    }
                                                }
                                            }
                                        }}
                                        placeholder={showPostMeeting ? "Ask about the meeting..." : "Ask about your screen..."}
                                        rows={1}
                                        className="flex-1 bg-transparent py-4 px-2 text-sm text-gray-100 placeholder-gray-500 outline-none resize-none overflow-y-auto"
                                        style={{ minHeight: '52px', maxHeight: '150px' }}
                                    />

                                    <div className="flex items-center gap-1.5 px-3 shrink-0">
                                        <button
                                            onClick={toggleDictation}
                                            className={`p-2 rounded-full transition-colors flex items-center justify-center ${isDictating
                                                ? 'text-[#60a5fa] bg-[#60a5fa]/10 gemini-mic-active'
                                                : 'hover:bg-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            title={isStealth ? undefined : (isDictating ? "Stop Dictation" : "Start Dictation")}
                                        >
                                            <Mic size={16} />
                                        </button>

                                        {isThinking ? (
                                            <button
                                                onClick={handleCancelGeneration}
                                                className="p-2 bg-red-600/20 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                                                title={isStealth ? undefined : "Stop Generation"}
                                            >
                                                <div className="w-3.5 h-3.5 bg-current rounded-[2px]" />
                                            </button>
                                        ) : (
                                            (input.length > 0 || queuedScreenshots.length > 0 || queuedAttachments.length > 0) && (
                                                <button onClick={() => handleSend()} className="p-2 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors">
                                                    <Send size={16} className="text-white" />
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                                {isInputFocused && (
                                    <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
                                        <button onClick={handleUseScreen} className="control-btn hover:bg-white/15 py-2 px-3"><Monitor size={14} className="text-blue-400" /><span>Queue Screen</span></button>
                                        <button onClick={() => setIsSmartMode(!isSmartMode)} className={`control-btn py-2 px-3 ${isSmartMode ? 'active' : ''}`}><Zap size={14} className={isSmartMode ? 'fill-current' : ''} /><span>Smart</span></button>
                                        <button onClick={() => window.location.hash = "#/settings"} className="control-btn py-2 px-3 text-white/60 hover:text-white/90 hover:bg-white/10 transition-all"><UserCog size={14} /><span>Persona</span></button>
                                        <div className="relative"> <button onClick={() => setShowModeMenu(!showModeMenu)} className="control-btn hover:bg-white/15 py-2 px-3"><span>{mode}</span><ChevronDown size={12} /></button> {showModeMenu && (<div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-[60]"> {['General', 'Student'].map((m) => (<button key={m} onClick={() => handleModeSelect(m)} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 ${mode === m ? 'text-blue-400 bg-white/5' : 'text-gray-300'}`}> {m} </button>))} </div>)} </div>
                                        {mode === "Student" && (<button onClick={() => setShowStudentModal(true)} className="control-btn hover:bg-white/15 py-2 px-3 text-blue-300"> <UserCog size={14} /> <span>Update Profile</span> </button>)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
            }
            {/* ✨ DYNAMIC RESIZE HANDLE */}
            <div
                onMouseDown={startResize}
                className={`absolute w-8 h-8 cursor-se-resize flex items-center justify-center interactive hover:bg-white/10 rounded-lg transition-all z-[100] group shadow-lg ${isExpanded ? "bottom-1 right-1" : "top-[85px] right-2"
                    }`}
                title={isStealth ? undefined : "Resize Window"}
            >
                <Scaling size={14} className="text-white/20 group-hover:text-blue-400 rotate-90 transition-colors" />
            </div>

        </div >
    )
}

export default Queue