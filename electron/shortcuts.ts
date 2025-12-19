import { globalShortcut, app } from "electron"
import { AppState } from "./main" 

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  public registerGlobalShortcuts(): void {
    // Take Screenshot (Ctrl+H)
    globalShortcut.register("CommandOrControl+H", async () => {
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-action-triggered", { action: "take-and-queue" });
      }
    })

    // Process Screenshots (Ctrl+Enter)
    globalShortcut.register("CommandOrControl+Enter", async () => {
      await this.appState.processingHelper.processScreenshots()
    })

    // Toggle Visibility (Ctrl + B)
    globalShortcut.register("CommandOrControl+B", () => {
      this.appState.toggleMainWindow()
    })

    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}