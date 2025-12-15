import { contextBridge, ipcRenderer } from "electron"

interface ScreenshotActionData {
    action: "take-and-send" | "take-and-queue";
}

interface ElectronAPI {
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>
  setWindowSize: (dimensions: { width: number, height: number }) => Promise<void>
  
  // FIX: Added new screenshot action listener
  onScreenshotAction: (callback: (data: ScreenshotActionData) => void) => () => void

  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  
  // onScreenshotTaken is now obsolete/replaced by onScreenshotAction

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
  
  // --- NEW: Streaming Listener ---
  onTokenReceived: (callback: (token: string) => void) => () => void

  // FIX: Corrected signature for chatWithImage to accept an array of paths
  chatWithImage: (message: string, imagePaths: string[]) => Promise<string>

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
  
  checkProfileExists: () => Promise<boolean>
  saveStudentFiles: (files: { name: string, data: ArrayBuffer }[]) => Promise<boolean>

  // --- NEW: Stealth Mode Handlers ---
  toggleStealthMode: () => Promise<boolean>
  getStealthMode: () => Promise<boolean>
}

export const PROCESSING_EVENTS = {
  UNAUTHORIZED: "procesing-unauthorized",
  NO_SCREENSHOTS: "processing-no-screenshots",
  INITIAL_START: "initial-start",
  PROBLEM_EXTRACTED: "problem-extracted",
  SOLUTION_SUCCESS: "solution-success",
  INITIAL_SOLUTION_ERROR: "solution-error",
  DEBUG_START: "debug-start",
  DEBUG_SUCCESS: "debug-success",
  DEBUG_ERROR: "debug-error"
} as const

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (d) => ipcRenderer.invoke("update-content-dimensions", d),
  setWindowSize: (d) => ipcRenderer.invoke("set-window-size", d),

  // FIX: Added the new action listener (used by shortcuts.ts)
  onScreenshotAction: (cb) => {
    const s = (_: any, d: any) => cb(d);
    ipcRenderer.on("screenshot-action-triggered", s);
    return () => ipcRenderer.removeListener("screenshot-action-triggered", s);
  },
  
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (p) => ipcRenderer.invoke("delete-screenshot", p),

  // onScreenshotTaken removed from implementation as it's replaced by onScreenshotAction
  
  onSolutionsReady: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("solutions-ready", s); return () => ipcRenderer.removeListener("solutions-ready", s) },
  onResetView: (cb) => { const s = () => cb(); ipcRenderer.on("reset-view", s); return () => ipcRenderer.removeListener("reset-view", s) },
  
  // --- Streaming Implementation ---
  onTokenReceived: (callback) => {
    const subscription = (_: any, token: string) => callback(token)
    ipcRenderer.on('llm-token', subscription)
    return () => ipcRenderer.removeListener('llm-token', subscription)
  },

  onSolutionStart: (cb) => { const s = () => cb(); ipcRenderer.on(PROCESSING_EVENTS.INITIAL_START, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_START, s) },
  onDebugStart: (cb) => { const s = () => cb(); ipcRenderer.on(PROCESSING_EVENTS.DEBUG_START, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_START, s) },
  onDebugSuccess: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("debug-success", s); return () => ipcRenderer.removeListener("debug-success", s) },
  onDebugError: (cb) => { const s = (_:any, e:any) => cb(e); ipcRenderer.on(PROCESSING_EVENTS.DEBUG_ERROR, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.DEBUG_ERROR, s) },
  onSolutionError: (cb) => { const s = (_:any, e:any) => cb(e); ipcRenderer.on(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, s) },
  onProcessingNoScreenshots: (cb) => { const s = () => cb(); ipcRenderer.on(PROCESSING_EVENTS.NO_SCREENSHOTS, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.NO_SCREENSHOTS, s) },
  onProblemExtracted: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on(PROCESSING_EVENTS.PROBLEM_EXTRACTED, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.PROBLEM_EXTRACTED, s) },
  onSolutionSuccess: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on(PROCESSING_EVENTS.SOLUTION_SUCCESS, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.SOLUTION_SUCCESS, s) },
  onUnauthorized: (cb) => { const s = () => cb(); ipcRenderer.on(PROCESSING_EVENTS.UNAUTHORIZED, s); return () => ipcRenderer.removeListener(PROCESSING_EVENTS.UNAUTHORIZED, s) },

  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),
  analyzeAudioFromBase64: (d, m) => ipcRenderer.invoke("analyze-audio-base64", d, m),
  analyzeAudioFile: (p) => ipcRenderer.invoke("analyze-audio-file", p),
  analyzeImageFile: (p) => ipcRenderer.invoke("analyze-image-file", p),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  switchToOllama: (m, u) => ipcRenderer.invoke("switch-to-ollama", m, u),
  switchToGemini: (k) => ipcRenderer.invoke("switch-to-gemini", k),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),
  
  invoke: (c, ...a) => ipcRenderer.invoke(c, ...a),
  setIgnoreMouseEvents: (i, o) => ipcRenderer.invoke("set-ignore-mouse-events", i, o),
  
  // FIX: Corrected chatWithImage to accept and pass an array of paths
  chatWithImage: (m, i) => ipcRenderer.invoke("chat-with-image", { message: m, imagePaths: i }),
  checkProfileExists: () => ipcRenderer.invoke("check-profile-exists"),
  saveStudentFiles: (f) => ipcRenderer.invoke("save-student-files", f),

  toggleStealthMode: () => ipcRenderer.invoke("toggle-stealth-mode"),
  getStealthMode: () => ipcRenderer.invoke("get-stealth-mode"),
} as ElectronAPI)