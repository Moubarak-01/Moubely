import { ipcMain, app, desktopCapturer, shell } from "electron";
import path from "path";
import fs from "fs";
import { AppState } from "./main";

// Helper for consistent logging
const logIPC = (channel: string, details: string = "") => {
  console.log(`[IPC ⚡] ${channel.padEnd(20)} | ${details}`);
};

export function initializeIpcHandlers(appState: AppState) {
  // Access the LLMHelper through the processingHelper existing in AppState
  const llmHelper = (appState.processingHelper as any).llmHelper;

  ipcMain.handle('save-user-profile', async (event, profileData) => {
    try {
      const userDataPath = app.getPath('userData');
      const profilePath = path.join(userDataPath, 'user_profile.json');
      fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
      console.log(`[IPC ⚡] ✅ User Profile Saved to: ${profilePath}`);
      return { success: true };
    } catch (error) {
      console.error(`[IPC ⚡] ❌ Profile Save Failed:`, error);
      throw error;
    }
  });

  ipcMain.handle('get-user-profile', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const profilePath = path.join(userDataPath, 'user_profile.json');
      if (fs.existsSync(profilePath)) {
        const data = fs.readFileSync(profilePath, 'utf-8');
        return JSON.parse(data);
      }
      return null; // No profile exists
    } catch (error) {
      console.error(`[IPC ⚡] ❌ Profile Load Failed:`, error);
      return null;
    }
  });

  // --- 1. CORE WINDOW COMMANDS ---

  ipcMain.handle("set-window-size", (event, { width, height }) => {
    logIPC("set-window-size", `Width: ${width}, Height: ${height}`);
    appState.setWindowDimensions(width, height);
    return true;
  });

  ipcMain.handle("quit-app", () => {
    logIPC("quit-app", "User requested quit.");
    app.quit();
    return true;
  });

  ipcMain.handle("move-window-left", () => {
    appState.moveWindowLeft();
    return true;
  });

  ipcMain.handle("move-window-right", () => {
    appState.moveWindowRight();
    return true;
  });

  ipcMain.handle("move-window-up", () => {
    appState.moveWindowUp();
    return true;
  });

  ipcMain.handle("move-window-down", () => {
    appState.moveWindowDown();
    return true;
  });

  // --- STEALTH MODE ---
  ipcMain.handle("get-stealth-mode", () => {
    return appState.getIsStealthMode();
  });

  ipcMain.handle("toggle-stealth-mode", () => {
    const newState = appState.toggleStealthMode();
    logIPC("toggle-stealth-mode", `New State: ${newState ? "HIDDEN" : "VISIBLE"}`);
    return newState;
  });

  // --- 2. AI CHAT HANDLER ---
  ipcMain.handle("gemini-chat", async (event, args) => {
    try {
      if (!llmHelper) throw new Error("LLM Helper not initialized");

      const { message, history, mode, fileContext, type, isCandidateMode } = args;

      logIPC("gemini-chat", `Type: ${type?.toUpperCase() || "GENERAL"} | Mode: ${mode} | Twin: ${isCandidateMode}`);
      if (message) console.log(`[IPC ⚡] >> Prompt: "${message.slice(0, 60).replace(/\n/g, ' ')}..."`);

      const response = await llmHelper.chatWithGemini(
        message,
        history || [],
        mode || "General",
        fileContext || "",
        type || "general",
        isCandidateMode || false,
        (token: string) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("llm-token", token);
          }
        }
      );

      console.log(`[IPC ⚡] << Response Complete (${response.length} chars)`);
      return response;

    } catch (error: any) {
      console.error(`[IPC ⚡] ❌ Gemini Chat Error:`, error);
      return `Error: ${error.message}`;
    }
  });

  // --- 3. VISION HANDLER ---
  ipcMain.handle("chat-with-image", async (event, { message, imagePaths }) => {
    try {
      logIPC("chat-with-image", `Images: ${imagePaths?.length || 0}`);
      if (!llmHelper) throw new Error("LLM Helper not initialized");

      return await llmHelper.chatWithImage(message, imagePaths, (token: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("llm-token", token);
        }
      });
    } catch (error: any) {
      console.error(`[IPC ⚡] ❌ Vision Error:`, error);
      return `Vision Error: ${error.message}`;
    }
  });

  // --- 4. AUDIO HANDLER ---
  // FIX: Added 'timestamp' argument to support correct ordering (Race Condition Fix)
  ipcMain.handle("analyze-audio-base64", async (event, base64Data, mimeType, isUrgent, timestamp) => {
    const size = base64Data ? base64Data.length : 0;
    const safeUrgency = isUrgent || false;
    const urgencyLabel = safeUrgency ? "⚡ URGENT" : "🐢 CASUAL";

    logIPC("analyze-audio", `Format: ${mimeType} | Size: ${size} | ${urgencyLabel}`);

    if (!llmHelper) {
      console.error("[IPC ⚡] ❌ LLM Helper is missing!");
      return { text: "Audio Error: LLM Not Ready" };
    }

    // FIX: Pass timestamp to helper so it comes back attached to the text
    return await llmHelper.analyzeAudioFromBase64(base64Data, mimeType, safeUrgency, timestamp);
  });

  // --- 5. SCREENSHOT HANDLERS ---
  ipcMain.handle("take-screenshot", async () => {
    logIPC("take-screenshot", "Capturing screen...");
    try {
      const filePath = await appState.takeScreenshot();
      const preview = await appState.getScreenshotHelper().getImagePreview(filePath);

      logIPC("take-screenshot", "✅ Success: Returning Object");
      return { path: filePath, preview };

    } catch (e: any) {
      console.error("[IPC ⚡] ❌ Screenshot Failed:", e);
      return null;
    }
  });

  ipcMain.handle("delete-screenshot", async (event, filePath) => {
    logIPC("delete-screenshot", path.basename(filePath));
    return await appState.deleteScreenshot(filePath);
  });

  // --- 6. STUDENT PROFILE HANDLERS ---
  ipcMain.handle("check-profile-exists", async () => {
    const studentDir = path.join(app.getPath("userData"), "student_profile");
    const exists = fs.existsSync(studentDir) && fs.readdirSync(studentDir).length > 0;
    logIPC("check-profile", exists ? "Found Profile" : "No Profile");
    return exists;
  });

  ipcMain.handle("save-student-files", async (event, files) => {
    logIPC("save-student-files", `Saving ${files.length} files...`);
    const studentDir = path.join(app.getPath("userData"), "student_profile");
    if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

    const oldFiles = fs.readdirSync(studentDir);
    for (const file of oldFiles) {
      fs.unlinkSync(path.join(studentDir, file));
    }

    for (const file of files) {
      const filePath = path.join(studentDir, file.name);
      await fs.promises.writeFile(filePath, Buffer.from(file.data));
    }

    if (llmHelper) llmHelper.clearStudentCache();

    logIPC("save-student-files", "✅ Save Complete & Cache Cleared");
    return true;
  });
}