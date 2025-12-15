import { app, BrowserWindow, Tray, Menu, nativeImage } from "electron"
import { initializeIpcHandlers } from "./ipcHandlers"
import { WindowHelper } from "./WindowHelper"
import { ScreenshotHelper } from "./ScreenshotHelper"
import { ShortcutsHelper } from "./shortcuts"
import { ProcessingHelper } from "./ProcessingHelper"

// Debug log to confirm file load
console.log("Main process loading...");

export class AppState {
  private static instance: AppState | null = null

  private windowHelper: WindowHelper
  private screenshotHelper: ScreenshotHelper
  public shortcutsHelper: ShortcutsHelper
  public processingHelper: ProcessingHelper
  private tray: Tray | null = null

  private view: "queue" | "solutions" = "queue"
  
  // NEW: Stealth State (Default True)
  private isStealthMode: boolean = true

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
    this.windowHelper = new WindowHelper(this)
    this.screenshotHelper = new ScreenshotHelper(this.view)
    this.processingHelper = new ProcessingHelper(this)
    this.shortcutsHelper = new ShortcutsHelper(this)
  }

  public static getInstance(): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState()
    }
    return AppState.instance
  }

  public getMainWindow(): BrowserWindow | null { return this.windowHelper.getMainWindow() }
  public getView(): "queue" | "solutions" { return this.view }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
    this.screenshotHelper.setView(view)
  }

  public isVisible(): boolean { return this.windowHelper.isVisible() }
  public getScreenshotHelper(): ScreenshotHelper { return this.screenshotHelper }
  public getProblemInfo(): any { return this.problemInfo }
  public setProblemInfo(problemInfo: any): void { this.problemInfo = problemInfo }
  public getScreenshotQueue(): string[] { return this.screenshotHelper.getScreenshotQueue() }
  public getExtraScreenshotQueue(): string[] { return this.screenshotHelper.getExtraScreenshotQueue() }

  public createWindow(): void {
    this.windowHelper.createWindow()
    // Apply current stealth state
    this.windowHelper.setStealthMode(this.isStealthMode)
  }

  // Toggle Stealth
  public toggleStealthMode(): boolean {
    this.isStealthMode = !this.isStealthMode
    this.windowHelper.setStealthMode(this.isStealthMode)
    return this.isStealthMode
  }
  
  public getIsStealthMode(): boolean { return this.isStealthMode }

  public hideMainWindow(): void { this.windowHelper.hideMainWindow() }
  public showMainWindow(): void { this.windowHelper.showMainWindow() }
  
  public toggleMainWindow(): void {
    console.log("Screenshots: ", this.screenshotHelper.getScreenshotQueue().length)
    this.windowHelper.toggleMainWindow()
  }

  public setWindowDimensions(width: number, height: number): void {
    this.windowHelper.setWindowDimensions(width, height)
  }

  public clearQueues(): void {
    this.screenshotHelper.clearQueues()
    this.problemInfo = null
    this.setView("queue")
  }

  public async takeScreenshot(): Promise<string> {
    if (!this.getMainWindow()) throw new Error("No main window available")
    return await this.screenshotHelper.takeScreenshot(
      () => this.hideMainWindow(),
      () => this.showMainWindow()
    )
  }

  public async getImagePreview(filepath: string): Promise<string> {
    return this.screenshotHelper.getImagePreview(filepath)
  }

  public async deleteScreenshot(path: string): Promise<{ success: boolean; error?: string }> {
    return this.screenshotHelper.deleteScreenshot(path)
  }

  public moveWindowLeft(): void { this.windowHelper.moveWindowLeft() }
  public moveWindowRight(): void { this.windowHelper.moveWindowRight() }
  public moveWindowDown(): void { this.windowHelper.moveWindowDown() }
  public moveWindowUp(): void { this.windowHelper.moveWindowUp() }
  public centerAndShowWindow(): void { this.windowHelper.centerAndShowWindow() }

  public createTray(): void {
    const image = nativeImage.createEmpty()
    let trayImage = image
    try { trayImage = nativeImage.createFromBuffer(Buffer.alloc(0)) } catch (e) {}
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
  
  app.on("activate", () => { if (appState.getMainWindow() === null) appState.createWindow() })
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit() })
  app.dock?.hide() 
  app.commandLine.appendSwitch("disable-background-timer-throttling")
}

initializeApp().catch(console.error)