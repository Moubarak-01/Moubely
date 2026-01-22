import { contextBridge, ipcRenderer } from "electron"

interface ScreenshotActionData {
  action: "take-and-send" | "take-and-queue";
}

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (d: any) => ipcRenderer.invoke("update-content-dimensions", d),
  setWindowSize: (d: any) => ipcRenderer.invoke("set-window-size", d),

  // Expansion Toggle Listener
  onToggleExpansion: (cb: any) => {
    const s = () => cb();
    ipcRenderer.on("toggle-expansion", s);
    return () => ipcRenderer.removeListener("toggle-expansion", s);
  },

  onScreenshotAction: (cb: any) => {
    const s = (_: any, d: any) => cb(d);
    ipcRenderer.on("screenshot-action-triggered", s);
    return () => ipcRenderer.removeListener("screenshot-action-triggered", s);
  },

  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  saveUserProfile: (p: any) => ipcRenderer.invoke("save-user-profile", p),
  getUserProfile: () => ipcRenderer.invoke("get-user-profile"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (p: string) => ipcRenderer.invoke("delete-screenshot", p),

  onSolutionsReady: (cb: any) => { const s = (_: any, d: any) => cb(d); ipcRenderer.on("solutions-ready", s); return () => ipcRenderer.removeListener("solutions-ready", s) },
  onResetView: (cb: any) => { const s = () => cb(); ipcRenderer.on("reset-view", s); return () => ipcRenderer.removeListener("reset-view", s) },

  onTokenReceived: (callback: any) => {
    const subscription = (_: any, token: string) => callback(token)
    ipcRenderer.on('llm-token', subscription)
    return () => ipcRenderer.removeListener('llm-token', subscription)
  },

  onSolutionStart: (cb: any) => { const s = () => cb(); ipcRenderer.on("initial-start", s); return () => ipcRenderer.removeListener("initial-start", s) },
  onDebugStart: (cb: any) => { const s = () => cb(); ipcRenderer.on("debug-start", s); return () => ipcRenderer.removeListener("debug-start", s) },
  onDebugSuccess: (cb: any) => { const s = (_: any, d: any) => cb(d); ipcRenderer.on("debug-success", s); return () => ipcRenderer.removeListener("debug-success", s) },
  onDebugError: (cb: any) => { const s = (_: any, e: any) => cb(e); ipcRenderer.on("debug-error", s); return () => ipcRenderer.removeListener("debug-error", s) },
  onSolutionError: (cb: any) => { const s = (_: any, e: any) => cb(e); ipcRenderer.on("solution-error", s); return () => ipcRenderer.removeListener("solution-error", s) },
  onProcessingNoScreenshots: (cb: any) => { const s = () => cb(); ipcRenderer.on("processing-no-screenshots", s); return () => ipcRenderer.removeListener("processing-no-screenshots", s) },
  onProblemExtracted: (cb: any) => { const s = (_: any, d: any) => cb(d); ipcRenderer.on("problem-extracted", s); return () => ipcRenderer.removeListener("problem-extracted", s) },
  onSolutionSuccess: (cb: any) => { const s = (_: any, d: any) => cb(d); ipcRenderer.on("solution-success", s); return () => ipcRenderer.removeListener("solution-success", s) },
  onUnauthorized: (cb: any) => { const s = () => cb(); ipcRenderer.on("procesing-unauthorized", s); return () => ipcRenderer.removeListener("procesing-unauthorized", s) },

  moveWindowLeft: () => ipcRenderer.invoke("move-window-left"),
  moveWindowRight: () => ipcRenderer.invoke("move-window-right"),
  moveWindowUp: () => ipcRenderer.invoke("move-window-up"),
  moveWindowDown: () => ipcRenderer.invoke("move-window-down"),

  // UPDATED: Now accepts 'u' (isUrgent) as the 3rd argument
  analyzeAudioFromBase64: (d: string, m: string, u: boolean) => ipcRenderer.invoke("analyze-audio-base64", d, m, u),

  analyzeAudioFile: (p: string) => ipcRenderer.invoke("analyze-audio-file", p),
  analyzeImageFile: (p: string) => ipcRenderer.invoke("analyze-image-file", p),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  switchToOllama: (m: string, u: string) => ipcRenderer.invoke("switch-to-ollama", m, u),
  switchToGemini: (k: string) => ipcRenderer.invoke("switch-to-gemini", k),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),

  invoke: (c: string, ...a: any[]) => ipcRenderer.invoke(c, ...a),
  setIgnoreMouseEvents: (i: boolean, o: any) => ipcRenderer.invoke("set-ignore-mouse-events", i, o),
  toggleMouseIgnore: (i: boolean) => ipcRenderer.send("toggle-mouse-ignore", i),

  chatWithImage: (m: string, i: string[]) => ipcRenderer.invoke("chat-with-image", { message: m, imagePaths: i }),
  checkProfileExists: () => ipcRenderer.invoke("check-profile-exists"),
  saveStudentFiles: (f: any[]) => ipcRenderer.invoke("save-student-files", f),

  toggleStealthMode: () => ipcRenderer.invoke("toggle-stealth-mode"),
  getStealthMode: () => ipcRenderer.invoke("get-stealth-mode"),
})