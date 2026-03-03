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
  const [isStealth, setIsStealth] = useState(false)
  const [isPrivateMode, setIsPrivateMode] = useState(false)
  const [view, setView] = useState<"queue" | "solutions" | "debug" | "settings">("queue")
  const appRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.electronAPI) return;

    // 1. Initial State Sync
    window.electronAPI.getStealthMode().then((enabled: boolean) => {
      setIsStealth(enabled);
      console.log(`[App] 🛡️ Initial Stealth State: ${enabled}`);
    });

    window.electronAPI.getPrivateMode().then((enabled: boolean) => {
      setIsPrivateMode(enabled);
      console.log(`[App] 🕶️ Initial Private State: ${enabled}`);
    });

    // 2. Listen for Global Toggles
    const removeStealthListener = window.electronAPI.onStealthModeToggled((enabled: boolean) => {
      console.log(`[App] 🛡️ Global Toggle -> Stealth: ${enabled}`);
      setIsStealth(enabled);
    });

    const removePrivateListener = window.electronAPI.onPrivateModeToggled((enabled: boolean) => {
      console.log(`[App] 🕶️ Global Toggle -> Private: ${enabled}`);
      setIsPrivateMode(enabled);
    });

    // 3. Core App Listeners
    const cleanupIPC = [
      window.electronAPI.onSolutionStart(() => setView("solutions")),
      window.electronAPI.onResetView(() => {
        queryClient.invalidateQueries();
        setView("queue");
      }),
    ];

    return () => {
      removeStealthListener();
      removePrivateListener();
      cleanupIPC.forEach(fn => fn());
    };
  }, []);

  return (
    <>
      <div
        ref={appRef}
        className="min-h-0 h-screen w-screen flex flex-col transition-all duration-500"
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
                <Route path="/settings" element={<ProfileSettings />} />
              </Routes>
            </Router>
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    </>
  )
};

export default App