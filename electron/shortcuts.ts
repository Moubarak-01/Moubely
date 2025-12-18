import { globalShortcut, app } from "electron"
import { AppState } from "./main" 

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  public registerGlobalShortcuts(): void {
    // Show/Center window
    globalShortcut.register("CommandOrControl+Shift+Space", () => {
      this.appState.centerAndShowWindow()
    })

    // NEW: Toggle Expand/Normal (Ctrl + Space)
    globalShortcut.register("CommandOrControl+Space", () => {
      const mainWindow = this.appState.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send a signal to the frontend to toggle its size state
        mainWindow.webContents.send("toggle-expansion");
      }
    })

    // FIX: Take Screenshot (Ctrl+H)
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("[Shortcut] 📸 Take & Queue (Ctrl+H) triggered.")
        mainWindow.webContents.send("screenshot-action-triggered", { action: "take-and-queue" });
        this.appState.centerAndShowWindow() 
      }
    })

    // Process Screenshots
    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.appState.processingHelper.processScreenshots()
    })

    // Ctrl + N (New Chat)
    globalShortcut.register("CommandOrControl+N", () => {
      this.resetSession()
    })

    // Reset / Clear Everything (Ctrl + R)
    globalShortcut.register("CommandOrControl+R", () => {
      this.resetSession()
    })

    // Move Window
    globalShortcut.register("CommandOrControl+Left", () => this.appState.moveWindowLeft())
    globalShortcut.register("CommandOrControl+Right", () => this.appState.moveWindowRight())
    globalShortcut.register("CommandOrControl+Down", () => this.appState.moveWindowDown())
    globalShortcut.register("CommandOrControl+Up", () => this.appState.moveWindowUp())

    // Toggle Visibility (Ctrl + B)
    globalShortcut.register("CommandOrControl+B", () => {
      this.appState.toggleMainWindow()
    })

    // Cleanup
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }

  private resetSession(): void {
      this.appState.processingHelper.cancelOngoingRequests()
      this.appState.clearQueues()
      this.appState.setView("queue")
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
      }
  }
}