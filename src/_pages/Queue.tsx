import React, { useState, useEffect, useRef } from "react"
import { 
  Play, Pause, Square, ChevronDown, ChevronUp, 
  X, Mic, Monitor, Zap, Send, 
  Loader2, Sparkles, MessageSquare, History,
  GripHorizontal, HelpCircle, MessageCircleQuestion, FileText,
  Scaling, Copy, Check, Trash2, Mail,
  Calendar, Clock, ArrowRight, AlertCircle, Upload, UserCog,
  Eye, EyeOff 
} from "lucide-react"

// --- IMPORTS FOR FORMULAS & HIGHLIGHTING ---
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';

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
  timestamp: number
  isStreaming?: boolean 
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

interface ChatContext {
  isInMeeting: boolean;
  uploadedFilesContent: string;
  meetingTranscript: string;
  userImage?: string; 
}

// --- TITLE CLEANER UTILITY ---
const cleanMeetingTitle = (rawTitle: string): string => {
  if (!rawTitle) return "Untitled Meeting";
  return rawTitle
    .replace(/[#*`"']/g, '') // Remove Markdown chars (#, *, `, ", ')
    .replace(/^Title:\s*/i, '') // Remove "Title:" prefix if present
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
             } catch(e) { return; }
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
          h1: ({children}) => <h1 className="text-xl font-bold mt-4 mb-2 text-blue-400 border-b border-white/10 pb-2">{children}</h1>,
          h2: ({children}) => <h2 className="text-lg font-bold mt-3 mb-2 text-purple-300">{children}</h2>,
          h3: ({children}) => <h3 className="text-md font-semibold mt-2 mb-1 text-gray-100 uppercase tracking-wide opacity-80">{children}</h3>,
          strong: ({children}) => <strong className="font-bold text-yellow-400">{children}</strong>,
          ul: ({children}) => <ul className="list-disc ml-5 my-2 space-y-1 text-gray-300">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal ml-5 my-2 space-y-1 text-gray-300">{children}</ol>,
          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
          blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500/50 pl-4 my-2 italic text-gray-400 bg-white/5 py-1 rounded-r">{children}</blockquote>,
          div: ({node, className, children, ...props}) => {
             return <div className={`my-4 p-2 rounded-lg text-center overflow-x-auto ${className || ''}`} {...props}>{children}</div>
          },
          table: ({node, ...props}) => (
            <div className="overflow-x-auto my-4 border border-white/10 rounded-xl bg-white/5 shadow-sm">
              <table className="w-full text-left border-collapse text-sm" {...props} />
            </div>
          ),
          thead: ({node, ...props}) => <thead className="bg-white/5 text-gray-100" {...props} />,
          th: ({node, ...props}) => <th className="p-3 border-b border-white/10 font-semibold text-xs uppercase tracking-wider text-blue-300" {...props} />,
          tbody: ({node, ...props}) => <tbody className="divide-y divide-white/5" {...props} />,
          tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
          td: ({node, ...props}) => <td className="p-3 text-gray-300" {...props} />,
          code: ({node, inline, className, children, ...props}: any) => {
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
                      {isCopied ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>}
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

// --- STUDENT SETUP MODAL ---
const StudentModeSetupModal = ({ open, onClose, onSave }: { open: boolean, onClose: () => void, onSave: (files: File[]) => void }) => {
  const [files, setFiles] = useState<File[]>([]);
  if (!open) return null;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        const uploaded = Array.from(e.target.files).slice(0, 6);
        setFiles(uploaded);
    }
  };
  return (
    // FIX: Added 'interactive' class so clicks register even if window is click-through
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 interactive">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold text-white mb-2">Student Mode Setup</h2>
        <p className="text-gray-400 text-sm mb-4">Upload resume or project files (max 6).</p>
        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors relative cursor-pointer">
            <input type="file" multiple accept=".pdf,.txt,.md,.ts,.js,.py" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            <Upload size={32} className="text-blue-400 mb-2"/>
            <span className="text-sm text-gray-300">Click to upload files</span>
        </div>
        {files.length > 0 && (
            <div className="mt-4 space-y-2">
                {files.map((f, i) => <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 p-2 rounded"><FileText size={12}/><span className="truncate">{f.name}</span></div>)}
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

// --- MAIN COMPONENT ---
const Queue: React.FC<any> = ({ setView }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<"Chat" | "Transcript" | "Email" | "History">("Chat")
  const [isInputFocused, setIsInputFocused] = useState(false)
  
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingStep, setThinkingStep] = useState("")
  
  // --- Multi-Screenshot State ---
  const [queuedScreenshots, setQueuedScreenshots] = useState<ScreenshotData[]>([]);

  // --- Slow Loader State & Timer Ref ---
  const [showSlowLoader, setShowSlowLoader] = useState(false)
  const loadingTimerRef = useRef<any>(null)
  
  const [mode, setMode] = useState("General")
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [isSmartMode, setIsSmartMode] = useState(false)
  
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcriptLogs, setTranscriptLogs] = useState<TranscriptItem[]>([])
  const [showPostMeeting, setShowPostMeeting] = useState(false)
  const [emailDraft, setEmailDraft] = useState("")
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [meetingStartTime, setMeetingStartTime] = useState<number>(0)
  
  const [pastMeetings, setPastMeetings] = useState<MeetingSession[]>([])
  
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // --- STEALTH MODE STATE ---
  const [isStealth, setIsStealth] = useState(true);

  // --- AUDIO REFS ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const meetingStartTimeRef = useRef<number>(0)
  const transcriptLengthRef = useRef(0);
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startX: number, startY: number, startW: number, startH: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true) 
  
  const isExpandedRef = useRef(isExpanded);
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { transcriptLengthRef.current = transcriptLogs.length; }, [transcriptLogs]);

  const MAX_QUEUE_SIZE = 6;

  // Helper to capture a screenshot and manage the queue/send action
  const handleCapture = async () => {
    try { 
        if (!window.electronAPI) {
            console.error("[UI] Electron API is undefined. Cannot capture screenshot.");
            return;
        }

        console.log(`[UI] 📸 Starting capture (Queue Action)`); 
        
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

        if (!isExpanded) handleExpandToggle(); 
        setActiveTab("Chat"); 
        
    } catch(e) {
        console.error("[UI] Screenshot Failed:", e);
        alert("Screenshot failed. Check console for details.");
    } 
  }
  
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

  useEffect(() => {
    if (window.electronAPI) {
        window.electronAPI.setWindowSize({ width: 450, height: 120 })
    }
    setIsExpanded(false) 
    
    if (window.electronAPI && window.electronAPI.getStealthMode) {
      window.electronAPI.getStealthMode().then(setIsStealth).catch(console.error);
    }
    
    const saved = localStorage.getItem('moubely_meetings')
    if (saved) {
        try { setPastMeetings(JSON.parse(saved)) } catch(e) {}
    }

    let cleanupStream = () => {};
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
            setIsThinking(false);
            isAtBottomRef.current = true;
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
    }

    return () => { 
        cleanupFunctions.forEach(fn => fn());
        cleanupStream(); 
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [])

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
      isAtBottomRef.current = distanceToBottom < 50;
  };

  useEffect(() => {
    if (activeTab === "Chat" && isAtBottomRef.current && chatContainerRef.current) {
        chatContainerRef.current.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
    if (activeTab === "Transcript" && transcriptEndRef.current) {
        transcriptEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, transcriptLogs, activeTab, isExpanded])

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
      recorder.onstop = async () => {
          if (isPausedRef.current || !window.electronAPI) return;
          const blob = new Blob(chunks, { type: 'audio/webm' });
          if (blob.size > 0) {
              const reader = new FileReader();
              reader.readAsDataURL(blob);
              reader.onloadend = async () => {
                  const base64Audio = (reader.result as string).split(',')[1];
                  try {
                      const result = await window.electronAPI.analyzeAudioFromBase64(base64Audio, 'audio/webm');
                      if (result.text && result.text.length > 0) {
                          const elapsed = Math.floor((Date.now() - meetingStartTimeRef.current) / 1000);
                          const mins = Math.floor(elapsed / 60);
                          const secs = elapsed % 60;
                          const displayTime = `${mins}:${secs.toString().padStart(2, '0')}`;
                          setTranscriptLogs(prev => [...prev, { id: Date.now().toString(), text: result.text, timestamp: Date.now(), displayTime }]);
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
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000); 
  };

  const handleStartSession = async () => {
    try {
        setTranscriptError(null);
        const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        
        let systemStream: MediaStream | null = null;
        try { systemStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true }); } catch (err) {}

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
        
        resetChat();
        setTranscriptLogs([]);
        setShowPostMeeting(false);
        setEmailDraft("");
        
        const startT = Date.now();
        setMeetingStartTime(startT);
        meetingStartTimeRef.current = startT; 
        
        setIsRecording(true);
        setIsPaused(false);
        setIsFinalizing(false);
        isRecordingRef.current = true;
        isPausedRef.current = false;
        
        if(!isExpanded) handleExpandToggle();
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

  const handleExpandToggle = () => {
    if (window.electronAPI) {
        if (!isExpanded) { window.electronAPI.setWindowSize({ width: 500, height: 700 }); setIsExpanded(true); } 
        else { window.electronAPI.setWindowSize({ width: 450, height: 120 }); setIsExpanded(false); }
    } else {
        setIsExpanded(!isExpanded); 
    }
  }

  const handleMeetingEnd = async () => {
    if (transcriptLogs.length === 0 && !isFinalizing) return;
    
    setShowPostMeeting(true);
    if(!isExpanded) handleExpandToggle();
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
  }
  
  useEffect(() => {
      const generateEmailAfterFinalize = async () => {
          if (!isFinalizing && showPostMeeting && !emailDraft && transcriptLogs.length > 0 && window.electronAPI) {
              setIsThinking(true);
              setThinkingStep("Drafting summary...");
              const fullTranscript = transcriptLogs.map(t => t.text).join(" ");
              let generatedEmail = "";
              let generatedTitle = `Meeting ${new Date().toLocaleDateString()}`;
              try {
                  const [emailResponse, titleResponse] = await Promise.all([
                      window.electronAPI.invoke("gemini-chat", `Based on this transcript, draft a professional follow-up email:\n\n${fullTranscript}`),
                      window.electronAPI.invoke("gemini-chat", `Based on this transcript, generate a very short, concise title (under 6 words) for this meeting. No quotes, no markdown:\n\n${fullTranscript}`)
                  ]);
                  
                  generatedEmail = emailResponse;
                  // FIX: Use cleaner function
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
              } catch (e) { setEmailDraft("Failed to generate content."); } 
              finally { setIsThinking(false); }
          }
      };
      generateEmailAfterFinalize();
  }, [isFinalizing, showPostMeeting]);

  const handleModeSelect = async (selectedMode: string) => {
      setMode(selectedMode); setShowModeMenu(false);
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


  const handleCopyUserMessage = (text: string) => { navigator.clipboard.writeText(text); }
  const startResize = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: document.body.offsetWidth, startH: document.body.offsetHeight }; document.addEventListener('mousemove', doResize); document.addEventListener('mouseup', stopResize); }
  const doResize = (e: MouseEvent) => { 
      if (!resizeRef.current || !window.electronAPI) return; 
      const diffX = e.clientX - resizeRef.current.startX; 
      const diffY = e.clientY - resizeRef.current.startY; 
      const newWidth = Math.max(150, resizeRef.current.startW + diffX); 
      const newHeight = Math.max(50, resizeRef.current.startH + diffY); 
      window.electronAPI.setWindowSize({ width: newWidth, height: newHeight }); 
  }
  const stopResize = () => { resizeRef.current = null; document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }
  const loadMeeting = (m: MeetingSession) => { setTranscriptLogs(m.transcript); setEmailDraft(m.emailDraft); setShowPostMeeting(true); setActiveTab("Transcript"); setMessages([{id: Date.now().toString(), role: "ai", text: `Loaded meeting: ${new Date(m.date).toLocaleString()}`, timestamp: Date.now()}]); }
  const deleteMeeting = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const u = pastMeetings.filter(m => m.id !== id); setPastMeetings(u); localStorage.setItem('moubely_meetings', JSON.stringify(u)); }

  const handleSend = async (overrideText?: string) => {
    if (!window.electronAPI) return;
      
    const textToSend = overrideText || input
    const imagesToSend = queuedScreenshots;
    const hasImages = imagesToSend.length > 0;
    
    if (!textToSend.trim() && !hasImages) return

    const aiMsgId = (Date.now() + 1).toString();

    const newMessages: Message[] = [
        ...messages,
        { 
            id: Date.now().toString(), 
            role: "user", 
            text: textToSend || (hasImages ? `Analyze ${imagesToSend.length} screens.` : ""), 
            queuedScreenshots: hasImages ? imagesToSend : undefined,
            timestamp: Date.now() 
        },
        { 
            id: aiMsgId, 
            role: "ai", 
            text: "", 
            timestamp: Date.now(),
            isStreaming: true 
        }
    ];

    setMessages(newMessages)
    setInput("")

    setIsThinking(true)
    setThinkingStep(hasImages ? `Vision processing ${imagesToSend.length} screens...` : "Thinking...")
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
        userImage: hasImages ? imagesToSend[0].preview : undefined 
    };

    const finalPrompt = preparePayload(textToSend, contextData);

    try {
      let fullResponse = "";
      
      const args = {
          message: finalPrompt,
          mode: mode,
          history: messages.map(m => ({ role: m.role, text: m.text })) 
      };

      if (hasImages) {
         const imagePaths = imagesToSend.map(i => i.path);
         fullResponse = await window.electronAPI.chatWithImage(finalPrompt, imagePaths)
      } else {
         fullResponse = await window.electronAPI.invoke("gemini-chat", args)
      }
      
      setMessages(prev => prev.map(m => 
          m.id === aiMsgId ? { ...m, text: fullResponse, isStreaming: false } : m
      ));

    } catch (error: any) {
      setMessages(prev => prev.map(m => 
          m.id === aiMsgId ? { ...m, text: "Error: " + error.message, isStreaming: false } : m
      ));
    } finally { 
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      setShowSlowLoader(false);
      setIsThinking(false);
      
      if (hasImages) {
          handleClearQueue(); 
      }
    }
  }

  // --- UPDATED: TRIGGER ASSIST ACTION (New Logic) ---
  const triggerAssistAction = async (actionType: "Assist" | "WhatToSay" | "FollowUp" | "Recap") => {
    if (!window.electronAPI) return;
      
    // 1. Get Context
    let transcriptText = transcriptLogs.map(t => t.text).join(" ");
    // Fallback to chat history if transcript is empty
    if (!transcriptText.trim() && messages.length > 0) {
        transcriptText = messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
    }
    
    if (!transcriptText.trim()) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "I haven't heard enough yet to assist.", timestamp: Date.now() }]);
        return;
    }

    // 2. Set UI State
    setActiveTab("Chat")
    setIsThinking(true)
    setThinkingStep("Thinking...");
    
    // 3. Add User Message
    let userDisplayMessage = "";
    let systemPrompt = "";
    
    switch (actionType) {
      case "Assist": 
          userDisplayMessage = "Assist me."; 
          systemPrompt = `Based on this transcript: "${transcriptText}". Provide helpful facts, context, or technical details relevant to the current topic. Be concise.`; 
          break;
      case "WhatToSay": 
          userDisplayMessage = "What next?"; 
          systemPrompt = `Based on this transcript: "${transcriptText}". Suggest 3 distinct, professional, and smart responses I could say right now.`; 
          break;
      case "FollowUp": 
          userDisplayMessage = "Follow-up Qs."; 
          systemPrompt = `Based on this transcript: "${transcriptText}". Generate 3 insightful follow-up questions I should ask the speaker.`; 
          break;
      case "Recap": 
          userDisplayMessage = "Recap."; 
          systemPrompt = `Based on this transcript: "${transcriptText}". Provide a quick bullet-point summary of what has been discussed so far.`; 
          break;
    }
    
    const aiMsgId = (Date.now() + 1).toString();
    setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: "user", text: userDisplayMessage, timestamp: Date.now() },
        { id: aiMsgId, role: "ai", text: "", timestamp: Date.now(), isStreaming: true }
    ]);

    // 4. Call AI
    try {
        const history = messages.map(m => ({ role: m.role, text: m.text }));
        // Use "General" mode to allow universal context
        const response = await window.electronAPI.invoke("gemini-chat", { message: systemPrompt, mode: "General", history: history });
        
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: response, isStreaming: false } : m));
    } catch (e: any) { 
        console.error(e);
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: "Error: " + e.message, isStreaming: false } : m));
    } finally { 
        setIsThinking(false);
    }
  }

  const handleInputFocus = () => { 
      setIsInputFocused(true); 
      if (!isExpanded) handleExpandToggle(); 
  }

  return (
    <div className={`moubely-window ${isExpanded ? 'expanded' : ''} flex flex-col h-full relative overflow-hidden`}>
      <StudentModeSetupModal open={showStudentModal} onClose={() => { setShowStudentModal(false); if(mode === "Student") setMode("General"); }} onSave={handleSaveStudentFiles} />
      <div className="px-4 pt-3 pb-0 z-50 shrink-0">
        {!isExpanded && (
          <div className="flex justify-center mb-3 animate-in fade-in slide-in-from-top-2">
             <button onClick={isRecording ? handlePauseToggle : handleStartSession} className={`status-pill interactive hover:scale-105 transition-all no-drag ${isRecording ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}>
                {!isRecording ? <><Play size={12} fill="currentColor" /><span>Start Moubely</span></> : 
                 isPaused ? <><Play size={12} fill="currentColor" /><span>Resume Session</span></> :
                <><span>Session in progress</span><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1"/></>}
             </button>
          </div>
        )}
        <div className="compact-bar interactive no-drag">
            <div className="flex items-center gap-2">
               {!isRecording ? ( <button onClick={handleStartSession} className="icon-btn hover:text-green-400 hover:bg-green-400/10"><Play size={18} fill="currentColor"/></button> ) : (
                   <> <button onClick={handlePauseToggle} className={`icon-btn ${isPaused ? 'text-yellow-400' : 'text-blue-400'}`}>{isPaused ? <Play size={18} fill="currentColor"/> : <Pause size={18} fill="currentColor"/>}</button>
                       <button onClick={handleStopSession} className="icon-btn hover:text-red-400 hover:bg-red-400/10"><Square size={16} fill="currentColor" className="text-red-400"/></button> </>
               )}
               <button onClick={() => { resetChat(); setTranscriptLogs([]); setShowPostMeeting(false); }} className="icon-btn hover:text-red-400"><Trash2 size={16}/></button>
            </div>
            <div className="flex-1 flex justify-center"><div className="draggable cursor-grab active:cursor-grabbing p-2 rounded hover:bg-white/5 group"><GripHorizontal size={20} className="text-gray-600 group-hover:text-gray-400"/></div></div>
            <div className="flex items-center gap-2">
               {/* STEALTH TOGGLE */}
               <button 
                 onClick={handleToggleStealth} 
                 className={`icon-btn ${isStealth ? 'text-gray-500 hover:text-white' : 'text-yellow-500 hover:text-yellow-400'}`}
                 title={isStealth ? "Stealth Mode ON (Hidden)" : "Stealth Mode OFF (Visible)"}
               >
                  {isStealth ? <EyeOff size={20}/> : <Eye size={20}/>}
               </button>
               
               <button onClick={handleExpandToggle} className="icon-btn">{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
               <button onClick={() => window.electronAPI && window.electronAPI.quitApp()} className="icon-btn hover:text-red-400"><X size={20}/></button>
            </div>
         </div>
      </div>
      {isExpanded && (
        <div className="flex-1 flex flex-col min-h-0 interactive animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
           <div className="tab-nav justify-start overflow-x-auto no-scrollbar shrink-0">
              <button onClick={() => setActiveTab("Chat")} className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`}>Chat</button>
              <button onClick={() => setActiveTab("Transcript")} className={`tab-btn ${activeTab === 'Transcript' ? 'active' : ''}`}>Transcript</button>
              
              {showPostMeeting && <button onClick={() => setActiveTab("Email")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'Email' ? 'active' : ''}`}><Mail size={14}/> Email</button>}
              <button onClick={() => setActiveTab("History")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'History' ? 'active' : ''}`}><History size={14}/> History</button>
              
              {/* --- UPDATED: ASSIST BUTTONS --- */}
              {!showPostMeeting && (
                  <> 
                    <div className="w-px h-4 bg-white/10 mx-2 self-center shrink-0"/>
                    
                    <button onClick={() => triggerAssistAction("Assist")} className="tab-btn flex items-center gap-1.5 hover:text-blue-300 whitespace-nowrap">
                        <Sparkles size={14}/> Assist
                    </button>
                    
                    <button onClick={() => triggerAssistAction("WhatToSay")} className="tab-btn flex items-center gap-1.5 hover:text-green-300 whitespace-nowrap">
                        <MessageCircleQuestion size={14}/> What to say?
                    </button>
                    
                    <button onClick={() => triggerAssistAction("FollowUp")} className="tab-btn flex items-center gap-1.5 hover:text-purple-300 whitespace-nowrap">
                        <HelpCircle size={14}/> Follow-up
                    </button>
                    
                    <button onClick={() => triggerAssistAction("Recap")} className="tab-btn flex items-center gap-1.5 hover:text-orange-300 whitespace-nowrap">
                        <FileText size={14}/> Recap
                    </button> 
                  </>
              )}
              {/* --------------------------- */}
           </div>
           <div className="content-area flex-1 overflow-hidden flex flex-col">
              {activeTab === "Chat" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div 
                    className="flex-1 overflow-y-auto chat-scroll-area space-y-5 pb-4 px-2"
                    ref={chatContainerRef}
                    onScroll={handleScroll}
                  >
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        {msg.role === "user" && (
                            <div className="group relative max-w-[85%]">
                                {msg.queuedScreenshots && msg.queuedScreenshots.length > 0 && (
                                    <div className={`mb-2 grid gap-2 ${msg.queuedScreenshots.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                        {msg.queuedScreenshots.map((img, index) => (
                                            <img 
                                                key={index}
                                                src={img.preview} 
                                                alt={`Screenshot ${index + 1}`} 
                                                className="rounded-lg border border-white/10 max-w-full h-auto max-h-[200px] object-cover bg-black/20"
                                            />
                                        ))}
                                    </div>
                                )}
                                <div className="user-bubble text-left">{msg.text}</div>
                                <button onClick={() => handleCopyUserMessage(msg.text)} className="absolute top-1/2 -left-8 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white bg-black/40 rounded-full"><Copy size={12}/></button>
                            </div>
                        )}
                        {msg.role === "ai" && (
                            <div className="ai-message max-w-[95%]">
                                <MessageContent text={msg.text} />
                            </div>
                        )}
                      </div>
                    ))}
                    {showSlowLoader && (
                        <div className="flex items-center gap-3 text-sm text-gray-400 pl-1">
                            <Loader2 size={16} className="animate-spin text-blue-400"/>
                            <span className="animate-pulse">{thinkingStep}</span>
                        </div>
                    )}
                    <div ref={chatEndRef}/>
                  </div>
                </div>
              )}
              {activeTab === "Transcript" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                   <div className="flex flex-col items-center justify-center sticky top-0 bg-[#0f0f14]/80 backdrop-blur-md p-4 mb-2 z-10 rounded-xl border border-white/5 shadow-lg">
                        {isRecording ? ( <> <AudioVisualizer audioContext={audioContextRef.current} source={sourceNodeRef.current} /> <div className="text-xs text-blue-400 mt-2 font-medium animate-pulse">Listening...</div> </> ) : transcriptError ? ( <div className="flex flex-col items-center text-red-400 gap-2 p-2 bg-red-500/10 rounded-lg"> <AlertCircle size={20}/> <span className="text-xs font-semibold text-center">{transcriptError}</span> </div> ) : ( <div className="text-gray-500 text-xs">Microphone inactive</div> )}
                   </div>
                   {transcriptLogs.length === 0 && !transcriptError && ( <div className="text-gray-500 text-center mt-10 text-sm"> Speak clearly to see text appear here. </div> )}
                   {transcriptLogs.map((log) => ( <div key={log.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300"> <div className="text-[11px] text-gray-500 font-mono mb-0.5">{log.displayTime}</div> <div className="text-gray-200 leading-relaxed text-[15px] pl-2 border-l-2 border-blue-500/30"> {log.text} </div> </div> ))}
                   <div ref={transcriptEndRef}/>
                </div>
              )}
              {activeTab === "Email" && showPostMeeting && (
                <div className="flex-1 overflow-y-auto p-2">
                    {emailDraft ? ( <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-2xl"> <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10"> <h3 className="text-white font-medium flex items-center gap-2"><Mail size={16}/> Generated Follow-up</h3> <button onClick={() => navigator.clipboard.writeText(emailDraft)} className="text-xs flex items-center gap-1 hover:text-white text-gray-400"><Copy size={12}/> Copy Draft</button> </div> <MessageContent text={emailDraft} /> </div> ) : ( <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3"> <Loader2 size={24} className="animate-spin text-blue-400"/> <span>Drafting email...</span> </div> )}
                </div>
              )}
              {activeTab === "History" && (
                  <div className="flex-1 overflow-y-auto p-2 space-y-3">
                      {pastMeetings.length === 0 ? ( <div className="text-gray-500 text-center mt-10 text-sm">No recorded meetings yet.</div> ) : ( pastMeetings.map((meeting) => ( <div key={meeting.id} onClick={() => loadMeeting(meeting)} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 cursor-pointer transition-colors group"> <div className="flex justify-between items-start mb-2"> <div className="flex items-center gap-2 text-blue-300 font-medium"> <Calendar size={14}/> <span>{meeting.title || new Date(meeting.date).toLocaleDateString()}</span> <span className="text-gray-500">•</span> <Clock size={14}/> <span>{new Date(meeting.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> </div> <button onClick={(e) => deleteMeeting(meeting.id, e)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14}/></button> </div> <div className="text-sm text-gray-400 line-clamp-2 mb-3"> {meeting.transcript.map(t => t.text).join(' ').slice(0, 150)}... </div> <div className="flex items-center gap-2 text-xs text-blue-400 font-medium group-hover:text-blue-300"> <span>View Details</span> <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform"/> </div> </div> )) )}
                  </div>
              )}
           </div>
           {activeTab === "Chat" && (
             <div className="p-5 bg-gradient-to-t from-black via-black/90 to-transparent shrink-0">
                {queuedScreenshots.length > 0 && (
                    <div className="mb-3 flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
                        <span className="text-xs text-gray-400 font-medium whitespace-nowrap">{queuedScreenshots.length}/{MAX_QUEUE_SIZE} screens ready:</span>
                        {queuedScreenshots.map((img, index) => (
                            <div key={img.path} className="relative group shrink-0">
                                <img 
                                    src={img.preview} 
                                    className="w-10 h-8 rounded object-cover border border-white/10"
                                    alt={`Queued Image ${index + 1}`}
                                />
                                <button 
                                    onClick={() => handleRemoveQueuedScreenshot(img.path)} 
                                    className="absolute -top-2 -right-2 p-0.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remove Image"
                                >
                                    <X size={10} className="text-white"/>
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={handleClearQueue} 
                            className="flex items-center gap-1 text-red-400 text-xs hover:text-red-300 transition-colors whitespace-nowrap"
                        >
                            <Trash2 size={12}/> Clear All
                        </button>
                    </div>
                )}

                <div className="relative mb-3">
                   <textarea ref={textareaRef} value={input} onFocus={handleInputFocus} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); handleSend(); } }} placeholder={showPostMeeting ? "Ask about the meeting..." : "Ask about your screen..."} rows={1} className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-white/20 rounded-2xl px-5 py-4 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all shadow-lg resize-none overflow-y-auto" style={{ minHeight: '52px', maxHeight: '150px' }} />
                   {(input.length > 0 || queuedScreenshots.length > 0) && <button onClick={() => handleSend()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors"><Send size={16} className="text-white"/></button>}
                </div>
                {isInputFocused && (
                   <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <button onClick={handleUseScreen} className="control-btn hover:bg-white/15 py-2 px-3"><Monitor size={14} className="text-blue-400"/><span>Queue Screen</span></button>
                      <button onClick={() => setIsSmartMode(!isSmartMode)} className={`control-btn py-2 px-3 ${isSmartMode ? 'active' : ''}`}><Zap size={14} className={isSmartMode ? 'fill-current' : ''}/><span>Smart</span></button>
                      <div className="relative"> <button onClick={() => setShowModeMenu(!showModeMenu)} className="control-btn hover:bg-white/15 py-2 px-3"><span>{mode}</span><ChevronDown size={12}/></button> {showModeMenu && ( <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-[60]"> {['General', 'Developer', 'Student'].map((m) => ( <button key={m} onClick={() => handleModeSelect(m)} className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 ${mode === m ? 'text-blue-400 bg-white/5' : 'text-gray-300'}`}> {m} </button> ))} </div> )} </div>
                      {mode === "Student" && ( <button onClick={() => setShowStudentModal(true)} className="control-btn hover:bg-white/15 py-2 px-3 text-blue-300"> <UserCog size={14} /> <span>Update Profile</span> </button> )}
                   </div>
                )}
             </div>
           )}
        </div>
      )}
      <div onMouseDown={startResize} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 interactive hover:bg-white/10 rounded-tl-lg z-[60]"> <Scaling size={14} className="text-gray-500" /> </div>
    </div>
  )
}

export default Queue