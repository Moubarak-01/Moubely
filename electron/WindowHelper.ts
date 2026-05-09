import { BrowserWindow, screen, app } from "electron"
import { AppState } from "./main"
import path from "node:path"
import { pathToFileURL } from "node:url"
import os from "os"

// ── Windows Native API Stealth Focus ──────────────────────────────────
// WS_EX_NOACTIVATE: Clicking the window NEVER steals focus from the background app.
// WS_EX_TOOLWINDOW: Window is hidden from Alt+Tab.
// Combined, Chrome (or any app) stays as the "active" window — full stealth.
const GWL_EXSTYLE = -20;
const WS_EX_NOACTIVATE  = 0x08000000;
const WS_EX_TOOLWINDOW  = 0x00000080;
const WS_EX_APPWINDOW   = 0x00040000; // We REMOVE this to hide from taskbar
const SWP_FRAMECHANGED  = 0x0020;
const SWP_NOMOVE        = 0x0002;
const SWP_NOSIZE        = 0x0001;
const SWP_NOZORDER      = 0x0004;
const SWP_NOACTIVATE    = 0x0010;

let stealthApiLoaded = false;
let GetWindowLongPtrW: any = null;
let SetWindowLongPtrW: any = null;
let SetWindowPos: any = null;
let GetForegroundWindow: any = null;
let SetForegroundWindow: any = null;

function loadStealthApis() {
  if (stealthApiLoaded || os.platform() !== "win32") return;
  stealthApiLoaded = true;
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    // Use 'int64' for the pointer-width long on x64 Windows
    GetWindowLongPtrW  = user32.func("int64 __stdcall GetWindowLongPtrW(void* hWnd, int nIndex)");
    SetWindowLongPtrW  = user32.func("int64 __stdcall SetWindowLongPtrW(void* hWnd, int nIndex, int64 dwNewLong)");
    SetWindowPos       = user32.func("bool __stdcall SetWindowPos(void* hWnd, void* hWndInsertAfter, int X, int Y, int cx, int cy, uint flags)");
    GetForegroundWindow = user32.func("void* __stdcall GetForegroundWindow()");
    SetForegroundWindow = user32.func("bool __stdcall SetForegroundWindow(void* hWnd)");
    console.log("[WindowHelper] 🛡️ Native stealth-focus APIs loaded via koffi");
  } catch (e) {
    console.warn("[WindowHelper] ⚠️ Could not load stealth APIs, focus stealth unavailable:", e);
  }
}

const isDev = !app.isPackaged || process.env.NODE_ENV === "development"
const startUrl = isDev 
  ? "http://localhost:5180" 
  : pathToFileURL(path.join(app.getAppPath(), "dist/index.html")).toString()

console.log(`[WindowHelper] 🚀 Environment: ${isDev ? "Development" : "Production"}`);
console.log(`[WindowHelper] 📍 Start URL: ${startUrl}`);

// Icon path should work in both dev and prod
const iconPath = isDev 
  ? path.join(__dirname, "../assets/Moubely_icon.png")
  : path.join(process.resourcesPath, "assets/Moubely_icon.png")

console.log(`[WindowHelper] 🖼️ Icon Path: ${iconPath}`);

export class WindowHelper {
  private mainWindow: BrowserWindow | null = null
  private appState: AppState
  private lastForegroundHwnd: any = null; // Track the last non-Moubely foreground window

  constructor(appState: AppState) {
    this.appState = appState
    // Pre-load stealth APIs at construction
    if (process.platform === "win32") loadStealthApis();
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

    console.log("[WindowHelper] 🏗️ Creating Main Window...");
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
      icon: iconPath,
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

    // Taskbar visibility will be managed by Stealth Mode
    this.mainWindow.setSkipTaskbar(isStealth)
    this.mainWindow.loadURL(startUrl).catch((err) => {
      console.error(`[WindowHelper] ❌ Failed to load URL: ${err}`);
    })

    this.mainWindow.once('ready-to-show', () => {
      console.log("[WindowHelper] ✨ Window Ready to Show");
      setTimeout(() => {
        this.centerAndShowWindow()
      }, 100);
    })

    this.mainWindow.on("closed", () => { 
      console.log("[WindowHelper] 🔴 Window Closed");
      this.mainWindow = null 
    })
  }

  // --- STEALTH LOGIC (Content Protection + Focus Stealth) ---
  public setStealthMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // enabled = true  -> Protected (Hidden from recording)
    // enabled = false -> Unprotected (Visible in recording)
    this.mainWindow.setContentProtection(enabled)
    this.mainWindow.setSkipTaskbar(enabled)

    if (process.platform === "darwin") {
      this.mainWindow.setHiddenInMissionControl(enabled)
    }

