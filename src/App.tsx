import { ToastProvider } from "./components/ui/toast"
import Queue from "./_pages/Queue"
import { ToastViewport } from "@radix-ui/react-toast"
import React, { useEffect, useState, useRef, useCallback } from "react"
import Solutions from "./_pages/Solutions"
import { QueryClient, QueryClientProvider } from "react-query"
import Debug from "./_pages/Debug"
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, cacheTime: Infinity } }
})

const App: React.FC = () => {
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue")
  const [isStealth, setIsStealth] = useState(false)
  const [isMouseIgnored, setIsMouseIgnored] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpandedManual, setIsExpandedManual] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // --- AUTO-COLLAPSE LOGIC ---
  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isCollapsed) setIsCollapsed(false);

    timerRef.current = setTimeout(() => {
      setIsCollapsed(true);
      setIsExpandedManual(false); // Reset manual expansion on collapse
    }, 10000); 
  }, [isCollapsed]);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resetInactivityTimer]);

  // --- SHORTCUT & INITIAL SETUP ---
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getStealthMode().then(setIsStealth);

    // Listen for Ctrl+Space toggle from shortcuts.ts
    const cleanupExpansion = window.electronAPI.onToggleExpansion(() => {
      setIsExpandedManual(prev => !prev);
    });

    const cleanupListeners = [
      window.electronAPI.onSolutionStart(() => setView("solutions")),
      window.electronAPI.onResetView(() => {
        queryClient.invalidateQueries();
        setView("queue");
      }),
    ];

    return () => {
      cleanupExpansion();
      cleanupListeners.forEach(cleanup => cleanup());
    };
  }, []);

  // --- DYNAMIC RESIZING LOGIC ---
  useEffect(() => {
    if (!window.electronAPI) return;

    if (isCollapsed) {
      window.electronAPI.setWindowSize({ width: 450, height: 60 });
    } else if (isExpandedManual || view === "solutions" || view === "debug") {
      window.electronAPI.setWindowSize({ width: 450, height: 600 });
    } else {
      window.electronAPI.setWindowSize({ width: 450, height: 120 });
    }
  }, [view, isCollapsed, isExpandedManual]);

  // --- STEALTH HANDLERS ---
  const toggleMouseIgnore = (ignore: boolean) => {
      if (!isStealth) {
          if (isMouseIgnored) {
             window.electronAPI?.toggleMouseIgnore(false);
             setIsMouseIgnored(false);
             appRef.current?.classList.remove('cursor-deep-stealth');
          }
          return;
      }
      if (window.electronAPI && ignore !== isMouseIgnored) {
          window.electronAPI.toggleMouseIgnore(ignore);
          setIsMouseIgnored(ignore);
          appRef.current?.classList.toggle('cursor-deep-stealth', ignore);
      }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      resetInactivityTimer();
      if (!isStealth) return;
      const target = e.target as HTMLElement;
      const isOverInteractive = target.closest('.interactive') || 
                                target.tagName === 'BUTTON' ||
                                target.tagName === 'TEXTAREA' ||
                                target.tagName === 'INPUT';
      toggleMouseIgnore(!isOverInteractive);
  };

  return (
    <div 
      ref={appRef}
      className={`min-h-0 h-screen w-screen flex flex-col transition-all duration-500 ${isCollapsed ? 'app-collapsed' : ''}`}
      onMouseMove={handleMouseMove}
      onClick={resetInactivityTimer}
      onMouseLeave={() => toggleMouseIgnore(false)}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Header view={view} setView={setView} isStealth={isStealth} setIsStealth={setIsStealth} /> 
          <Router>
            <Routes>
              <Route path="/" element={<Navigate replace to="/queue" />} />
              <Route path="/queue" element={<Queue setView={setView} />} />
              <Route path="/solutions" element={<Solutions setView={setView} />} />
              <Route path="/debug" element={<Debug setView={setView} />} />
            </Routes>
          </Router>
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}

export default App