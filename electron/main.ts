import { app, BrowserWindow, Tray, Menu, nativeImage, protocol, net, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { GenerationHelper } from "./GenerationHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"
import { CursorHelper } from "./CursorHelper"
import { LocalServerHelper } from "./LocalServerHelper"

console.log("Main process loading...");

protocol.registerSchemesAsPrivileged([
  { scheme: 'moubely', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } },
  { scheme: 'moubely-local', privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  public generationHelper: GenerationHelper
  public cursorHelper: CursorHelper
  private tray: any = null

  private view: "queue" | "solutions" = "queue"
  private isStealthMode: boolean = false
  private isPrivateMode: boolean = false

  private problemInfo: any = null
  private hasDebugged: boolean = false

  public readonly PROCESSING_EVENTS = {
    UNAUTHORIZED: "procesing-unauthorized",
    NO_SCREENSHOTS: "processing-no-screenshots",
    INITIAL_START: "initial-start",
    PROBLEM_EXTRACTED: "problem-extracted",
    SOLUTION_SUCCESS: "solution-success",
    INITIAL_SOLUTION_ERROR: "solution-error",
    DEBUG_START: "debug-start",
    DEBUG_SUCCESS: "debug-success",
    DEBUG_ERROR: "debug-error"
  } as const

  constructor() {
    if (AppState.instance) return AppState.instance

    this.screenshotHelper = new ScreenshotHelper(this.view)
    this.processingHelper = new ProcessingHelper(this)
    this.generationHelper = new GenerationHelper()
    this.windowHelper = new WindowHelper(this)
    this.shortcutsHelper = new ShortcutsHelper(this)
    this.cursorHelper = new CursorHelper()

    AppState.instance = this
  }

  public async refreshProcessingHelper() {
    console.log("[AppState] 🔄 Refreshing Processing Helper with new keys...");
    this.processingHelper = new ProcessingHelper(this);
    await loadApiKeys(this);
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  public getIsStealthMode(): boolean { return this.isStealthMode }
  public getIsPrivateMode(): boolean { return this.isPrivateMode }

  public toggleStealthMode(): boolean {
    this.isStealthMode = !this.isStealthMode
    console.log(`[AppState] 🛡️ Stealth Mode (Recording Protection): ${this.isStealthMode ? "ON" : "OFF"}`);
    this.windowHelper.setStealthMode(this.isStealthMode)

    // Notify renderer via IPC
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send("stealth-mode-toggled", this.isStealthMode)
    }

    return this.isStealthMode
  }

  public togglePrivateMode(): boolean {
    this.isPrivateMode = !this.isPrivateMode
    console.log(`[AppState] 🕶️ Private Mode (Click Pass-through): ${this.isPrivateMode ? "ON" : "OFF"}`);
    this.windowHelper.setPrivateMode(this.isPrivateMode)

    // Notify renderer via IPC
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send("private-mode-toggled", this.isPrivateMode)
    }

    return this.isPrivateMode
  }


  public getMainWindow() { return this.windowHelper.getMainWindow() }
  public createWindow() { this.windowHelper.createWindow() }
  public toggleMainWindow() { this.windowHelper.toggleMainWindow() }
  public centerAndShowWindow() { this.windowHelper.centerAndShowWindow() }
  public setWindowDimensions(width: number, height: number) { this.windowHelper.setWindowDimensions(width, height) }
  public toggleExpand(isExpanded: boolean) { this.windowHelper.toggleExpand(isExpanded) }
  public deleteScreenshot(path: string) { return this.screenshotHelper.deleteScreenshot(path) }
  public takeScreenshot() { return this.screenshotHelper.takeScreenshot(this.windowHelper.hideMainWindow.bind(this.windowHelper), this.windowHelper.showMainWindow.bind(this.windowHelper)) }
  public getImagePreview(path: string) { return this.screenshotHelper.getImagePreview(path) }
  public getScreenshotQueue() { return this.screenshotHelper.getScreenshotQueue() }
  public getExtraScreenshotQueue() { return this.screenshotHelper.getExtraScreenshotQueue() }
  public clearQueues() { this.screenshotHelper.clearQueues() }
  public getView() { return this.view }
  public setView(view: "queue" | "solutions") { this.view = view; this.screenshotHelper.setView(view); }
  public setProblemInfo(info: any) { this.problemInfo = info }
  public getProblemInfo() { return this.problemInfo }
  public moveWindowLeft() { return this.windowHelper.moveWindowLeft() }
  public moveWindowRight() { return this.windowHelper.moveWindowRight() }
  public moveWindowUp() { return this.windowHelper.moveWindowUp() }
  public moveWindowDown() { return this.windowHelper.moveWindowDown() }
  public getScreenshotHelper() { return this.screenshotHelper }

  public createTray() {
    if (this.tray !== null) return
    
    // Path to the tray icon (using the same logic as the window icon)
    const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
    const iconPath = isDev 
      ? path.join(__dirname, "../assets/Moubely_icon.png")
      : path.join(process.resourcesPath, "assets/Moubely_icon.png")
      
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    
    this.tray = new Tray(trayIcon)
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Moubely', click: () => { this.centerAndShowWindow() } },
      { label: 'Toggle Window', click: () => { this.toggleMainWindow() } },
      { label: 'API Settings', click: () => { 
        const win = this.getMainWindow();
        if (win) {
          win.webContents.send("reset-view"); // Reset state
          win.loadURL(this.windowHelper.getStartUrl() + "#/settings");
          this.centerAndShowWindow();
        }
      }},
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Command+Q', click: () => { app.quit() } }
    ])
    this.tray.setToolTip('Moubely')
    this.tray.setContextMenu(contextMenu)
    if (process.platform === 'darwin') this.tray.setTitle('Moubely')
    this.tray.on('double-click', () => { this.centerAndShowWindow() })
  }

  public setHasDebugged(value: boolean): void { this.hasDebugged = value }
  public getHasDebugged(): boolean { return this.hasDebugged }
}

