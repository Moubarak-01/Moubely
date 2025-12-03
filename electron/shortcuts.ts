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

    // Take Screenshot (Ctrl+H)
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow) {
        try {
          const screenshotPath = await this.appState.takeScreenshot()
          const preview = await this.appState.getImagePreview(screenshotPath)
          mainWindow.webContents.send("screenshot-taken", {
            path: screenshotPath,
            preview
          })
          // Force window show if hidden
          this.appState.centerAndShowWindow()
        } catch (error) {
          console.error("Error capturing screenshot:", error)
        }
      }
    })

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