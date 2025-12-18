import { contextBridge, ipcRenderer } from "electron"

interface ScreenshotActionData {
    action: "take-and-send" | "take-and-queue";
}

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (d) => ipcRenderer.invoke("update-content-dimensions", d),
  setWindowSize: (d) => ipcRenderer.invoke("set-window-size", d),

  // NEW: Expansion Toggle Listener
  onToggleExpansion: (cb) => {
    const s = () => cb();
    ipcRenderer.on("toggle-expansion", s);
    return () => ipcRenderer.removeListener("toggle-expansion", s);
  },

  onScreenshotAction: (cb) => {
    const s = (_: any, d: any) => cb(d);
    ipcRenderer.on("screenshot-action-triggered", s);
    return () => ipcRenderer.removeListener("screenshot-action-triggered", s);
  },
  
  takeScreenshot: () => ipcRenderer.invoke("take-screenshot"),
  getScreenshots: () => ipcRenderer.invoke("get-screenshots"),
  deleteScreenshot: (p) => ipcRenderer.invoke("delete-screenshot", p),
  
  onSolutionsReady: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("solutions-ready", s); return () => ipcRenderer.removeListener("solutions-ready", s) },
  onResetView: (cb) => { const s = () => cb(); ipcRenderer.on("reset-view", s); return () => ipcRenderer.removeListener("reset-view", s) },
  
  onTokenReceived: (callback) => {
    const subscription = (_: any, token: string) => callback(token)
    ipcRenderer.on('llm-token', subscription)
    return () => ipcRenderer.removeListener('llm-token', subscription)
  },

  onSolutionStart: (cb) => { const s = () => cb(); ipcRenderer.on("initial-start", s); return () => ipcRenderer.removeListener("initial-start", s) },
  onDebugStart: (cb) => { const s = () => cb(); ipcRenderer.on("debug-start", s); return () => ipcRenderer.removeListener("debug-start", s) },
  onDebugSuccess: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("debug-success", s); return () => ipcRenderer.removeListener("debug-success", s) },
  onDebugError: (cb) => { const s = (_:any, e:any) => cb(e); ipcRenderer.on("debug-error", s); return () => ipcRenderer.removeListener("debug-error", s) },
  onSolutionError: (cb) => { const s = (_:any, e:any) => cb(e); ipcRenderer.on("solution-error", s); return () => ipcRenderer.removeListener("solution-error", s) },
  onProcessingNoScreenshots: (cb) => { const s = () => cb(); ipcRenderer.on("processing-no-screenshots", s); return () => ipcRenderer.removeListener("processing-no-screenshots", s) },
  onProblemExtracted: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("problem-extracted", s); return () => ipcRenderer.removeListener("problem-extracted", s) },
  onSolutionSuccess: (cb) => { const s = (_:any, d:any) => cb(d); ipcRenderer.on("solution-success", s); return () => ipcRenderer.removeListener("solution-success", s) },
  onUnauthorized: (cb) => { const s = () => cb(); ipcRenderer.on("procesing-unauthorized", s); return () => ipcRenderer.removeListener("procesing-unauthorized", s) },

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
  toggleMouseIgnore: (i) => ipcRenderer.send("toggle-mouse-ignore", i),
  
  chatWithImage: (m, i) => ipcRenderer.invoke("chat-with-image", { message: m, imagePaths: i }),
  checkProfileExists: () => ipcRenderer.invoke("check-profile-exists"),
  saveStudentFiles: (f) => ipcRenderer.invoke("save-student-files", f),

  toggleStealthMode: () => ipcRenderer.invoke("toggle-stealth-mode"),
  getStealthMode: () => ipcRenderer.invoke("get-stealth-mode"),
})