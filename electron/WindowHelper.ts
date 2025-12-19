import { BrowserWindow, screen } from "electron"
import { AppState } from "./main"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"
const startUrl = isDev ? "http://localhost:5180" : `file://${path.join(__dirname, "../dist/index.html")}`

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  // --- UNLOCKED RESIZING ---
  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.setSize(Math.round(width), Math.round(height))
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const bladeWidth = 450; 

    this.mainWindow = new BrowserWindow({
      x: screenWidth - bladeWidth,
      y: 0,
      width: bladeWidth,
      height: 600, // Initial height
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: false,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: "#00000000",
      resizable: false, // User can't drag-resize, but code can resize
      movable: true,
    })

    this.setStealthMode(this.appState.getIsStealthMode()) 

    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }
    
    this.mainWindow.setSkipTaskbar(true)
    this.mainWindow.loadURL(startUrl).catch(console.error)
    
    this.mainWindow.once('ready-to-show', () => {
      setTimeout(() => {
          this.centerAndShowWindow() 
      }, 100);
    })

    this.mainWindow.on("closed", () => { this.mainWindow = null })
  }

  // --- STEALTH LOGIC (Fixes Recording Issue) ---
  public setStealthMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    
    // enabled = true  -> Protected (Hidden from recording)
    // enabled = false -> Unprotected (Visible in recording)
    // This updates the flag immediately so OBS/Zoom can see it when toggled off.
    this.mainWindow.setContentProtection(enabled)
    
    if (process.platform === "darwin") {
      this.mainWindow.setHiddenInMissionControl(enabled)
    }
  }

  public getMainWindow() { return this.mainWindow }
  public isVisible() { return this.mainWindow?.isVisible() ?? false }
  public hideMainWindow() { this.mainWindow?.hide() }
  public showMainWindow() { this.mainWindow?.showInactive() }
  public toggleMainWindow() { if (this.isVisible()) this.hideMainWindow(); else this.showMainWindow(); }

  public centerAndShowWindow() { 
      if (!this.mainWindow) return;
      this.mainWindow.center(); 
      this.mainWindow.show(); 
      this.mainWindow.focus();
  }

  public moveWindowRight() { this.moveWindow(20, 0) }
  public moveWindowLeft() { this.moveWindow(-20, 0) }
  public moveWindowDown() { this.moveWindow(0, 20) }
  public moveWindowUp() { this.moveWindow(0, -20) }

  private moveWindow(dx: number, dy: number) { 
    if (!this.mainWindow) return; 
    const pos = this.mainWindow.getPosition(); 
    this.mainWindow.setPosition(pos[0] + dx, pos[1] + dy); 
  }
}