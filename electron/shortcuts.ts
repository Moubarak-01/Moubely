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

    // FIX: Take Screenshot (Ctrl+H) - NOW UNIFIED TO ALWAYS QUEUE (TAKE & QUEUE)
    // Repeated presses now queue multiple images (up to the limit of 6).
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        console.log("[Shortcut] 📸 Take & Queue (Ctrl+H) triggered.")
        // Send the queue action signal
        mainWindow.webContents.send("screenshot-action-triggered", { action: "take-and-queue" });
        this.appState.centerAndShowWindow() // Force window show
      }
    })

    // REMOVED: The old Ctrl+Shift+H shortcut is now retired/removed.

    // Process Screenshots
    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.appState.processingHelper.processScreenshots()
    })

    // NEW: Ctrl + N (New Chat)
    globalShortcut.register("CommandOrControl+N", () => {
      console.log("Command + N pressed. Starting New Chat...")
      this.resetSession()
    })

    // Reset / Clear Everything (Ctrl + R)
    globalShortcut.register("CommandOrControl+R", () => {
      console.log("Command + R pressed. Resetting...")
      this.resetSession()
    })

    // Move Window
    globalShortcut.register("CommandOrControl+Left", () => this.appState.moveWindowLeft())
    globalShortcut.register("CommandOrControl+Right", () => this.appState.moveWindowRight())
    globalShortcut.register("CommandOrControl+Down", () => this.appState.moveWindowDown())
    globalShortcut.register("CommandOrControl+Up", () => this.appState.moveWindowUp())

    // Toggle Visibility
    globalShortcut.register("CommandOrControl+B", () => {
      this.appState.toggleMainWindow()
    })

    // Cleanup
    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }

  // Helper to clear everything
  private resetSession(): void {
      // 1. Cancel any AI processing
      this.appState.processingHelper.cancelOngoingRequests()

      // 2. Clear backend queues
      this.appState.clearQueues()

      // 3. Reset view state
      this.appState.setView("queue")

      // 4. Notify Frontend to wipe chat and transcript
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("reset-view")
      }
  }
}