    // ── Windows Focus Stealth Hardening ──────────────────────────────
    // 1. Electron-level: Tell Electron this window CANNOT be focused.
    // This is the most reliable way to prevent Chrome from losing focus on click.
    if (typeof (this.mainWindow as any).setFocusable === "function") {
      this.mainWindow.setFocusable(!enabled);
    }

    // 2. Windows Native-level: WS_EX_NOACTIVATE + WS_EX_TOOLWINDOW
    if (process.platform === "win32" && GetWindowLongPtrW && SetWindowLongPtrW) {
      try {
        const hwnd = this.mainWindow.getNativeWindowHandle();
        const currentStyle = Number(GetWindowLongPtrW(hwnd, GWL_EXSTYLE));

        let newStyle: number;
        if (enabled) {
          if (GetForegroundWindow) {
            this.lastForegroundHwnd = GetForegroundWindow();
          }
          // NOACTIVATE: Prevent activation on click.
          // TOOLWINDOW: Hide from Alt+Tab and Taskbar.
          newStyle = (currentStyle | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
          console.log(`[WindowHelper] 🛡️ Focus Stealth: ARMED (Non-Focusable)`);
        } else {
          newStyle = (currentStyle & ~WS_EX_NOACTIVATE & ~WS_EX_TOOLWINDOW) | WS_EX_APPWINDOW;
          console.log(`[WindowHelper] 🛡️ Focus Stealth: DISARMED`);
        }

        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, BigInt(newStyle));

        if (SetWindowPos) {
          SetWindowPos(
            hwnd, null,
            0, 0, 0, 0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
          );
        }

        // 3. Immediate Focus Recovery: If Chrome blinked, force it back NOW.
        if (enabled && this.lastForegroundHwnd && SetForegroundWindow) {
          // Double-tap focus restoration to handle Windows focus-stealing races
          SetForegroundWindow(this.lastForegroundHwnd);
          setTimeout(() => {
            try { SetForegroundWindow(this.lastForegroundHwnd); } catch {}
          }, 10);
          setTimeout(() => {
            try { SetForegroundWindow(this.lastForegroundHwnd); } catch {}
          }, 100);
        }
      } catch (e) {
        console.warn("[WindowHelper] ⚠️ Native focus stealth failed:", e);
      }
    }
    
    // Ensure the window always remains on top, even if focusable state change drops it.
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  // --- PRIVATE MODE LOGIC (Click Pass-through) ---
  public setPrivateMode(enabled: boolean): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    // Ensure mouse events state is synced
    // { forward: true } allows the window to still "see" the mouse even if clicks pass through
    this.mainWindow.setIgnoreMouseEvents(enabled, { forward: true })
  }

  public getMainWindow() { return this.mainWindow }
  public getStartUrl() { return startUrl }
  public isVisible() { return this.mainWindow?.isVisible() ?? false }
  public hideMainWindow() { this.mainWindow?.hide() }
  public showMainWindow() {
    // In stealth mode, track what's focused before showing, then restore focus
    if (this.appState.getIsStealthMode() && process.platform === "win32" && GetForegroundWindow) {
      try { this.lastForegroundHwnd = GetForegroundWindow(); } catch {}
    }
    this.mainWindow?.showInactive()
    this.mainWindow?.setAlwaysOnTop(true, 'screen-saver')
    // Restore focus aggressively
    if (this.appState.getIsStealthMode() && this.lastForegroundHwnd && SetForegroundWindow) {
      try { SetForegroundWindow(this.lastForegroundHwnd); } catch {}
      setTimeout(() => {
        try { SetForegroundWindow(this.lastForegroundHwnd); } catch {}
      }, 50);
    }
  }
  public toggleMainWindow() { if (this.isVisible()) this.hideMainWindow(); else this.showMainWindow(); }

  public centerAndShowWindow() {
    if (!this.mainWindow) return;

    console.log("[WindowHelper] 🔭 Centering and Showing Window...");

    // In stealth mode, save foreground window before we show
    const isStealth = this.appState.getIsStealthMode();
    if (isStealth && process.platform === "win32" && GetForegroundWindow) {
      try { this.lastForegroundHwnd = GetForegroundWindow(); } catch {}
    }

    // Position at Top-Center
    const { width: screenWidth, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea;
    const [currentWidth] = this.mainWindow.getSize();
    this.mainWindow.setPosition(
      screenX + Math.round((screenWidth - currentWidth) / 2),
      screenY
    );

    if (isStealth) {
      // Show without taking focus — background app stays active
      this.mainWindow.showInactive();
    } else {
      this.mainWindow.show();
      this.mainWindow.focus();
    }

    // Re-assert dominance (always-on-top Z-order)
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');

    // In stealth, restore focus to the background app
    if (isStealth && this.lastForegroundHwnd && SetForegroundWindow) {
      setTimeout(() => {
        try { SetForegroundWindow(this.lastForegroundHwnd); } catch {}
      }, 50);
    }
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