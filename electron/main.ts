import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"

console.log("Main process loading...");

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private tray: Tray | null = null

  private view: "queue" | "solutions" = "queue"
  private isStealthMode: boolean = false
  private liveModeInterval: NodeJS.Timeout | null = null;
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
    this.windowHelper = new WindowHelper(this)
    this.shortcutsHelper = new ShortcutsHelper(this)

    AppState.instance = this
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  public getIsStealthMode(): boolean { return this.isStealthMode }

  public toggleStealthMode(): boolean {
    this.isStealthMode = !this.isStealthMode
    this.windowHelper.setStealthMode(this.isStealthMode)
    return this.isStealthMode
  }

  // --- Live Mode Logic ---

  public startLiveMode() {
    if (this.liveModeInterval) return { success: true };

    console.log("[AppState] 🚀 Starting Live Assist Loop (8s Interval)");

    this.runLiveAssistCycle();

    // Loop set to 8 seconds
    this.liveModeInterval = setInterval(() => {
      this.runLiveAssistCycle();
    }, 8000);

    return { success: true };
  }

  public stopLiveMode() {
    if (this.liveModeInterval) {
      clearInterval(this.liveModeInterval);
      this.liveModeInterval = null;
      console.log("[AppState] 🛑 Live Assist Loop Stopped");
    }
    return { success: true };
  }

  private async runLiveAssistCycle() {
    try {
      console.log("[LiveLoop] 🔄 Cycle Start...");

      // 1. Capture & Diff Check
      const screenshotPath = await this.screenshotHelper.captureAndCheckDiff(
        this.windowHelper.hideMainWindow.bind(this.windowHelper),
        this.windowHelper.showMainWindow.bind(this.windowHelper)
      );

      if (!screenshotPath) return;

      // 2. Routing
      if (this.view === "solutions") {
        console.log("[LiveLoop] ℹ️ View is 'Solutions' -> Adding to Debug Queue");
        this.screenshotHelper.addPathToExtraQueue(screenshotPath);
      } else {
        console.log("[LiveLoop] ℹ️ View is 'Queue' -> Adding to Main Queue");
        this.screenshotHelper.addPathToMainQueue(screenshotPath);
      }

      // 3. Process
      await this.processingHelper.processScreenshots();

    } catch (error) {
      console.error("[LiveLoop] ⚠️ Cycle Error:", error);
    }
  }

  public getMainWindow() { return this.windowHelper.getMainWindow() }
  public createWindow() { this.windowHelper.createWindow() }
  public toggleMainWindow() { this.windowHelper.toggleMainWindow() }
  public centerAndShowWindow() { this.windowHelper.centerAndShowWindow() }
  public setWindowDimensions(width: number, height: number) { this.windowHelper.setWindowDimensions(width, height) }
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
    const image = nativeImage.createEmpty()
    let trayImage = image
    try { trayImage = nativeImage.createFromBuffer(Buffer.alloc(0)) } catch (e) { }
    this.tray = new Tray(trayImage)
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Interview Coder', click: () => { this.centerAndShowWindow() } },
      { label: 'Toggle Window', click: () => { this.toggleMainWindow() } },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Command+Q', click: () => { app.quit() } }
    ])
    this.tray.setToolTip('Interview Coder')
    this.tray.setContextMenu(contextMenu)
    if (process.platform === 'darwin') this.tray.setTitle('IC')
    this.tray.on('double-click', () => { this.centerAndShowWindow() })
  }

  public setHasDebugged(value: boolean): void { this.hasDebugged = value }
  public getHasDebugged(): boolean { return this.hasDebugged }
}

async function initializeApp() {
  const appState = AppState.getInstance()
  initializeIpcHandlers(appState)

  app.whenReady().then(() => {
    console.log("App is ready")
    appState.createWindow()
    appState.createTray()
    appState.shortcutsHelper.registerGlobalShortcuts()
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) appState.createWindow()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })
}

initializeApp();