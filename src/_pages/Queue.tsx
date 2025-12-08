import React, { useState, useEffect, useRef } from "react"
import { 
  Play, Pause, Square, ChevronDown, ChevronUp, 
  X, Mic, Monitor, Zap, Send, 
  Loader2, Sparkles, MessageSquare, History,
  GripHorizontal, HelpCircle, MessageCircleQuestion, FileText,
  Scaling, Copy, Check, CheckCircle2, Trash2, Mail, Volume2,
  Calendar, Clock, ArrowRight, MicOff, AlertCircle, Upload, UserCog
} from "lucide-react"
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';

// --- TYPES ---
interface Message {
  id: string
  role: "user" | "ai"
  text: string
  screenshotPath?: string
  timestamp: number
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
             } catch(e) {
                 return;
             }
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

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [audioContext, source]);

    return <canvas ref={canvasRef} width={200} height={40} className="w-32 h-8 opacity-80" />;
};

// --- HELPER: Message Content Renderer ---
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="text-[14px] leading-relaxed text-gray-200 markdown-content">
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
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
                    <button 
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 hover:text-white text-gray-400 transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded cursor-pointer"
                    >
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-xl font-semibold text-white mb-2">Student Mode Setup</h2>
        <p className="text-gray-400 text-sm mb-4">
          To tailor responses to your skill level, please upload your resume or recent project files (max 6).
        </p>

        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors relative">
            <input 
                type="file" 
                multiple 
                accept=".pdf,.txt,.md,.ts,.js,.py" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload size={32} className="text-blue-400 mb-2"/>
            <span className="text-sm text-gray-300">Click to upload files</span>
            <span className="text-xs text-gray-500 mt-1">.txt, .md, .pdf, code files</span>
        </div>

        {files.length > 0 && (
            <div className="mt-4 space-y-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 p-2 rounded">
                        <FileText size={12}/>
                        <span className="truncate">{f.name}</span>
                    </div>
                ))}
            </div>
        )}

        <div className="flex gap-3 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Skip / Cancel</button>
          <button 
            onClick={() => onSave(files)} 
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
          >
            {files.length === 0 ? "Continue without files" : "Save & Enable"}
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
  const [pendingScreenshot, setPendingScreenshot] = useState<{path: string, preview: string} | null>(null)
  
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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  // NEW: Ref to store destination so loop can access it
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  // NEW: Ref to store start time so loop can access it
  const meetingStartTimeRef = useRef<number>(0)
  
  const chatEndRef = useRef<HTMLDivElement>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ startX: number, startY: number, startW: number, startH: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // REFS FOR STATE TRACKING (Fixes Stale Closure Loop Bug)
  const isExpandedRef = useRef(isExpanded);
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  useEffect(() => { isExpandedRef.current = isExpanded; }, [isExpanded]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // Init
  useEffect(() => {
    window.electronAPI.setWindowSize({ width: 450, height: 120 })
    setIsExpanded(false) 
    
    const saved = localStorage.getItem('moubely_meetings')
    if (saved) {
        try { setPastMeetings(JSON.parse(saved)) } catch(e) {}
    }

    const cleanupFunctions = [
        window.electronAPI.onResetView(() => {
            resetChat();
            setTranscriptLogs([]);
            setShowPostMeeting(false);
            setTranscriptError(null);
            handleStopSession();
        }),
        window.electronAPI.onScreenshotTaken((data) => {
            setPendingScreenshot(data);
            if (!isExpandedRef.current) {
                window.electronAPI.setWindowSize({ width: 500, height: 700 });
                setIsExpanded(true);
            }
            setActiveTab("Chat");
            setIsInputFocused(true);
        })
    ];
    return () => cleanupFunctions.forEach(fn => fn());
  }, [])

  const resetChat = () => {
    setMessages([{ id: "init", role: "ai", text: "Hi there. I'm Moubely. I'm ready to listen.", timestamp: Date.now() }]);
  }

  useEffect(() => {
    if (activeTab === "Chat") chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    if (activeTab === "Transcript") transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, transcriptLogs, activeTab, isExpanded])

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'; 
        const newHeight = Math.min(textareaRef.current.scrollHeight, 150);
        textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  // --- REUSABLE RECORDING LOOP ---
  const startRecordingLoop = () => {
      // Check if we should even be recording
      if (!isRecordingRef.current || !destinationRef.current) return;

      const recorder = new MediaRecorder(destinationRef.current.stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = recorder;
      let chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
          // Check if paused - if so, DO NOT PROCESS and DO NOT RESTART yet.
          if (isPausedRef.current) return;

          // Process the chunk
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
                      console.error("Transcript Error:", e);
                      if (e.message && e.message.includes("API key")) {
                          setTranscriptError("API Key Invalid.");
                          setIsRecording(false); 
                      }
                  }
              };
          }
          
          // --- RESTART LOGIC ---
          // Only restart if we are still recording and NOT paused
          if (isRecordingRef.current && !isPausedRef.current) {
              setTimeout(() => startRecordingLoop(), 100); 
          }
      };

      recorder.start();
      
      // Force stop every 5 seconds
      setTimeout(() => {
          if (recorder.state === 'recording') {
              recorder.stop(); 
          }
      }, 5000);
  };

  // --- START SESSION ---
  const handleStartSession = async () => {
    try {
        setTranscriptError(null);
        
        const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        
        let systemStream: MediaStream | null = null;
        try {
            systemStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } catch (err) { console.log("System audio fallback."); }

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const destination = audioCtx.createMediaStreamDestination();

        const micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(destination);
        sourceNodeRef.current = micSource;

        if (systemStream) {
            const systemSource = audioCtx.createMediaStreamSource(systemStream);
            systemSource.connect(destination);
        }

        // Save destination for loop access
        destinationRef.current = destination;

        // --- STATE UPDATES ---
        resetChat();
        setTranscriptLogs([]);
        setShowPostMeeting(false);
        setEmailDraft("");
        const startT = Date.now();
        setMeetingStartTime(startT);
        meetingStartTimeRef.current = startT; // Sync Ref
        
        setIsRecording(true);
        setIsPaused(false);
        
        // Force refs to update immediately
        isRecordingRef.current = true;
        isPausedRef.current = false;
        
        if(!isExpanded) handleExpandToggle();
        setActiveTab("Transcript");

        // Start the loop
        startRecordingLoop();

    } catch (err) { 
        console.error("Audio setup error:", err) 
        setTranscriptError("Microphone access denied.")
    }
  }

  // --- PAUSE TOGGLE FIX ---
  const handlePauseToggle = () => {
      if (isPaused) {
          // RESUME
          setIsPaused(false);
          isPausedRef.current = false; // Sync ref immediately
          // Restart the loop since it died when we paused
          startRecordingLoop();
      } else {
          // PAUSE
          setIsPaused(true);
          isPausedRef.current = true; // Sync ref immediately
          // Force stop the current recorder to cut the chunk short
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
      
      // Stop current recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
      }
      
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
      sourceNodeRef.current = null;
      destinationRef.current = null;
      
      // Wait a moment for final chunk processing
      setTimeout(() => handleMeetingEnd(), 1500);
  }

  const handleExpandToggle = () => {
    if (!isExpanded) {
      window.electronAPI.setWindowSize({ width: 500, height: 700 })
      setIsExpanded(true)
    } else {
      window.electronAPI.setWindowSize({ width: 450, height: 120 })
      setIsExpanded(false)
    }
  }

  const handleMeetingEnd = async () => {
    if (transcriptLogs.length === 0) return;

    setShowPostMeeting(true);
    if(!isExpanded) handleExpandToggle();
    setActiveTab("Email"); 
    
    setIsThinking(true);
    setThinkingStep("Drafting summary...");
    const fullTranscript = transcriptLogs.map(t => t.text).join(" ");
    
    let generatedEmail = "";
    let generatedTitle = `Meeting ${new Date().toLocaleDateString()}`;

    try {
        if (fullTranscript.length > 10) {
            // Parallel execution: Get email and title
            const [emailResponse, titleResponse] = await Promise.all([
                window.electronAPI.invoke("gemini-chat", `Based on this transcript, draft a professional follow-up email:\n\n${fullTranscript}`),
                window.electronAPI.invoke("gemini-chat", `Based on this transcript, generate a very short, concise title (under 6 words) for this meeting:\n\n${fullTranscript}`)
            ]);
            
            generatedEmail = emailResponse;
            // Clean up quotes if present in title
            generatedTitle = titleResponse.replace(/^["']|["']$/g, '');
            setEmailDraft(emailResponse);
        } else {
            setEmailDraft("No significant speech detected.");
        }
    } catch (e) {
        setEmailDraft("Failed to generate content.");
    } finally {
        setIsThinking(false);
    }

    if (transcriptLogs.length > 0) {
        const newMeeting: MeetingSession = {
            id: Date.now().toString(),
            date: Date.now(),
            transcript: transcriptLogs,
            emailDraft: generatedEmail,
            title: generatedTitle // Save smart title
        };
        const updatedHistory = [newMeeting, ...pastMeetings];
        setPastMeetings(updatedHistory);
        localStorage.setItem('moubely_meetings', JSON.stringify(updatedHistory));
    }
  }

  // --- LOGIC: Handle Mode Switching ---
  const handleModeSelect = async (selectedMode: string) => {
      setMode(selectedMode);
      setShowModeMenu(false);

      if (selectedMode === "Student") {
          const exists = await window.electronAPI.checkProfileExists();
          if (!exists) {
              setShowStudentModal(true);
          }
      }
  };

  const handleSaveStudentFiles = async (files: File[]) => {
      if (files.length > 0) {
          // Process files to send to Electron
          const fileDataArray = await Promise.all(files.map(async (file) => {
              const arrayBuffer = await file.arrayBuffer();
              return { name: file.name, data: arrayBuffer };
          }));
          
          await window.electronAPI.saveStudentFiles(fileDataArray);
          setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "Student profile updated. I've analyzed your files.", timestamp: Date.now() }]);
      }
      setShowStudentModal(false);
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText || input
    if (!textToSend.trim() && !pendingScreenshot) return

    const currentScreenshot = pendingScreenshot
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: textToSend || (currentScreenshot ? "Analyze this screen" : ""), screenshotPath: currentScreenshot?.path, timestamp: Date.now() }])
    setInput("")
    setPendingScreenshot(null)
    setIsThinking(true)
    setThinkingStep(isSmartMode ? "Thinking deeply..." : "Thinking...")

    try {
      let response = ""
      // UPDATE: Send history with the request to fix memory
      const history = messages.map(m => ({ role: m.role, text: m.text }));

      const args = {
          message: textToSend,
          mode: mode,
          history: history 
      };
      
      const smartPrefix = isSmartMode ? `[Mode: ${mode}] [Expert Level] ` : `[Mode: ${mode}] `
      let context = "";
      if (isRecording || showPostMeeting) {
          const fullTranscript = transcriptLogs.map(t => t.text).join(" ");
          context = `\nCONTEXT (Meeting Transcript So Far): "${fullTranscript || "No audio detected yet."}"\n\n`;
      }
      
      if (currentScreenshot) {
        setThinkingStep("Vision processing...")
        // For vision, prompt concatenation is handled here
        const formatInstruction = "\nPlease format your response using structured lists and text.";
        const finalPrompt = smartPrefix + context + (textToSend || "Describe this screen") + formatInstruction;
        // Vision might not support history array yet in backend, so we use string concat
        response = await window.electronAPI.chatWithImage(finalPrompt, currentScreenshot.path)
      } else {
        // Standard chat supports history now
        const formatInstruction = "\nPlease format your response using structured lists and text. Avoid markdown tables.";
        const finalPrompt = smartPrefix + context + (textToSend || "Describe this screen") + formatInstruction;
        
        args.message = finalPrompt;
        response = await window.electronAPI.invoke("gemini-chat", args)
      }
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "ai", text: response, timestamp: Date.now() }])
    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "Error: " + error.message, timestamp: Date.now() }])
    } finally { setIsThinking(false) }
  }

  const triggerAssistAction = async (actionType: "Assist" | "WhatToSay" | "FollowUp" | "Recap") => {
    let transcriptText = transcriptLogs.map(t => t.text).join(" ");
    
    // Fallback to chat history if transcript is empty
    if (!transcriptText.trim() && messages.length > 0) {
        transcriptText = messages.slice(-5).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n");
    }

    if (!transcriptText.trim()) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "ai", text: "I haven't heard enough yet, and chat history is empty. Start a meeting or ask a question!", timestamp: Date.now() }]);
        return;
    }

    setActiveTab("Chat")
    setIsThinking(true)
    
    // 1. Determine Prompt and User Display Message
    let userDisplayMessage = "";
    let systemPrompt = "";
    
    switch (actionType) {
      case "Assist": 
          userDisplayMessage = "Assist me based on the current context.";
          systemPrompt = `Based on the conversation context: "${transcriptText}". \nProvide helpful facts, context, or next steps.`; 
          break;
      case "WhatToSay": 
          userDisplayMessage = "What should I say next?";
          systemPrompt = `Based on the conversation context: "${transcriptText}". \nSuggest 3 smart responses.`; 
          break;
      case "FollowUp": 
          userDisplayMessage = "Generate follow-up questions.";
          systemPrompt = `Based on the conversation context: "${transcriptText}". \nGenerate 3 follow-up questions.`; 
          break;
      case "Recap": 
          userDisplayMessage = "Recap the meeting so far.";
          systemPrompt = `Based on the conversation context: "${transcriptText}". \nProvide a concise summary.`; 
          break;
    }
    
    // 2. Add USER message to chat immediately (Visual feedback)
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: userDisplayMessage, timestamp: Date.now() }]);

    // 3. Prepare history (inject the new user intent so AI knows what it's answering)
    const history = messages.map(m => ({ role: m.role, text: m.text }));
    history.push({ role: "user", text: userDisplayMessage });

    const args = {
        message: systemPrompt,
        mode: mode,
        history: history 
    };

    try {
        const response = await window.electronAPI.invoke("gemini-chat", args)
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "ai", text: response, timestamp: Date.now() }])
    } catch (e: any) { console.error(e) } finally { setIsThinking(false) }
  }

  const handleInputFocus = () => { setIsInputFocused(true); if (!isExpanded) handleExpandToggle(); }
  const handleUseScreen = async () => { try { await window.electronAPI.takeScreenshot(); const s = await window.electronAPI.getScreenshots(); if(s.length) { setPendingScreenshot(s[s.length-1]); if(!isExpanded) handleExpandToggle(); setActiveTab("Chat"); } } catch(e){} }
  const handleCopyUserMessage = (text: string) => { navigator.clipboard.writeText(text); }
  const startResize = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: document.body.offsetWidth, startH: document.body.offsetHeight }; document.addEventListener('mousemove', doResize); document.addEventListener('mouseup', stopResize); }
  const doResize = (e: MouseEvent) => { if (!resizeRef.current) return; const diffX = e.clientX - resizeRef.current.startX; const diffY = e.clientY - resizeRef.current.startY; const newWidth = Math.max(150, resizeRef.current.startW + diffX); const newHeight = Math.max(50, resizeRef.current.startH + diffY); window.electronAPI.setWindowSize({ width: newWidth, height: newHeight }); }
  const stopResize = () => { resizeRef.current = null; document.removeEventListener('mousemove', doResize); document.removeEventListener('mouseup', stopResize); }
  const loadMeeting = (m: MeetingSession) => { setTranscriptLogs(m.transcript); setEmailDraft(m.emailDraft); setShowPostMeeting(true); setActiveTab("Transcript"); setMessages([{id: Date.now().toString(), role: "ai", text: `Loaded meeting: ${new Date(m.date).toLocaleString()}`, timestamp: Date.now()}]); }
  const deleteMeeting = (id: string, e: React.MouseEvent) => { e.stopPropagation(); const u = pastMeetings.filter(m => m.id !== id); setPastMeetings(u); localStorage.setItem('moubely_meetings', JSON.stringify(u)); }

  return (
    <div className={`moubely-window ${isExpanded ? 'expanded' : ''} flex flex-col h-full relative`}>
      <StudentModeSetupModal 
        open={showStudentModal} 
        onClose={() => { setShowStudentModal(false); if(mode === "Student") setMode("General"); }} 
        onSave={handleSaveStudentFiles}
      />
      <div className="px-4 pt-3 pb-0 z-50">
        {!isExpanded && (
          <div className="flex justify-center mb-3 animate-in fade-in slide-in-from-top-2">
             <button onClick={handleStartSession} className={`status-pill interactive hover:scale-105 transition-all no-drag ${isRecording ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20'}`}>
                {!isRecording ? <><Play size={12} fill="currentColor" /><span>Start Moubely</span></> : <><span>Session in progress</span><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-1"/></>}
             </button>
          </div>
        )}
        <div className="compact-bar interactive no-drag">
            <div className="flex items-center gap-2">
               {!isRecording ? (
                   <button onClick={handleStartSession} className="icon-btn hover:text-green-400 hover:bg-green-400/10" title="Start Session"><Play size={18} fill="currentColor"/></button>
               ) : (
                   <>
                       <button onClick={handlePauseToggle} className={`icon-btn ${isPaused ? 'text-yellow-400' : 'text-blue-400'}`} title={isPaused ? "Resume" : "Pause"}>{isPaused ? <Play size={18} fill="currentColor"/> : <Pause size={18} fill="currentColor"/>}</button>
                       <button onClick={handleStopSession} className="icon-btn hover:text-red-400 hover:bg-red-400/10" title="Finish Meeting"><Square size={16} fill="currentColor" className="text-red-400"/></button>
                   </>
               )}
               <button onClick={() => { resetChat(); setTranscriptLogs([]); setShowPostMeeting(false); }} className="icon-btn hover:text-red-400" title="Delete Chat / Reset"><Trash2 size={16}/></button>
            </div>
            <div className="flex-1 flex justify-center">
                <div className="draggable cursor-grab active:cursor-grabbing p-2 rounded hover:bg-white/5 group"><GripHorizontal size={20} className="text-gray-600 group-hover:text-gray-400"/></div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={handleExpandToggle} className="icon-btn" title="Toggle Expand">{isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
               <button onClick={() => window.electronAPI.quitApp()} className="icon-btn hover:text-red-400" title="Close"><X size={20}/></button>
            </div>
         </div>
      </div>

      {isExpanded && (
        <div className="flex-1 flex flex-col min-h-0 interactive animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
           <div className="tab-nav justify-start overflow-x-auto no-scrollbar">
              <button onClick={() => setActiveTab("Chat")} className={`tab-btn ${activeTab === 'Chat' ? 'active' : ''}`}>Chat</button>
              <button onClick={() => setActiveTab("Transcript")} className={`tab-btn ${activeTab === 'Transcript' ? 'active' : ''}`}>Transcript</button>
              {showPostMeeting && <button onClick={() => setActiveTab("Email")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'Email' ? 'active' : ''}`}><Mail size={14}/> Email</button>}
              <button onClick={() => setActiveTab("History")} className={`tab-btn flex items-center gap-1.5 ${activeTab === 'History' ? 'active' : ''}`}><History size={14}/> History</button>
              {!showPostMeeting && (
                  <>
                    <div className="w-px h-4 bg-white/10 mx-2 self-center shrink-0"/>
                    <button onClick={() => triggerAssistAction("Assist")} className="tab-btn flex items-center gap-1.5 hover:text-blue-300 whitespace-nowrap"><Sparkles size={14}/> Assist</button>
                    <button onClick={() => triggerAssistAction("WhatToSay")} className="tab-btn flex items-center gap-1.5 hover:text-green-300 whitespace-nowrap"><MessageCircleQuestion size={14}/> What to say?</button>
                    <button onClick={() => triggerAssistAction("FollowUp")} className="tab-btn flex items-center gap-1.5 hover:text-purple-300 whitespace-nowrap"><HelpCircle size={14}/> Follow-up</button>
                    <button onClick={() => triggerAssistAction("Recap")} className="tab-btn flex items-center gap-1.5 hover:text-orange-300 whitespace-nowrap"><FileText size={14}/> Recap</button>
                  </>
              )}
           </div>

           <div className="content-area flex-1 overflow-hidden flex flex-col">
              {activeTab === "Chat" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto chat-scroll-area space-y-5 pb-4 px-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        {msg.role === "user" && (
                            <div className="group relative max-w-[85%]">
                                <div className="user-bubble text-left">{msg.text}</div>
                                <button onClick={() => handleCopyUserMessage(msg.text)} className="absolute top-1/2 -left-8 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white bg-black/40 rounded-full" title="Copy"><Copy size={12}/></button>
                            </div>
                        )}
                        {msg.role === "ai" && <div className="ai-message max-w-[95%]">
                            <MessageContent text={msg.text} />
                        </div>}
                      </div>
                    ))}
                    {isThinking && <div className="flex items-center gap-3 text-sm text-gray-400 pl-1"><Loader2 size={16} className="animate-spin text-blue-400"/><span className="animate-pulse">{thinkingStep}</span></div>}
                    <div ref={chatEndRef}/>
                  </div>
                </div>
              )}

              {activeTab === "Transcript" && (
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                   {/* VISUALIZER HEADER */}
                   <div className="flex flex-col items-center justify-center sticky top-0 bg-[#0f0f14]/80 backdrop-blur-md p-4 mb-2 z-10 rounded-xl border border-white/5 shadow-lg">
                        {isRecording ? (
                            <>
                                <AudioVisualizer audioContext={audioContextRef.current} source={sourceNodeRef.current} />
                                <div className="text-xs text-blue-400 mt-2 font-medium animate-pulse">Listening...</div>
                            </>
                        ) : transcriptError ? (
                            <div className="flex flex-col items-center text-red-400 gap-2 p-2 bg-red-500/10 rounded-lg">
                                <AlertCircle size={20}/>
                                <span className="text-xs font-semibold text-center">{transcriptError}</span>
                            </div>
                        ) : (
                            <div className="text-gray-500 text-xs">Microphone inactive</div>
                        )}
                   </div>

                   {/* TRANSCRIPT LOGS */}
                   {transcriptLogs.length === 0 && !transcriptError && (
                       <div className="text-gray-500 text-center mt-10 text-sm">
                           Speak clearly to see text appear here.
                       </div>
                   )}
                   {transcriptLogs.map((log) => (
                       <div key={log.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                           <div className="text-[11px] text-gray-500 font-mono mb-0.5">{log.displayTime}</div>
                           <div className="text-gray-200 leading-relaxed text-[15px] pl-2 border-l-2 border-blue-500/30">
                               {log.text}
                           </div>
                       </div>
                   ))}
                   <div ref={transcriptEndRef}/>
                </div>
              )}

              {activeTab === "Email" && showPostMeeting && (
                <div className="flex-1 overflow-y-auto p-2">
                    {emailDraft ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 shadow-2xl">
                             <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                                <h3 className="text-white font-medium flex items-center gap-2"><Mail size={16}/> Generated Follow-up</h3>
                                <button onClick={() => navigator.clipboard.writeText(emailDraft)} className="text-xs flex items-center gap-1 hover:text-white text-gray-400"><Copy size={12}/> Copy Draft</button>
                             </div>
                             <MessageContent text={emailDraft} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                            <Loader2 size={24} className="animate-spin text-blue-400"/>
                            <span>Drafting email...</span>
                        </div>
                    )}
                </div>
              )}

              {activeTab === "History" && (
                  <div className="flex-1 overflow-y-auto p-2 space-y-3">
                      {pastMeetings.length === 0 ? (
                          <div className="text-gray-500 text-center mt-10 text-sm">No recorded meetings yet.</div>
                      ) : (
                          pastMeetings.map((meeting) => (
                              <div key={meeting.id} onClick={() => loadMeeting(meeting)} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 cursor-pointer transition-colors group">
                                  <div className="flex justify-between items-start mb-2">
                                      <div className="flex items-center gap-2 text-blue-300 font-medium">
                                          <Calendar size={14}/>
                                          <span>{meeting.title || new Date(meeting.date).toLocaleDateString()}</span>
                                          <span className="text-gray-500">•</span>
                                          <Clock size={14}/>
                                          <span>{new Date(meeting.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <button onClick={(e) => deleteMeeting(meeting.id, e)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14}/></button>
                                  </div>
                                  <div className="text-sm text-gray-400 line-clamp-2 mb-3">
                                      {meeting.transcript.map(t => t.text).join(' ').slice(0, 150)}...
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-blue-400 font-medium group-hover:text-blue-300">
                                      <span>View Details</span>
                                      <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform"/>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              )}
           </div>

           {activeTab === "Chat" && (
             <div className="p-5 bg-gradient-to-t from-black via-black/90 to-transparent">
                {pendingScreenshot && (
                  <div className="mb-3 flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl w-fit">
                    <img src={pendingScreenshot.preview} className="w-10 h-8 rounded object-cover border border-white/10"/>
                    <span className="text-xs text-blue-200 font-medium">Screenshot attached</span>
                    <button onClick={() => setPendingScreenshot(null)}><X size={14}/></button>
                  </div>
                )}
                <div className="relative mb-3">
                   <textarea
                     ref={textareaRef}
                     value={input}
                     onFocus={handleInputFocus}
                     onChange={(e) => setInput(e.target.value)}
                     onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey && !e.altKey) { e.preventDefault(); handleSend(); } }}
                     placeholder={showPostMeeting ? "Ask about the meeting..." : "Ask about your screen..."}
                     rows={1}
                     className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-white/20 rounded-2xl px-5 py-4 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all shadow-lg resize-none overflow-y-auto"
                     style={{ minHeight: '52px', maxHeight: '150px' }}
                   />
                   {(input.length > 0 || pendingScreenshot) && <button onClick={() => handleSend()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors"><Send size={16} className="text-white"/></button>}
                </div>
                {isInputFocused && (
                   <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <button onClick={handleUseScreen} className="control-btn hover:bg-white/15 py-2 px-3"><Monitor size={14} className="text-blue-400"/><span>Use Screen</span></button>
                      <button onClick={() => setIsSmartMode(!isSmartMode)} className={`control-btn py-2 px-3 ${isSmartMode ? 'active' : ''}`}><Zap size={14} className={isSmartMode ? 'fill-current' : ''}/><span>Smart</span></button>
                      
                      {/* MODE SELECTOR */}
                      <div className="relative">
                        <button onClick={() => setShowModeMenu(!showModeMenu)} className="control-btn hover:bg-white/15 py-2 px-3"><span>{mode}</span><ChevronDown size={12}/></button>
                        {showModeMenu && (
                            <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1 z-[60]">
                                {['General', 'Developer', 'Student'].map((m) => (
                                    <button 
                                        key={m} 
                                        onClick={() => handleModeSelect(m)} 
                                        className={`w-full text-left px-4 py-2 text-xs hover:bg-white/10 ${mode === m ? 'text-blue-400 bg-white/5' : 'text-gray-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}
                      </div>

                      {/* NEW: UPDATE PROFILE BUTTON (Only visible in Student Mode) */}
                      {mode === "Student" && (
                          <button 
                            onClick={() => setShowStudentModal(true)}
                            className="control-btn hover:bg-white/15 py-2 px-3 text-blue-300"
                            title="Update Profile / Resume"
                          >
                             <UserCog size={14} />
                             <span>Update Profile</span>
                          </button>
                      )}

                   </div>
                )}
             </div>
           )}
        </div>
      )}

      <div 
        onMouseDown={startResize}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 interactive hover:bg-white/10 rounded-tl-lg z-[60]"
      >
        <Scaling size={14} className="text-gray-500" />
      </div>
    </div>
  )
}

export default Queue