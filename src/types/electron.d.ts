export interface ElectronAPI {
  // Window & Layout
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>
  setWindowSize: (dimensions: { width: number, height: number }) => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>
  toggleMouseIgnore: (ignore: boolean) => Promise<void> // <--- WAS MISSING
  quitApp: () => Promise<void>

  // Screenshots
  takeScreenshot: () => Promise<any> // Changed to any or specific Interface to match return
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>

  // Events / Listeners
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void
  onScreenshotAction: (callback: (data: any) => void) => () => void // <--- WAS MISSING
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onTokenReceived: (callback: (token: string) => void) => () => void

  // Debug / Processing Events (ALL WERE MISSING)
  onSolutionStart: (callback: () => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: any) => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onDebugError: (callback: (error: any) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void

  // AI & Processing
  // Note: Updated signatures to match your usage
  analyzeAudioFromBase64: (data: string, mimeType: string, isUrgent?: boolean, timestamp?: number) => Promise<any>
  analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
  invoke: (channel: string, ...args: any[]) => Promise<any>

  // Chat / Vision
  // Note: Updated imagePath to string[] to match usage in Queue.tsx
  chatWithImage: (message: string, imagePaths: string[], type?: string) => Promise<string>

  // Settings & Modes
  toggleStealthMode: () => Promise<boolean>
  getStealthMode: () => Promise<boolean>
  checkProfileExists: () => Promise<boolean>
  saveStudentFiles: (files: { name: string, data: ArrayBuffer }[]) => Promise<boolean>
  saveUserProfile: (profileData: any) => Promise<{ success: boolean }>;
  getUserProfile: () => Promise<any>;

  // LLM Configuration (ALL WERE MISSING)
  getCurrentLlmConfig: () => Promise<any>
  getAvailableOllamaModels: () => Promise<string[]>
  switchToOllama: (model: string, url: string) => Promise<any>
  switchToGemini: (key?: string) => Promise<any>
  testLlmConnection: () => Promise<any>

  // Live Mode
  startLiveMode: () => Promise<void>
  stopLiveMode: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}