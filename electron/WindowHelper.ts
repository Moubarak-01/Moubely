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

  // --- RESIZE LOGIC ---
  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    const [currentX, currentY] = this.mainWindow.getPosition()
    const primaryDisplay = screen.getPrimaryDisplay()
    const workArea = primaryDisplay.workAreaSize

    // Allow wider width (up to full screen width)
    const maxAllowedWidth = workArea.width

    // Force valid integers. 
    // We allow shrinking down to 150x50 as requested to enable "Compact Mode" manually.
    const newWidth = Math.max(150, Math.min(Math.round(width), maxAllowedWidth))
    const newHeight = Math.max(50, Math.round(height))

    this.mainWindow.setSize(newWidth, newHeight)
    // Maintain position
    this.mainWindow.setPosition(currentX, currentY)
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const windowSettings: Electron.BrowserWindowConstructorOptions = {
      width: 450,
      height: 600,
      minWidth: 150,  // Allows shrinking
      minHeight: 50,  // Allows shrinking
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
      focusable: true,
      resizable: true, // Native resizing enabled
      movable: true,
    }

    this.mainWindow = new BrowserWindow(windowSettings)
    this.mainWindow.setContentProtection(true)

    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      this.mainWindow.setHiddenInMissionControl(true)
      this.mainWindow.setAlwaysOnTop(true, "floating")
    }
    
    this.mainWindow.setSkipTaskbar(true)
    this.mainWindow.setAlwaysOnTop(true)

    this.mainWindow.loadURL(startUrl).catch(console.error)

    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.centerWindow()
        this.mainWindow.show()
        this.mainWindow.focus()
      }
    })

    this.mainWindow.on("closed", () => {
      this.mainWindow = null
    })
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
  
  public toggleMainWindow() {
    if (this.isVisible()) this.hideMainWindow()
    else this.showMainWindow()
  }

  public centerAndShowWindow() {
    this.centerWindow()
    this.mainWindow?.show()
    this.mainWindow?.focus()
  }

  public moveWindowRight() { this.moveWindow(20, 0) }
  public moveWindowLeft() { this.moveWindow(-20, 0) }
  public moveWindowDown() { this.moveWindow(0, 20) }
  public moveWindowUp() { this.moveWindow(0, -20) }

  private moveWindow(dx: number, dy: number) {
    if (!this.mainWindow) return
    const pos = this.mainWindow.getPosition()
    this.mainWindow.setPosition(pos[0] + dx, pos[1] + dy)
  }
}