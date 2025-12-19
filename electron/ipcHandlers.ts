import { ipcMain, app, BrowserWindow } from "electron"
import type { AppState } from "./main" 
import fs from "fs"
import path from "path"

type ChatPayload = string | { message: string; mode?: string; history?: any[] };

export function initializeIpcHandlers(appState: AppState): void {
  // --- 1. WINDOW RESIZING (Unlocked) ---
  ipcMain.handle("set-window-size", async (event, { width, height }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win) {
        // UNLOCKED: Respect the frontend's requested size
        const [x, y] = win.getPosition(); 
        win.setSize(Math.round(width), Math.round(height));
      }
  })

  ipcMain.handle("update-content-dimensions", async (event, { width, height }) => {
      if (width && height) appState.setWindowDimensions(width, height)
  })

  // --- 2. STEALTH & LIVE MODE ---
  ipcMain.handle("toggle-stealth-mode", async () => {
    console.log("[IPC] 👁️ Toggle Stealth Mode");
    return appState.toggleStealthMode();
  });

  ipcMain.handle("get-stealth-mode", async () => {
    return appState.getIsStealthMode();
  });
  
  ipcMain.on('toggle-mouse-ignore', (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender); 
    if (win) {
      // Only log if changing state to avoid spam on mouse move
      // console.log(`[IPC] 🖱️ Mouse Ignore: ${ignore}`);
      win.setIgnoreMouseEvents(ignore, { forward: true }); 
    }
  });

  ipcMain.handle("start-live-mode", async () => {
    console.log("[IPC] 🔴 Start Live Mode Request");
    return appState.startLiveMode();
  });

  ipcMain.handle("stop-live-mode", async () => {
    console.log("[IPC] ⚪ Stop Live Mode Request");
    return appState.stopLiveMode();
  });

  // --- 3. CHAT & VISION (With GitHub Token Support) ---
  ipcMain.handle("gemini-chat", async (event, payload: ChatPayload) => {
      console.log("[IPC] 💬 Chat Request Received");
      let prompt = typeof payload === 'string' ? payload : payload.message;
      let history = typeof payload === 'string' ? [] : (payload.history || []);
      let mode = typeof payload === 'string' ? "General" : (payload.mode || "General");

      const onToken = (token: string) => {
          if (!event.sender.isDestroyed()) event.sender.send('llm-token', token);
      };
      return await appState.processingHelper.getLLMHelper().chatWithGemini(prompt, history, mode, "", onToken);
  });

  ipcMain.handle("chat-with-image", async (event, { message, imagePaths }: { message: string, imagePaths: string[] }) => {
      console.log(`[IPC] 🖼️ Received Multi-Image Analysis Request for: ${imagePaths.length} images`);
      const onToken = (token: string) => {
          if (!event.sender.isDestroyed()) event.sender.send('llm-token', token);
      };
      return await appState.processingHelper.getLLMHelper().chatWithImage(message, imagePaths, onToken)
  })

  // --- 4. PROCESSING BRIDGES ---
  ipcMain.handle("analyze-audio-base64", async (event, data, mimeType) => {
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

  // --- 5. UTILITIES (Screenshots, Lifecycle) ---
  ipcMain.handle("take-screenshot", async () => {
    console.log("[IPC] 📸 Take Screenshot");
    const screenshotPath = await appState.takeScreenshot()
    const preview = await appState.getImagePreview(screenshotPath)
    return { path: screenshotPath, preview }
  })
  
  ipcMain.handle("delete-screenshot", async (_, path: string) => {
    console.log("[IPC] 🗑️ Delete Screenshot");
    return appState.deleteScreenshot(path)
  })
  
  ipcMain.handle("get-screenshots", async () => {
    const queue = appState.getView() === "queue" ? appState.getScreenshotQueue() : appState.getExtraScreenshotQueue()
    return await Promise.all(queue.map(async (path) => ({ path, preview: await appState.getImagePreview(path) })))
  })

  // Movement & Window Controls
  ipcMain.handle("move-window-left", async () => appState.moveWindowLeft())
  ipcMain.handle("move-window-right", async () => appState.moveWindowRight())
  ipcMain.handle("move-window-up", async () => appState.moveWindowUp())
  ipcMain.handle("move-window-down", async () => appState.moveWindowDown())
  ipcMain.handle("center-and-show-window", async () => appState.centerAndShowWindow())
  ipcMain.handle("toggle-window", async () => appState.toggleMainWindow())
  ipcMain.handle("reset-queues", async () => { appState.clearQueues(); return { success: true }; })
  ipcMain.handle("quit-app", () => app.quit())

  // --- 6. STUDENT & CONFIG ---
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
    } catch (e) { 
      console.error("[IPC] ❌ Failed to save student files", e); 
      return false; 
    }
  });

  // Stubs (Ollama removed)
  ipcMain.handle("get-current-llm-config", async () => ({ provider: "Cloud Waterfall", model: "auto", isOllama: false }));
  ipcMain.handle("get-available-ollama-models", async () => []);
  ipcMain.handle("switch-to-ollama", async () => ({ success: false, error: "Ollama removed" }));
  ipcMain.handle("switch-to-gemini", async (_, apiKey) => {
      console.log("[IPC] 🔄 Switch to Gemini");
      await appState.processingHelper.getLLMHelper().switchToGemini(apiKey);
      return { success: true };
  });
  ipcMain.handle("test-llm-connection", async () => {
      console.log("[IPC] 📡 Test Connection Request");
      return await appState.processingHelper.getLLMHelper().testConnection();
  });
}