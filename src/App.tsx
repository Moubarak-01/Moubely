import { ToastProvider } from "./components/ui/toast"
import Queue from "./_pages/Queue"
import { ToastViewport } from "@radix-ui/react-toast"
import React, { useEffect, useState, useRef } from "react"
import Solutions from "./_pages/Solutions"
import { QueryClient, QueryClientProvider } from "react-query"
import Debug from "./_pages/Debug"
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import { ProfileSettings } from "./_pages/ProfileSettings";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, cacheTime: Infinity } }
})

const App: React.FC = () => {
  const [debugProcessing, setDebugProcessing] = useState(false);
  const [view, setView] = useState<"queue" | "solutions" | "debug" | "settings">("queue")
  const [isStealth, setIsStealth] = useState(false)
  const [isMouseIgnored, setIsMouseIgnored] = useState(false)
  const appRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.getStealthMode().then(setIsStealth);
    window.electronAPI.setWindowSize({ width: 600, height: 200 });

    const cleanup = [
      window.electronAPI.onSolutionStart(() => setView("solutions")),
      window.electronAPI.onResetView(() => {
        queryClient.invalidateQueries();
        setView("queue");
      }),
    ];
    return () => cleanup.forEach(fn => fn());
  }, []);

  const toggleMouseIgnore = (ignore: boolean) => {
    if (!isStealth) return;
    if (window.electronAPI && ignore !== isMouseIgnored) {
      window.electronAPI.toggleMouseIgnore(ignore);
      setIsMouseIgnored(ignore);
      appRef.current?.classList.toggle('cursor-deep-stealth', ignore);
    }
  };

  return (
    <div
      ref={appRef}
      className="min-h-0 h-screen w-screen flex flex-col transition-all duration-500"
      onMouseMove={(e) => {
        const target = e.target as HTMLElement;
        const interactive = target.closest('.interactive') || target.tagName === 'BUTTON';
        toggleMouseIgnore(!interactive);
      }}
      onMouseLeave={() => toggleMouseIgnore(false)}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <Header />
          <Router>
            <Routes>
              <Route path="/" element={<Navigate replace to="/queue" />} />
              <Route path="/queue" element={<Queue setView={setView} />} />
              <Route path="/solutions" element={<Solutions setView={setView} />} />
              <Route path="/debug" element={<Debug isProcessing={false} setIsProcessing={() => { }} />} />
              <Route path="/debug" element={<Debug isProcessing={debugProcessing} setIsProcessing={setDebugProcessing} />} />
              <Route path="/settings" element={<ProfileSettings />} />
            </Routes>
          </Router>
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}

export default App