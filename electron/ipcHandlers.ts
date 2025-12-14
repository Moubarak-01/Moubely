import { ipcMain, app, BrowserWindow } from "electron"
import type { AppState } from "./main" // <--- FIXED: Added 'type' to prevent circular dependency crash
import fs from "fs"
import path from "path"

type ChatPayload = string | { message: string; mode?: string; history?: any[] };

export function initializeIpcHandlers(appState: AppState): void {
  // Window Resizing
  ipcMain.handle("set-window-size", async (event, { width, height }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) win.setSize(Math.round(width), Math.round(height))
  })

  ipcMain.handle("update-content-dimensions", async (event, { width, height }) => {
      if (width && height) appState.setWindowDimensions(width, height)
  })

  // Screenshot Logic
  ipcMain.handle("delete-screenshot", async (event, path: string) => appState.deleteScreenshot(path))

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) { throw error }
  })

  ipcMain.handle("get-screenshots", async () => {
    try {
      let previews = []
      const queue = appState.getView() === "queue" ? appState.getScreenshotQueue() : appState.getExtraScreenshotQueue()
      previews = await Promise.all(queue.map(async (path) => ({ path, preview: await appState.getImagePreview(path) })))
      return previews
    } catch (error) { throw error }
  })

  // Window Controls
  ipcMain.handle("toggle-window", async () => appState.toggleMainWindow())

  ipcMain.handle("reset-queues", async () => {
      appState.clearQueues()
      return { success: true }
  })

  // --- STEALTH HANDLERS ---
  ipcMain.handle("toggle-stealth-mode", async () => {
    return appState.toggleStealthMode();
  });

  ipcMain.handle("get-stealth-mode", async () => {
    return appState.getIsStealthMode();
  });

  // AI & Processing
  ipcMain.handle("analyze-audio-base64", async (event, data, mimeType) => {
      return await appState.processingHelper.processAudioBase64(data, mimeType)
  })

  ipcMain.handle("analyze-audio-file", async (event, path) => {
      return await appState.processingHelper.processAudioFile(path)
  })

  ipcMain.handle("analyze-image-file", async (event, path) => {
      return await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
  })

  ipcMain.handle("gemini-chat", async (event, payload: ChatPayload) => {
      let prompt = typeof payload === 'string' ? payload : payload.message;
      let mode = typeof payload === 'string' ? "General" : (payload.mode || "General");
      let history = typeof payload === 'string' ? [] : (payload.history || []);
      return await appState.processingHelper.getLLMHelper().chatWithGemini(prompt, history, mode);
  });

  ipcMain.handle("chat-with-image", async (event, { message, imagePath }) => {
      return await appState.processingHelper.getLLMHelper().chatWithImage(message, imagePath)
  })

  // App Lifecycle & Mouse
  ipcMain.handle("quit-app", () => app.quit())

  ipcMain.handle("move-window-left", async () => appState.moveWindowLeft())
  ipcMain.handle("move-window-right", async () => appState.moveWindowRight())
  ipcMain.handle("move-window-up", async () => appState.moveWindowUp())
  ipcMain.handle("move-window-down", async () => appState.moveWindowDown())
  ipcMain.handle("center-and-show-window", async () => appState.centerAndShowWindow())

  ipcMain.handle("set-ignore-mouse-events", (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setIgnoreMouseEvents(ignore, options)
  })

  // LLM Settings
  ipcMain.handle("get-current-llm-config", async () => {
      const llm = appState.processingHelper.getLLMHelper();
      return { provider: llm.getCurrentProvider(), model: llm.getCurrentModel(), isOllama: llm.isUsingOllama() };
  });

  ipcMain.handle("get-available-ollama-models", async () => {
      return await appState.processingHelper.getLLMHelper().getOllamaModels();
  });

  ipcMain.handle("switch-to-ollama", async (_, model, url) => {
      await appState.processingHelper.getLLMHelper().switchToOllama(model, url);
      return { success: true };
  });

  ipcMain.handle("switch-to-gemini", async (_, apiKey) => {
      await appState.processingHelper.getLLMHelper().switchToGemini(apiKey);
      return { success: true };
  });

  ipcMain.handle("test-llm-connection", async () => {
      return await appState.processingHelper.getLLMHelper().testConnection();
  });

  // Student Mode
  ipcMain.handle("check-profile-exists", async () => {
    const saveDir = path.join(app.getPath("userData"), "student_profile");
    try { return fs.existsSync(saveDir) && fs.readdirSync(saveDir).length > 0; } catch { return false; }
  });

  ipcMain.handle("save-student-files", async (event, files: { name: string, data: ArrayBuffer }[]) => {
    const saveDir = path.join(app.getPath("userData"), "student_profile");
    try {
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
      const existing = fs.readdirSync(saveDir);
      existing.forEach(f => fs.unlinkSync(path.join(saveDir, f)));
      for (const f of files) fs.writeFileSync(path.join(saveDir, f.name), Buffer.from(f.data));
      return true;
    } catch { return false; }
  });
}