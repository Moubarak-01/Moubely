import React, { useState, useEffect, useRef } from 'react';
import { 
    Brain, 
    User, 
    Lock, 
    Mail, 
    Check, 
    ChevronRight, 
    ArrowRight, 
    Sparkles, 
    ShieldCheck, 
    Terminal,
    Globe,
    Zap,
    Cpu,
    Github,
    Scaling,
    Eye,
    EyeOff
} from 'lucide-react';

interface ApiKeys {
    gemini: string;
    openrouter: string;
    ocrspace: string;
    groq: string;
    perplexity: string;
    github: string;
    nvidia: string;
}

export const Onboarding: React.FC = () => {
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    
    const [apiKeys, setApiKeys] = useState<ApiKeys>({
        gemini: "",
        openrouter: "",
        ocrspace: "",
        groq: "",
        perplexity: "",
        github: "",
        nvidia: ""
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- VISIBILITY TOGGLES ---
    const [showName, setShowName] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

    const toggleKeyVisibility = (key: string) => {
        const next = new Set(visibleKeys);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setVisibleKeys(next);
    };

    // --- RESIZE LOGIC ---
    const resizeRef = useRef<{ startX: number, startY: number, startW: number, startH: number } | null>(null);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startW: document.body.offsetWidth,
            startH: document.body.offsetHeight
        };
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    };

    const doResize = (e: MouseEvent) => {
        if (!resizeRef.current || !window.electronAPI) return;
        const diffX = e.clientX - resizeRef.current.startX;
        const diffY = e.clientY - resizeRef.current.startY;
        const newWidth = Math.max(600, resizeRef.current.startW + diffX);
        const newHeight = Math.max(400, resizeRef.current.startH + diffY);
        window.electronAPI.setWindowSize({ width: newWidth, height: newHeight });
    };

    const stopResize = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    };

    // --- INITIAL EXPAND ---
    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.toggleExpand(true);
        }
    }, []);

    const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setApiKeys(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNext = () => {
        if (step === 1 && !name.trim()) {
            setError("Please enter your name to continue.");
            return;
        }
        if (step === 2 && !apiKeys.gemini.trim()) {
            setError("Gemini API Key is required to activate Moubely's core brain.");
            return;
        }
        setError(null);
        setStep(prev => prev + 1);
    };

    const handleFinalize = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const profileResponse = await window.electronAPI.saveUserProfile({
                targetPersona: "Smart Personal Assistant",
                communicationStyle: "Analogy-Heavy",
                technicalDepth: "Intermediate",
                keyExperiences: `Primary identity: ${name}`,
                storyMappings: []
            });

            if (!profileResponse.success) throw new Error("Failed to save profile");

            const keysResponse = await window.electronAPI.saveApiKeys(apiKeys);
            if (!keysResponse.success) throw new Error("Failed to secure API keys");

            setTimeout(() => {
                window.location.hash = "#/queue";
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred during setup.");
            setIsSaving(false);
        }
    };

    return (
        <div className="moubely-window expanded flex flex-col h-full relative overflow-hidden font-sans select-none">
            {/* BACKGROUND NEBULA EFFECTS */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-600/5 blur-[120px] rounded-full delay-1000 animate-pulse pointer-events-none" />

            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-xl">
                    {/* GLASS CARD */}
                    <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 sm:p-12 shadow-2xl relative overflow-hidden transition-all duration-500 animate-in fade-in zoom-in-95">
                    
                    {/* PROGRESS DOTS */}
                    <div className="flex gap-2 mb-10">
                        {[1, 2, 3].map(i => (
                            <div 
                                key={i} 
                                className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'w-3 bg-white/10'}`} 
                            />
                        ))}
                    </div>

                    {/* CONTENT STEPS */}
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="mb-8">
                                <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Welcome to Moubely</h1>
                                <p className="text-gray-400 leading-relaxed">Let's set up your local workspace. Your data stays on this device.</p>
                            </div>
                            
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[2px]">Your Name</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                                        <input 
                                            autoFocus
                                            type={showName ? "text" : "password"}
                                            value={name} 
                                            onChange={e => setName(e.target.value)}
                                            placeholder="What should I call you?"
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-12 text-white outline-none focus:border-blue-500/50 transition-all text-lg placeholder:text-gray-600 shadow-inner"
                                        />
                                        <button 
                                            onClick={() => setShowName(!showName)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                                        >
                                            {showName ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[2px]">Email (Optional)</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
                                            <input 
                                                value={email} 
                                                onChange={e => setEmail(e.target.value)}
                                                placeholder="Local ID..."
                                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-white/60 outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-[2px]">Password (Optional)</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-400 transition-colors" size={16} />
                                            <input 
                                                type={showPassword ? "text" : "password"}
                                                value={password} 
                                                onChange={e => setPassword(e.target.value)}
                                                placeholder="Secret..."
                                                className="w-full bg-white/5 border border-white/5 rounded-xl py-3 pl-11 pr-10 text-white/60 outline-none text-sm focus:border-blue-500/30 transition-all"
                                            />
                                            <button 
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                                            >
                                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="mb-8">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mb-6">
                                    <Brain className="text-blue-400" size={24} />
                                </div>
                                <h1 className="text-3xl font-bold text-white mb-3">Initialize Core Brain</h1>
                                <p className="text-gray-400 leading-relaxed">A Gemini API Key is required to power Moubely's intelligence.</p>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline mt-2 inline-block">Get a free key from Google AI Studio →</a>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-[2px]">Gemini API Key</label>
                                    <div className="relative group">
                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={18} />
                                        <input 
                                            autoFocus
                                            type={showGeminiKey ? "text" : "password"}
                                            name="gemini"
                                            value={apiKeys.gemini} 
                                            onChange={handleKeyChange}
                                            placeholder="Paste your API key here..."
                                            className="w-full bg-white/5 border border-blue-500/20 rounded-2xl py-4 pl-12 pr-12 text-blue-100 outline-none focus:border-blue-500/50 transition-all font-mono text-sm placeholder:text-gray-700"
                                        />
                                        <button 
                                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500/30 hover:text-blue-500/60 transition-colors"
                                        >
                                            {showGeminiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold text-white mb-3 flex items-center gap-3">
                                    <Sparkles className="text-yellow-400" size={24} /> 
                                    Optional Powers
                                </h1>
                                <p className="text-gray-400 leading-relaxed text-sm">Add these later in settings if you prefer. These enable specialized models and features.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                                {[
                                    { name: "openrouter", label: "OpenRouter", icon: <Globe size={14} className="text-orange-400" /> },
                                    { name: "ocrspace", label: "OCR Space", icon: <Zap size={14} className="text-emerald-400" /> },
                                    { name: "groq", label: "Groq", icon: <Cpu size={14} className="text-purple-400" /> },
                                    { name: "perplexity", label: "Perplexity", icon: <Terminal size={14} className="text-cyan-400" /> },
                                    { name: "nvidia", label: "NVIDIA", icon: <Cpu size={14} className="text-green-400" /> },
                                    { name: "github", label: "GitHub", icon: <Github size={14} className="text-gray-300" /> }
                                ].map(key => (
                                    <div key={key.name} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center justify-between gap-2 pr-1">
                                            <div className="flex items-center gap-2">
                                                {key.icon}
                                                <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{key.label}</span>
                                            </div>
                                            <button 
                                                onClick={() => toggleKeyVisibility(key.name)}
                                                className="text-white/20 hover:text-white/60 transition-colors"
                                            >
                                                {visibleKeys.has(key.name) ? <EyeOff size={10} /> : <Eye size={10} />}
                                            </button>
                                        </div>
                                        <input 
                                            type={visibleKeys.has(key.name) ? "text" : "password"}
                                            name={key.name}
                                            value={(apiKeys as any)[key.name]} 
                                            onChange={handleKeyChange}
                                            placeholder="..."
                                            className="bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-white/10 w-full"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ERROR MESSAGE */}
                    {error && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    {/* FOOTER ACTIONS */}
                    <div className="mt-12 flex justify-between items-center relative z-10">
                        {step > 1 && (
                            <button 
                                onClick={() => { setError(null); setStep(prev => prev - 1); }}
                                className="text-white/40 hover:text-white transition-colors text-sm font-medium"
                            >
                                Back
                            </button>
                        )}
                        <div className="flex-1" />
                        
                        {step < 3 ? (
                            <button 
                                onClick={handleNext}
                                className="group bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-8 py-4 font-bold flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-900/30"
                            >
                                Continue
                                <ChevronRight className="group-hover:translate-x-1 transition-transform" size={20} />
                            </button>
                        ) : (
                            <button 
                                onClick={handleFinalize}
                                disabled={isSaving}
                                className={`group bg-green-600 hover:bg-green-500 text-white rounded-2xl px-10 py-4 font-bold flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-green-900/30 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? (
                                    <>Activating Brain...</>
                                ) : (
                                    <>
                                        Get Started
                                        <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* SECURITY BADGE */}
                <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-white/20 uppercase tracking-[3px] font-bold pb-4">
                    <Lock size={12} />
                    Hardware Encrypted Storage
                </div>
                </div>
            </div>

            {/* RESIZE HANDLE */}
            <div
                onMouseDown={startResize}
                className="absolute bottom-1 right-1 w-8 h-8 cursor-se-resize flex items-center justify-center interactive hover:bg-white/10 rounded-lg transition-all z-[100] group shadow-lg"
                title="Resize Workspace"
            >
                <Scaling size={14} className="text-white/20 group-hover:text-blue-400 rotate-90 transition-colors" />
            </div>
        </div>
    );
};
