export interface ElectronAPI {
  updateContentDimensions: (dimensions: { width: number; height: number }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  
  // NEW: Streaming Listener
  onTokenReceived: (callback: (token: string) => void) => () => void

  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  
  analyzeAudioFromBase64: (data: string, mimeType: string) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string) => Promise<{ text: string; timestamp: number }>
  quitApp: () => Promise<void>
  invoke: (channel: string, ...args: any[]) => Promise<any>
  
  setWindowSize: (dimensions: { width: number, height: number }) => Promise<void>
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => Promise<void>
  chatWithImage: (message: string, imagePath: string) => Promise<string>
  
  toggleStealthMode: () => Promise<boolean>
  getStealthMode: () => Promise<boolean>
  
  checkProfileExists: () => Promise<boolean>
  saveStudentFiles: (files: { name: string, data: ArrayBuffer }[]) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}