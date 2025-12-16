import { ipcMain, app, BrowserWindow } from "electron"
import type { AppState } from "./main" 
import fs from "fs"
import path from "path"

type ChatPayload = string | { message: string; mode?: string; history?: any[] };

export function initializeIpcHandlers(appState: AppState): void {
  // --- Window Resizing ---
  ipcMain.handle("set-window-size", async (event, { width, height }) => {
      // console.log(`[IPC] 📏 Resize Window: ${width}x${height}`); // Optional: Uncomment if too noisy
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) win.setSize(Math.round(width), Math.round(height))
  })

  ipcMain.handle("update-content-dimensions", async (event, { width, height }) => {
      if (width && height) appState.setWindowDimensions(width, height)
  })

  // --- Screenshots ---
  ipcMain.handle("delete-screenshot", async (event, path: string) => {
      console.log("[IPC] 🗑️ Delete Screenshot Request");
      return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    console.log("[IPC] 📸 Take Screenshot Request");
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

  // --- Window Controls ---
  ipcMain.handle("toggle-window", async () => {
      console.log("[IPC] 🔄 Toggle Window Visibility");
      return appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
      console.log("[IPC] 🧹 Reset Queues");
      appState.clearQueues()
      return { success: true }
  })

  // --- STEALTH HANDLERS ---
  ipcMain.handle("toggle-stealth-mode", async () => {
    console.log("[IPC] 👁️ Toggle Stealth Mode");
    return appState.toggleStealthMode();
  });

  ipcMain.handle("get-stealth-mode", async () => {
    return appState.getIsStealthMode();
  });
  
  // --- NEW: MOUSE/STEALTH HANDLERS ---
  /**
   * Toggles the main window's ability to receive mouse events.
   * When 'ignore' is true, the window becomes click-through.
   * We use { forward: true } to ensure that events go to the application beneath Moubely.
   */
  ipcMain.on('toggle-mouse-ignore', (event, ignore: boolean) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender); 
    if (mainWindow) {
      // We don't check for isIgnoreMouseEvents() != ignore here because the frontend
      // manages the synchronization via its state (isMouseIgnored) to prevent IPC spam.
      console.log(`[IPC] 🖱️ Setting mouse ignore to: ${ignore}`);
      // NOTE: { forward: true } is critical here. It makes the window click-through, 
      // but still allows us to use it for non-interactive areas.
      mainWindow.setIgnoreMouseEvents(ignore, { forward: true }); 
    }
  });


  // --- Processing ---
  ipcMain.handle("analyze-audio-base64", async (event, data, mimeType) => {
      // Note: This might spam the console during recording, keeping it minimal
      // console.log("[IPC] 🎙️ Audio Chunk Received"); 
      return await appState.processingHelper.processAudioBase64(data, mimeType)
  })

  ipcMain.handle("analyze-audio-file", async (event, path) => {
      console.log(`[IPC] 📁 Analyze Audio File: ${path}`);
      return await appState.processingHelper.getLLMHelper().analyzeAudioFile(path)
  })

  ipcMain.handle("analyze-image-file", async (event, path) => {
      console.log(`[IPC] 🖼️ Analyze Image File: ${path}`);
      return await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
  })

  // --- STREAMING CHAT ---
  ipcMain.handle("gemini-chat", async (event, payload: ChatPayload) => {
      console.log("[IPC] 💬 Received Chat Request");
      
      let prompt = typeof payload === 'string' ? payload : payload.message;
      let mode = typeof payload === 'string' ? "General" : (payload.mode || "General");
      let history = typeof payload === 'string' ? [] : (payload.history || []);

      const onToken = (token: string) => {
          if (!event.sender.isDestroyed()) {
              event.sender.send('llm-token', token);
          }
      };

      return await appState.processingHelper.getLLMHelper().chatWithGemini(prompt, history, mode, "", onToken);
  });

  // --- FIX: STREAMING MULTI-IMAGE CHAT (Expects imagePaths array) ---
  ipcMain.handle("chat-with-image", async (event, { message, imagePaths }: { message: string, imagePaths: string[] }) => {
      console.log(`[IPC] 🖼️ Received Multi-Image Analysis Request for: ${imagePaths.length} images`);
      
      const onToken = (token: string) => {
          if (!event.sender.isDestroyed()) {
              event.sender.send('llm-token', token);
          }
      };
      
      // Pass the array of paths to LLMHelper
      return await appState.processingHelper.getLLMHelper().chatWithImage(message, imagePaths, onToken)
  })

  // --- App Lifecycle ---
  ipcMain.handle("quit-app", () => {
      console.log("[IPC] 🚪 Quitting App");
      app.quit()
  })
  
  ipcMain.handle("move-window-left", async () => appState.moveWindowLeft())
  ipcMain.handle("move-window-right", async () => appState.moveWindowRight())
  ipcMain.handle("move-window-up", async () => appState.moveWindowUp())
  ipcMain.handle("move-window-down", async () => appState.moveWindowDown())
  
  ipcMain.handle("center-and-show-window", async () => appState.centerAndShowWindow())

  // NOTE: Keeping the old set-ignore-mouse-events handler for compatibility,
  // but the new feature will rely on the custom 'toggle-mouse-ignore' event.
  ipcMain.handle("set-ignore-mouse-events", (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.setIgnoreMouseEvents(ignore, options)
  })

  // --- Settings & Student Mode ---
  ipcMain.handle("get-current-llm-config", async () => {
      const llm = appState.processingHelper.getLLMHelper();
      return { provider: llm.getCurrentProvider(), model: llm.getCurrentModel(), isOllama: llm.isUsingOllama() };
  });

  ipcMain.handle("get-available-ollama-models", async () => {
      return await appState.processingHelper.getLLMHelper().getOllamaModels();
  });

  ipcMain.handle("switch-to-ollama", async (_, model, url) => {
      console.log(`[IPC] 🔄 Switch to Ollama: ${model}`);
      await appState.processingHelper.getLLMHelper().switchToOllama(model, url);
      return { success: true };
  });

  ipcMain.handle("switch-to-gemini", async (_, apiKey) => {
      console.log("[IPC] 🔄 Switch to Gemini");
      await appState.processingHelper.getLLMHelper().switchToGemini(apiKey);
      return { success: true };
  });

  ipcMain.handle("test-llm-connection", async () => {
      console.log("[IPC] 📡 Test Connection Request");
      return await appState.processingHelper.getLLMHelper().testConnection();
  });

  ipcMain.handle("check-profile-exists", async () => {
    const saveDir = path.join(app.getPath("userData"), "student_profile");
    try { return fs.existsSync(saveDir) && fs.readdirSync(saveDir).length > 0; } catch { return false; }
  });

  ipcMain.handle("save-student-files", async (event, files: { name: string, data: ArrayBuffer }[]) => {
    console.log(`[IPC] 📂 Save Student Files Request (${files.length} files)`);
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