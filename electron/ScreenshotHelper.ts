// ScreenshotHelper.ts

import path from "node:path"
import fs from "node:fs"
import { app } from "electron"
import { v4 as uuidv4 } from "uuid"
import screenshot from "screenshot-desktop"

export class ScreenshotHelper {
  private screenshotQueue: string[] = [] // Main Queue (used for chat/multi-shot)
  private extraScreenshotQueue: string[] = [] // Debugging Queue
  private readonly MAX_MAIN_SCREENSHOTS = 6 // <-- Max 6 screenshots for conversation context
  private readonly MAX_EXTRA_SCREENSHOTS = 2 // Keeping debugging shots low

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" = "queue"

  constructor(view: "queue" | "solutions" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

    // Create directories if they don't exist
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir)
    }
    if (!fs.existsSync(this.extraScreenshotDir)) {
      fs.mkdirSync(this.extraScreenshotDir)
    }
  }

  public getView(): "queue" | "solutions" {
    return this.view
  }

  public setView(view: "queue" | "solutions"): void {
    this.view = view
  }

  public getScreenshotQueue(): string[] {
    return this.screenshotQueue
  }

  public getExtraScreenshotQueue(): string[] {
    return this.extraScreenshotQueue
  }
  
  // --- NEW: Queue Management Methods ---

  public addPathToMainQueue(screenshotPath: string): void {
      this.screenshotQueue.push(screenshotPath)
      // Enforce the 6-shot limit
      if (this.screenshotQueue.length > this.MAX_MAIN_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift()
          if (removedPath) {
              try {
                  fs.promises.unlink(removedPath)
              } catch (error) {
                  console.error("Error removing old screenshot:", error)
              }
          }
      }
      console.log(`[ScreenshotHelper] Added to Main Queue. Count: ${this.screenshotQueue.length}/${this.MAX_MAIN_SCREENSHOTS}`)
  }

  public addPathToExtraQueue(screenshotPath: string): void {
      this.extraScreenshotQueue.push(screenshotPath)
      // Enforce the extra queue limit
      if (this.extraScreenshotQueue.length > this.MAX_EXTRA_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift()
          if (removedPath) {
              try {
                  fs.promises.unlink(removedPath)
              } catch (error) {
                  console.error("Error removing old extra screenshot:", error)
              }
          }
      }
      console.log(`[ScreenshotHelper] Added to Extra Queue. Count: ${this.extraScreenshotQueue.length}/${this.MAX_EXTRA_SCREENSHOTS}`)
  }
  
  // --- END Queue Management Methods ---

  public clearQueues(): void {
    console.log("[ScreenshotHelper] Clearing all queues and deleting files.")
    // Clear screenshotQueue
    this.screenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(`Error deleting screenshot at ${screenshotPath}:`, err)
      })
    })
    this.screenshotQueue = []

    // Clear extraScreenshotQueue
    this.extraScreenshotQueue.forEach((screenshotPath) => {
      fs.unlink(screenshotPath, (err) => {
        if (err)
          console.error(
            `Error deleting extra screenshot at ${screenshotPath}:`,
            err
          )
      })
    })
    this.extraScreenshotQueue = []
  }

  // NEW: Captures the image and saves it to the appropriate directory based on `this.view`.
  // It does NOT push to any internal queue.
  public async captureAndSaveScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    try {
      hideMainWindow()
      
      // Add a small delay to ensure window is hidden
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Determine directory based on current view mode
      const targetDir = this.view === "queue" ? this.screenshotDir : this.extraScreenshotDir;
      const screenshotPath = path.join(targetDir, `${uuidv4()}.png`)
      
      await screenshot({ filename: screenshotPath })
      
      console.log(`[ScreenshotHelper] Captured: ${path.basename(screenshotPath)}`);

      return screenshotPath
    } catch (error: any) {
      console.error("[ScreenshotHelper] ❌ Error taking screenshot:", error)
      throw new Error(`Failed to take screenshot: ${error.message}`)
    } finally {
      // Ensure window is always shown again
      showMainWindow()
    }
  }
  
  // Retained for existing AppState compatibility, calls the new capture method.
  public async takeScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
      return this.captureAndSaveScreenshot(hideMainWindow, showMainWindow);
  }


  public async getImagePreview(filepath: string): Promise<string> {
    try {
      const data = await fs.promises.readFile(filepath)
      return `data:image/png;base64,${data.toString("base64")}`
    } catch (error) {
      console.error("[ScreenshotHelper] Error reading image:", error)
      throw error
    }
  }

  public async deleteScreenshot(
    filePath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(filePath)
      
      // Update: Use filter to remove from both queues, ensuring cleanup regardless of which one it was in.
      this.screenshotQueue = this.screenshotQueue.filter(
        (path) => path !== filePath
      )
      this.extraScreenshotQueue = this.extraScreenshotQueue.filter(
        (path) => path !== filePath
      )
      console.log(`[ScreenshotHelper] Deleted screenshot: ${path.basename(filePath)}`);
      return { success: true }
    } catch (error: any) {
      console.error("[ScreenshotHelper] Error deleting file:", error)
      return { success: false, error: error.message }
    }
  }
}