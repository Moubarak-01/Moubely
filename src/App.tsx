import { ToastProvider } from "./components/ui/toast"
import Queue from "./_pages/Queue"
import { ToastViewport } from "@radix-ui/react-toast"
import React, { useEffect, useState, useRef } from "react"
import Solutions from "./_pages/Solutions"
import { QueryClient, QueryClientProvider } from "react-query"
import Debug from "./_pages/Debug"
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'

// Note: The global type definitions are included for context but should be in a .d.ts file.
declare global {
  interface Window {
    electronAPI: {
      updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>
      setWindowSize: (dimensions: { width: number; height: number }) => Promise<void>
      getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
      deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
      
      // Note: onScreenshotTaken is generally replaced by onScreenshotAction for multi-shot flow
      onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void 
      onScreenshotAction: (callback: (data: { action: "take-and-send" | "take-and-queue" }) => void) => () => void
      
      onSolutionsReady: (callback: (solutions: string) => void) => () => void
      onResetView: (callback: () => void) => () => void
      onSolutionStart: (callback: () => void) => () => void
      onDebugStart: (callback: () => void) => () => void
      onDebugSuccess: (callback: (data: any) => void) => void
      onSolutionError: (callback: (error: string) => void) => () => void
      onProcessingNoScreenshots: (callback: () => void) => () => void
      onProblemExtracted: (callback: (data: any) => void) => () => void
      onSolutionSuccess: (callback: (data: any) => void) => () => void
      onUnauthorized: (callback: () => void) => () => void
      onDebugError: (callback: (error: string) => void) => () => void
      takeScreenshot: () => Promise<void>
      moveWindowLeft: () => Promise<void>
      moveWindowRight: () => Promise<void>
      moveWindowUp: () => Promise<void>
      moveWindowDown: () => Promise<void>
      analyzeAudioFromBase64: (data: string, mimeType: string) => Promise<{ text: string; timestamp: number }>
      analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
      analyzeImageFile: (path: string) => Promise<void>
      quitApp: () => Promise<void>
      getCurrentLlmConfig: () => Promise<{ provider: "ollama" | "gemini"; model: string; isOllama: boolean }>
      getAvailableOllamaModels: () => Promise<string[]>
      switchToOllama: (model?: string, url?: string) => Promise<{ success: boolean; error?: string }>
      switchToGemini: (apiKey?: string) => Promise<{ success: boolean; error?: string }>
      testLlmConnection: () => Promise<{ success: boolean; error?: string }>
      invoke: (channel: string, ...args: any[]) => Promise<any>
      // FIX: New IPC channel for the mouse event handling
      toggleMouseIgnore: (ignore: boolean) => Promise<void>
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>
      chatWithImage: (message: string, imagePath: string[]) => Promise<string> // NOTE: Array path fix
      checkProfileExists: () => Promise<boolean>
      saveStudentFiles: (files: { name: string, data: ArrayBuffer }[]) => Promise<boolean>
      toggleStealthMode: () => Promise<boolean>
      getStealthMode: () => Promise<boolean>
      onTokenReceived: (callback: (token: string) => void) => () => void
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      cacheTime: Infinity
    }
  }
})

const App: React.FC = () => {
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue")
  
  // NEW STATE: Tracks current stealth mode state
  const [isStealth, setIsStealth] = useState(false)
  
  // NEW STATE: Tracks if the window is currently set to ignore mouse events (synced with Electron)
  const [isMouseIgnored, setIsMouseIgnored] = useState(false);
  
  // Ref to the main container for applying the cursor-hiding class
  const appRef = useRef<HTMLDivElement>(null);


  // --- INITIAL SETUP (Stealth mode and size) ---
  useEffect(() => {
    if (window.electronAPI) {
      // 1. Get initial stealth mode state
      window.electronAPI.getStealthMode().then(setIsStealth)

      // 2. Initial window size setting
      const initialSize = { width: 450, height: 120 };
      window.electronAPI.setWindowSize(initialSize);
    }
  }, [])
  
  // --- NEW: IPC Call to Toggle Mouse Ignore ---
  const toggleMouseIgnore = (ignore: boolean) => {
      // Only apply this logic if Stealth Mode is currently active
      if (!isStealth) {
          // If stealth is off, ensure we resume interaction just in case
          if (isMouseIgnored) {
             window.electronAPI && window.electronAPI.toggleMouseIgnore(false);
             setIsMouseIgnored(false);
             appRef.current && appRef.current.classList.remove('cursor-deep-stealth');
          }
          return;
      }
      
      if (window.electronAPI) {
          if (ignore !== isMouseIgnored) {
              // Use the new simplified IPC channel
              window.electronAPI.toggleMouseIgnore(ignore);
              setIsMouseIgnored(ignore);
              
              // Toggle the CSS class to hide/show the local cursor icon
              if (appRef.current) {
                appRef.current.classList.toggle('cursor-deep-stealth', ignore);
              }
          }
      }
  };

  // --- NEW: Handler to manage cursor state ---
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isStealth) return; // Only execute the deep stealth logic if stealth is on
      
      const target = e.target as HTMLElement;
      
      // CRITICAL LOGIC: Check if the cursor is over an element that should be interactive.
      // We look for the 'interactive' class or any input/button tag.
      const isOverInteractive = target.closest('.interactive') || 
                                target.tagName === 'BUTTON' ||
                                target.tagName === 'TEXTAREA' ||
                                target.tagName === 'INPUT';

      if (isOverInteractive) {
          // Mouse is over a clickable element: RESUME MOUSE EVENTS and SHOW CURSOR
          toggleMouseIgnore(false);
      } else {
          // Mouse is over the background/non-clickable glass: IGNORE MOUSE EVENTS and HIDE CURSOR
          toggleMouseIgnore(true);
      }
  };

  const handleMouseLeave = () => {
    // When the mouse leaves the window, reset state to interactive for safety
    toggleMouseIgnore(false);
    if (appRef.current) {
        appRef.current.classList.remove('cursor-deep-stealth');
    }
  };
  
  // Watch for changes in isStealth state (e.g., if user clicks the Eye icon)
  useEffect(() => {
      if (!isStealth) {
          // Force interaction mode if stealth is turned off
          toggleMouseIgnore(false);
      }
  }, [isStealth]);
  
  // Listeners (Keeping the original listeners)
  useEffect(() => {
    // FIX: CRITICAL SAFETY CHECK
    if (!window.electronAPI) return; 

    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => setView("solutions")),
      window.electronAPI.onResetView(() => {
        queryClient.invalidateQueries()
        setView("queue")
      }),
    ]
    return () => cleanupFunctions.forEach((cleanup) => cleanup())
  }, [])

  return (
    <div 
      ref={appRef}
      className={`min-h-0 h-screen w-screen flex flex-col transition-all duration-300`}
      // Attach the mouse handlers to the main app container
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {/* Header must be outside the Router if it uses Router context, but here it is fine */}
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