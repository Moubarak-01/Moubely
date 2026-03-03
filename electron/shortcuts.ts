import { globalShortcut, app } from "electron"
import { AppState } from "./main"

export class ShortcutsHelper {
  private appState: AppState

  constructor(appState: AppState) {
    this.appState = appState
  }

  public registerGlobalShortcuts(): void {
    console.log("[Shortcuts] 🛠️ Initializing Global Shortcuts Registration...");

    // Take Screenshot (Ctrl+H)
    globalShortcut.register("CommandOrControl+H", async () => {
      console.log("[Shortcuts] 📸 Triggered: Ctrl+H (Screenshot)");
      const mainWindow = this.appState.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("screenshot-action-triggered", { action: "take-and-queue" });
      }
    })
    console.log("[Shortcuts] Requesting registration: Ctrl+H");

    // Process Screenshots (Ctrl+Enter)
    globalShortcut.register("CommandOrControl+Enter", async () => {
      console.log("[Shortcuts] ⚙️ Triggered: Ctrl+Enter (Process)");
      await this.appState.processingHelper.processScreenshots()
    })
    console.log("[Shortcuts] Requesting registration: Ctrl+Enter");

    // Toggle Visibility (Ctrl + B)
    globalShortcut.register("CommandOrControl+B", () => {
      console.log("[Shortcuts] 👁️ Triggered: Ctrl+B (Visibility)");
      this.appState.toggleMainWindow()
    })
    console.log("[Shortcuts] Requesting registration: Ctrl+B");

    // Toggle Private Mode (Shift + A)
    globalShortcut.register("Shift+A", () => {
      console.log("[Shortcuts] 🕶️ Triggered: Shift+A (Private Mode)");
      this.appState.togglePrivateMode()
    })
    console.log("[Shortcuts] Requesting registration: Shift+A");

    app.on("will-quit", () => {
      globalShortcut.unregisterAll()
    })
  }
}