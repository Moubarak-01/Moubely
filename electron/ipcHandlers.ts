import { ipcMain, app, desktopCapturer, shell, dialog } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AppState } from "./main";
import { LocalServerHelper } from "./LocalServerHelper";
import { GenerationHelper } from "./GenerationHelper";

// Helper for consistent logging
const logIPC = (channel: string, details: string = "") => {
  console.log(`[IPC ⚡] ${channel.padEnd(20)} | ${details}`);
};

export function initializeIpcHandlers(appState: AppState) {
  // Access the LLMHelper through the processingHelper existing in AppState
  const llmHelper = (appState.processingHelper as any).llmHelper;
  const generationHelper = new GenerationHelper();

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

  ipcMain.handle("toggle-expand", (event, isExpanded: boolean) => {
    logIPC("toggle-expand", `Expanded: ${isExpanded}`);
    appState.toggleExpand(isExpanded);
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

  // --- MOUSE CLICK-THROUGH HANDLERS ---
  ipcMain.handle("set-ignore-mouse-events", (event, ignore: boolean, options: any) => {
    const win = appState.getMainWindow();
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  ipcMain.on("toggle-mouse-ignore", (event, ignore: boolean) => {
    const win = appState.getMainWindow();
    if (win) {
      win.setIgnoreMouseEvents(ignore, { forward: true });
    }
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
  ipcMain.handle("get-background-cursor", async () => {
    return await appState.cursorHelper.getBackgroundCursor();
  });

  ipcMain.handle("get-stealth-mode", () => {
    return appState.getIsStealthMode();
  });

  ipcMain.handle("toggle-stealth-mode", () => {
    const newState = appState.toggleStealthMode();
    logIPC("toggle-stealth-mode", `New State: ${newState ? "PROTECTED" : "VISIBLE"}`);
    return newState;
  });

  // --- PRIVATE MODE ---
  ipcMain.handle("get-private-mode", () => {
    return appState.getIsPrivateMode();
  });

  ipcMain.handle("toggle-private-mode", () => {
    const newState = appState.togglePrivateMode();
    logIPC("toggle-private-mode", `New State: ${newState ? "PASS-THROUGH" : "INTERACTIVE"}`);
    return newState;
  });

  // --- 2. AI CHAT HANDLER ---
  ipcMain.handle("generate-media", async (event, args) => {
    try {
      logIPC("generate-media", `Model: ${args.model} | Prompt: ${args.prompt.substring(0, 30)}...`);
      return await generationHelper.generateMedia(args);
    } catch (error: any) {
      console.error(`[IPC ⚡] ❌ Generation Error:`, error);
      throw error;
    }
  });

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

  ipcMain.handle("cancel-gemini-chat", async () => {
    if (llmHelper) {
      llmHelper.abortChat();
      logIPC("cancel-gemini-chat", "Cancellation signal sent to LLM Helper");
    }
  });

  // --- 3. ATTACHMENT HANDLER ---
  ipcMain.handle("chat-with-attachments", async (event, { message, attachments, type }) => {
    try {
      logIPC("chat-with-attachments", `Attachments: ${attachments?.length || 0} | Type: ${type || "answer"}`);
      if (!llmHelper) throw new Error("LLM Helper not initialized");

      return await llmHelper.chatWithAttachments(message, attachments, (token: string) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("llm-token", token);
        }
      }, type);
    } catch (error: any) {
      console.error(`[IPC ⚡] ❌ Attachment Error:`, error);
      return `Attachment Error: ${error.message}`;
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

    // --- FIX: Pass timestamp to helper so it comes back attached to the text
    return await llmHelper.analyzeAudioFromBase64(base64Data, mimeType, safeUrgency, timestamp);
  });

  // --- NEW: DICTATION HANDLER ---
  ipcMain.handle("transcribe-dictation", async (event, base64Data, mimeType) => {
    logIPC("transcribe-dictation", `Format: ${mimeType} | Size: ${base64Data ? base64Data.length : 0}`);
    if (!llmHelper) {
      console.error("[IPC ⚡] ❌ LLM Helper is missing!");
      return "Error: LLM Worker offline";
    }

    // Call the exact same function but ONLY return the text property immediately.
    // urgency = false to prioritize local whisper queue.
    const result = await llmHelper.analyzeAudioFromBase64(base64Data, mimeType, false);
    return result.text;
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

  ipcMain.handle('open-file-picker', async () => {
    try {
      const result: any = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) return [];

      const userDataPath = app.getPath('userData');
      const attachmentsDir = path.join(userDataPath, 'moubely_attachments');
      if (!fs.existsSync(attachmentsDir)) {
        fs.mkdirSync(attachmentsDir, { recursive: true });
      }

      const files = [];
      for (const sourcePath of result.filePaths) {
        const ext = path.extname(sourcePath).toLowerCase().replace('.', '');
        const filename = `${crypto.randomUUID()}.${ext}`;
        const destPath = path.join(attachmentsDir, filename);

        fs.copyFileSync(sourcePath, destPath);

        const textExtensions = ['txt', 'md', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx', 'py', 'html', 'css', 'go', 'cs', 'java', 'cpp', 'c', 'h', 'hpp', 'sh', 'bash', 'yml', 'yaml', 'xml', 'log', 'ini', 'cfg', 'conf', 'php', 'rb', 'swift', 'kt', 'dart', 'rs', 'sql', 'env'];
        let type = 'generic_file';
        if (['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext)) type = 'image';
        else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) type = 'video';
        else if (ext === 'pdf') type = 'pdf';
        else if (textExtensions.includes(ext)) type = 'text';

        files.push({
          name: path.basename(sourcePath),
          path: `moubely://moubely_attachments/${filename}`,
          localPath: LocalServerHelper.getMediaUrl(filename),
          type: type
        });
      }

      console.log(`[IPC ⚡] ✅ Picked ${files.length} files.`);
      return files;
    } catch (error) {
      console.error(`[IPC ⚡] ❌ File Picker Failed:`, error);
      throw error;
    }
  });

  ipcMain.handle('save-chat-file', async (event, arrayBuffer: ArrayBuffer, extension: string, originalName: string = 'pasted_file') => {
    try {
      const userDataPath = app.getPath('userData');
      const attachmentsDir = path.join(userDataPath, 'moubely_attachments');
      if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });

      const filename = `${crypto.randomUUID()}.${extension.replace('.', '')}`;
      const filePath = path.join(attachmentsDir, filename);
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

      console.log(`[IPC ⚡] ✅ Chat File Saved to: ${filePath}`);
      return `moubely://moubely_attachments/${filename}`;
    } catch (error) {
      console.error(`[IPC ⚡] ❌ Chat File Save Failed:`, error);
      throw error;
    }
  });

  ipcMain.handle('delete-chat-files', async (event, urls: string[]) => {
    try {
      const userDataPath = app.getPath('userData');
      for (const url of urls) {
        if (url.startsWith('moubely://')) {
          const relativePath = url.replace('moubely://', '');
          const filePath = path.join(userDataPath, relativePath);
          // prevent directory traversal outside userData
          if (filePath.startsWith(userDataPath) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[IPC ⚡] 🗑️ Deleted chat file: ${relativePath}`);
          }
        }
      }
      return { success: true };
    } catch (error: any) {
      console.error(`[IPC ⚡] ❌ Chat File Delete Failed:`, error);
      return { success: false, error: error.message };
    }
  });
}