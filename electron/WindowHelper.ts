import { BrowserWindow, screen } from "electron"
import { AppState } from "./main"
import path from "node:path"

const isDev = process.env.NODE_ENV === "development"

const startUrl = isDev
  ? "http://localhost:5180"
  : `file://${path.join(__dirname, "../dist/index.html")}`

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    const [currentX, currentY] = this.mainWindow.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    const maxAllowedWidth = workArea.width
    const newWidth = Math.max(150, Math.min(Math.round(width), maxAllowedWidth))
    const newHeight = Math.max(50, Math.round(height))
    this.mainWindow.setSize(newWidth, newHeight)
    this.mainWindow.setPosition(currentX, currentY)
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return
    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      width: 450,
      height: 120,
      minWidth: 150,
      minHeight: 50,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      },
      show: false, // Window starts hidden to prevent flash of white
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: "#00000000",
      focusable: true,
      resizable: false,
      movable: true,
    }
    this.mainWindow = new BrowserWindow(windowSettings)

    // Use current stealth state for content protection
    this.setStealthMode(this.appState.getIsStealthMode()) 

    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      this.mainWindow.setHiddenInMissionControl(this.appState.getIsStealthMode())
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }
    this.mainWindow.setSkipTaskbar(true)
    this.mainWindow.setAlwaysOnTop(true)
    this.mainWindow.loadURL(startUrl).catch(console.error)
    
    // FIX: Show/Focus unconditionally on ready-to-show to defeat the ghost window bug.
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.centerWindow()
        
        // This forces the window to render on launch. 
        // If the app is supposed to be stealthy, the user can use Ctrl+B to hide it immediately.
        setTimeout(() => {
            this.mainWindow?.show()
            this.mainWindow?.focus()
        }, 100);
      }
    })
    this.mainWindow.on("closed", () => { this.mainWindow = null })
  }

  // --- STEALTH TOGGLE LOGIC ---
  public setStealthMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.setContentProtection(enabled)
    if (process.platform === "darwin") {
      this.mainWindow.setHiddenInMissionControl(enabled)
    }
  }

  private centerWindow(): void {
    if (!this.mainWindow) return
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize
    const bounds = this.mainWindow.getBounds()
    const centerX = Math.floor((workArea.width - bounds.width) / 2)
    const centerY = Math.floor((workArea.height - bounds.height) / 2)
    this.mainWindow.setBounds({ x: centerX, y: centerY, width: bounds.width, height: bounds.height })
  }

  public getMainWindow() { return this.mainWindow }
  public isVisible() { return this.mainWindow?.isVisible() ?? false }
  public hideMainWindow() { this.mainWindow?.hide() }
  public showMainWindow() { this.mainWindow?.showInactive() }
  public toggleMainWindow() { if (this.isVisible()) this.hideMainWindow(); else this.centerAndShowWindow(); }
  public centerAndShowWindow() { 
      this.centerWindow(); 
      this.mainWindow?.show(); 
      this.mainWindow?.focus(); // Focus ensures it's not a ghost window (Fixes Blank Window Bug)
  }
  public moveWindowRight() { this.moveWindow(20, 0) }
  public moveWindowLeft() { this.moveWindow(-20, 0) }
  public moveWindowDown() { this.moveWindow(0, 20) }
  public moveWindowUp() { this.moveWindow(0, -20) }
  private moveWindow(dx: number, dy: number) { if (!this.mainWindow) return; const pos = this.mainWindow.getPosition(); this.mainWindow.setPosition(pos[0] + dx, pos[1] + dy); }
}