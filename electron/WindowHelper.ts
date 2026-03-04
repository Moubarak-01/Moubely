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

  // State variables for window geometry memory
  private customExpandedHeight: number = 700
  private isExpandedState: boolean = false

  // --- UNLOCKED RESIZING ---
  public setWindowDimensions(width: number, height: number): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    let w = Math.round(width)
    let h = Math.round(height)

    w = Math.max(600, w);
    if (this.isExpandedState) {
      h = Math.max(700, h);
    } else {
      h = 200;
    }

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

  // --- NEW: STATEFUL EXPAND TOGGLE ---
  public toggleExpand(isExpanded: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

    this.isExpandedState = isExpanded;
    const [currentWidth, currentHeight] = this.mainWindow.getSize();

    if (isExpanded) {
      // User clicked "Up" arrow (Expanding)
      // 1. Remove max height limit, set min height to 700
      this.mainWindow.setMinimumSize(600, 700);
      this.mainWindow.setMaximumSize(9999, 9999);

      // 2. Set the bounds: width comes from BEFORE expand (shared width), height comes from memory
      this.setWindowDimensions(currentWidth, this.customExpandedHeight);
    } else {
      // User clicked "Down" arrow (Collapsing)
      // 1. Save their custom expanded window height
      this.customExpandedHeight = Math.max(700, currentHeight);

      // 2. Lock height to strict 200 bounds
      this.mainWindow.setMinimumSize(600, 200);
      this.mainWindow.setMaximumSize(9999, 200);

      // 3. Set bounds: width stays the SAME, height goes to 200
      this.setWindowDimensions(currentWidth, 200);
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
      maxHeight: 200, // Lock height for compact view to prevent vertical stretch
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
      icon: path.join(__dirname, "../assets/Moubely_icon.png"),
    })

    // Immediately sync mouse events state based on private mode
    const isPrivate = this.appState.getIsPrivateMode()
    const isStealth = this.appState.getIsStealthMode()

    this.setPrivateMode(isPrivate)
    this.setStealthMode(isStealth)

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

  // --- STEALTH LOGIC (Content Protection) ---
  public setStealthMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // enabled = true  -> Protected (Hidden from recording)
    // enabled = false -> Unprotected (Visible in recording)
    this.mainWindow.setContentProtection(enabled)

    if (process.platform === "darwin") {
      this.mainWindow.setHiddenInMissionControl(enabled)
    }
  }

  // --- PRIVATE MODE LOGIC (Click Pass-through) ---
  public setPrivateMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // Ensure mouse events state is synced
    // { forward: true } allows the window to still "see" the mouse even if clicks pass through
    this.mainWindow.setIgnoreMouseEvents(enabled, { forward: true })
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