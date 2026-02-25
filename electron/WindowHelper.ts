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
    const w = Math.round(width)
    const h = Math.round(height)

    // Explicit bounds calculation for DWM hit-test bug on transparent Windows apps
    const bounds = this.mainWindow.getBounds()
    this.mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: w, height: h })

    // Force a minimal opacity flutter to ensure the compositor updates the hit-region
    if (process.platform === "win32") {
      const op = this.mainWindow.getOpacity()
      this.mainWindow.setOpacity(op > 0.99 ? 0.99 : 1.0)
      setTimeout(() => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.setOpacity(op)
        }
      }, 50)
    }
  }

  public createWindow(): void {
    if (this.mainWindow !== null) return

    const { width: screenWidth, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const bladeWidth = 600; // Startup width

    this.mainWindow = new BrowserWindow({
      x: screenX + Math.round((screenWidth - bladeWidth) / 2), // Center Horizontally
      y: screenY, // Top
      width: bladeWidth,
      height: 200, // Initial height (compact with Start button)
      minWidth: 600,  // Safety floor - prevents content from disappearing
      minHeight: 200, // Minimum for compact view
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
      resizable: true, // ✅ ENABLED: User can now drag-resize from edges/corners
      movable: true,
    })

    this.setStealthMode(this.appState.getIsStealthMode())

    // --- NEW: Universal "Top Lock" for Zoom/Full-screen dominance ---
    // 'screen-saver' is the highest priority level on macOS and works as strict topmost on Windows.
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');

    // Explicitly allow visibility over full-screen apps (Mac)
    if (process.platform === "darwin") {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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

    // Position at Top-Center
    const { width: screenWidth, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const [currentWidth] = this.mainWindow.getSize();
    this.mainWindow.setPosition(
      screenX + Math.round((screenWidth - currentWidth) / 2),
      screenY
    );
    this.mainWindow.show();
    this.mainWindow.focus();

    // --- NEW: Re-assert dominance whenever the window is shown ---
    // This counters Windows/Mac pushing the window back when you click into Zoom.
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
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