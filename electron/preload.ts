import { contextBridge, ipcRenderer } from "electron"

interface ScreenshotActionData {
  action: "take-and-send" | "take-and-queue";
}

contextBridge.exposeInMainWorld("electronAPI", {
  updateContentDimensions: (d: any) => ipcRenderer.invoke("update-content-dimensions", d),
  setWindowSize: (d: any) => ipcRenderer.invoke("set-window-size", d),
  toggleExpand: (isExpanded: boolean) => ipcRenderer.invoke("toggle-expand", isExpanded),

  // Expansion Toggle Listener
  onToggleExpansion: (cb: any) => {
    const s = () => cb();
    ipcRenderer.on("toggle-expansion", s);
    return () => ipcRenderer.removeListener("toggle-expansion", s);
  },

  onStealthModeToggled: (cb: (enabled: boolean) => void) => {
    const s = (_: any, e: boolean) => cb(e);
    ipcRenderer.on("stealth-mode-toggled", s);
    return () => ipcRenderer.removeListener("stealth-mode-toggled", s);
  },

  onPrivateModeToggled: (cb: (enabled: boolean) => void) => {
    const s = (_: any, e: boolean) => cb(e);
    ipcRenderer.on("private-mode-toggled", s);
    return () => ipcRenderer.removeListener("private-mode-toggled", s);
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
  saveChatFile: (ab: ArrayBuffer, ext: string, name?: string) => ipcRenderer.invoke("save-chat-file", ab, ext, name),
  deleteChatFiles: (urls: string[]) => ipcRenderer.invoke("delete-chat-files", urls),
  openFilePicker: () => ipcRenderer.invoke("open-file-picker"),
  saveApiKeys: (keys: any) => ipcRenderer.invoke("save-api-keys", keys),
  getApiKeys: () => ipcRenderer.invoke("get-api-keys"),

  transcribeDictation: (base64Audio: string, mimeType: string) => ipcRenderer.invoke("transcribe-dictation", base64Audio, mimeType),
  cancelChat: () => ipcRenderer.invoke("cancel-gemini-chat"),
  generateMedia: (request: any) => ipcRenderer.invoke("generate-media", request),

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

  // UPDATED: Now accepts 'u' (isUrgent) as the 3rd argument, and 't' (timestamp) as 4th
  analyzeAudioFromBase64: (d: string, m: string, u: boolean, t?: number) => ipcRenderer.invoke("analyze-audio-base64", d, m, u, t),

  analyzeAudioFile: (p: string) => ipcRenderer.invoke("analyze-audio-file", p),
  analyzeImageFile: (p: string) => ipcRenderer.invoke("analyze-image-file", p),
  quitApp: () => ipcRenderer.invoke("quit-app"),

  getAiModels: () => ipcRenderer.invoke("get-ai-models"),
  getCurrentLlmConfig: () => ipcRenderer.invoke("get-current-llm-config"),
  checkLLMConfig: () => ipcRenderer.invoke("check-llm-config"),
  getAvailableOllamaModels: () => ipcRenderer.invoke("get-available-ollama-models"),
  switchToOllama: (m: string, u: string) => ipcRenderer.invoke("switch-to-ollama", m, u),
  switchToGemini: (k: string) => ipcRenderer.invoke("switch-to-gemini", k),
  testLlmConnection: () => ipcRenderer.invoke("test-llm-connection"),

  invoke: (c: string, ...a: any[]) => ipcRenderer.invoke(c, ...a),
  setIgnoreMouseEvents: (i: boolean, o: any) => ipcRenderer.invoke("set-ignore-mouse-events", i, o),
  toggleMouseIgnore: (i: boolean) => ipcRenderer.send("toggle-mouse-ignore", i),

  chatWithAttachments: (m: string, a: { path: string, type: string }[], t?: string, overrideModel?: string) => ipcRenderer.invoke("chat-with-attachments", { message: m, attachments: a, type: t, overrideModel }),
  checkProfileExists: () => ipcRenderer.invoke("check-profile-exists"),
  saveStudentFiles: (f: any[]) => ipcRenderer.invoke("save-student-files", f),

  toggleStealthMode: () => ipcRenderer.invoke("toggle-stealth-mode"),
  getStealthMode: () => ipcRenderer.invoke("get-stealth-mode"),
  togglePrivateMode: () => ipcRenderer.invoke("toggle-private-mode"),
  getPrivateMode: () => ipcRenderer.invoke("get-private-mode"),
  getBackgroundCursor: () => ipcRenderer.invoke("get-background-cursor"),

  downloadMedia: (url: string, filename: string) => ipcRenderer.invoke("download-media", { url, filename }),
  resetSavePath: () => ipcRenderer.invoke("reset-save-path"),
})