/**
 * Loads and decrypts API keys from the user data directory,
 * then updates the LLMHelper instance.
 */
async function loadApiKeys(appState: AppState) {
  try {
    const userDataPath = app.getPath('userData');
    const keysPath = path.join(userDataPath, 'api_keys.json');

    if (!fs.existsSync(keysPath)) {
      console.log("[Main] ℹ️ No custom API keys found.");
      return;
    }

    const encryptedData = JSON.parse(fs.readFileSync(keysPath, 'utf-8'));
    const decryptedKeys: { [key: string]: string } = {};

    for (const [provider, encryptedValue] of Object.entries(encryptedData)) {
      if (typeof encryptedValue === 'string') {
        if (safeStorage.isEncryptionAvailable()) {
          try {
            const buffer = Buffer.from(encryptedValue, 'base64');
            decryptedKeys[provider] = safeStorage.decryptString(buffer);
          } catch (e) {
            console.error(`[Main] ❌ Decryption failed for ${provider}`);
          }
        } else {
          decryptedKeys[provider] = encryptedValue as string;
        }
      }
    }

    const llmHelper = (appState.processingHelper as any).llmHelper;
    if (llmHelper && Object.keys(decryptedKeys).length > 0) {
      llmHelper.updateApiKeys(decryptedKeys);
      if (decryptedKeys.gemini) {
        appState.generationHelper.setApiKey(decryptedKeys.gemini);
      }
      console.log("[Main] 🔐 Applied User API Keys on Startup");
    }
  } catch (error) {
    console.error("[Main] ❌ Failed to load API keys on startup:", error);
  }
}

async function initializeApp() {
  app.whenReady().then(async () => {
    const appState = AppState.getInstance()
    initializeIpcHandlers(appState)
    
    // Load and apply user-provided API keys immediately after IPC setup
    await loadApiKeys(appState)

    console.log("App is ready")
    console.log("Initializing App components...")
    appState.createWindow()
    appState.createTray()
    appState.shortcutsHelper.registerGlobalShortcuts()

    // ✨ Boot up the dedicated Media Server for Videos & PDFs
    const mediaServer = new LocalServerHelper()
    mediaServer.startServer()

    protocol.handle('moubely', (request) => {
      const urlPath = request.url.slice('moubely://'.length);
      const userDataPath = app.getPath('userData');
      const absolutePath = path.join(userDataPath, urlPath);

      if (!absolutePath.startsWith(userDataPath)) {
        return new Response('Not Found', { status: 404 });
      }
      return net.fetch(require('url').pathToFileURL(absolutePath).toString());
    });

    protocol.handle('moubely-local', (request) => {
      try {
        const urlStr = request.url.slice('moubely-local://'.length);
        const absolutePath = decodeURIComponent(urlStr);
        return net.fetch(require('url').pathToFileURL(absolutePath).toString());
      } catch (err) {
        console.error("Failed handling moubely-local:", err);
        return new Response('Not Found', { status: 404 });
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) appState.createWindow()
    })
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}

initializeApp();