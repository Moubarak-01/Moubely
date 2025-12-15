import { ToastProvider } from "./components/ui/toast"
import Queue from "./_pages/Queue"
import { ToastViewport } from "@radix-ui/react-toast"
import { useEffect, useState } from "react"
import Solutions from "./_pages/Solutions"
import { QueryClient, QueryClientProvider } from "react-query"
import Debug from "./_pages/Debug"

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
      onDebugSuccess: (callback: (data: any) => void) => () => void
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

  // Click-Through Logic
  useEffect(() => {
    // FIX: CRITICAL SAFETY CHECK
    if (!window.electronAPI) return; 

    window.electronAPI.setIgnoreMouseEvents(true, { forward: true })

    const handleMouseMove = (e: MouseEvent) => {
      const element = document.elementFromPoint(e.clientX, e.clientY)
      const isInteractive = element?.closest('button, input, textarea, a, .interactive, .react-syntax-highlighter-line-number')
      
      // FIX: CRITICAL SAFETY CHECK inside mouse event listener
      if (window.electronAPI) {
          if (isInteractive) {
            window.electronAPI.setIgnoreMouseEvents(false)
          } else {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true })
          }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Listeners
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
    <div className="min-h-0 h-screen flex flex-col">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {view === "queue" ? (
            <Queue setView={setView} />
          ) : view === "solutions" ? (
            <Solutions setView={setView} />
          ) : null}
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}

export default App