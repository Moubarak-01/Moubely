import path from "node:path"
import fs from "node:fs"
import { app } from "electron"
import { v4 as uuidv4 } from "uuid"
import screenshot from "screenshot-desktop"
import sharp from "sharp"

export class ScreenshotHelper {
  private screenshotQueue: string[] = [] 
  private extraScreenshotQueue: string[] = [] 
  private readonly MAX_MAIN_SCREENSHOTS = 6 
  private readonly MAX_EXTRA_SCREENSHOTS = 2 

  private readonly screenshotDir: string
  private readonly extraScreenshotDir: string

  private view: "queue" | "solutions" = "queue"
  
  // NEW: We store the tiny thumbnail of the last screen, not the full file
  private lastThumbnailBuffer: Buffer | null = null

  constructor(view: "queue" | "solutions" = "queue") {
    this.view = view

    // Initialize directories
    this.screenshotDir = path.join(app.getPath("userData"), "screenshots")
    this.extraScreenshotDir = path.join(
      app.getPath("userData"),
      "extra_screenshots"
    )

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
  
  public addPathToMainQueue(screenshotPath: string): void {
      this.screenshotQueue.push(screenshotPath)
      if (this.screenshotQueue.length > this.MAX_MAIN_SCREENSHOTS) {
          const removedPath = this.screenshotQueue.shift()
          if (removedPath) {
              try { fs.promises.unlink(removedPath) } catch (e) {}
          }
      }
      console.log(`[ScreenshotHelper] Added to Main Queue. Count: ${this.screenshotQueue.length}/${this.MAX_MAIN_SCREENSHOTS}`)
  }

  public addPathToExtraQueue(screenshotPath: string): void {
      this.extraScreenshotQueue.push(screenshotPath)
      if (this.extraScreenshotQueue.length > this.MAX_EXTRA_SCREENSHOTS) {
          const removedPath = this.extraScreenshotQueue.shift()
          if (removedPath) {
              try { fs.promises.unlink(removedPath) } catch (e) {}
          }
      }
      console.log(`[ScreenshotHelper] Added to Extra Queue. Count: ${this.extraScreenshotQueue.length}/${this.MAX_EXTRA_SCREENSHOTS}`)
  }
  
  public clearQueues(): void {
    console.log("[ScreenshotHelper] Clearing all queues.")
    this.lastThumbnailBuffer = null; // Reset memory

    this.screenshotQueue.forEach((p) => { try { fs.unlinkSync(p) } catch(e){} })
    this.screenshotQueue = []

    this.extraScreenshotQueue.forEach((p) => { try { fs.unlinkSync(p) } catch(e){} })
    this.extraScreenshotQueue = []
  }

  public async captureAndSaveScreenshot(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string> {
    try {
      hideMainWindow()
      // Wait for window fade-out
      await new Promise(resolve => setTimeout(resolve, 400))
      
      const targetDir = this.view === "queue" ? this.screenshotDir : this.extraScreenshotDir;
      const screenshotPath = path.join(targetDir, `${uuidv4()}.png`)
      
      await screenshot({ filename: screenshotPath })
      return screenshotPath
    } catch (error: any) {
      console.error("[ScreenshotHelper] ❌ Error taking screenshot:", error)
      throw new Error(`Failed to take screenshot: ${error.message}`)
    } finally {
      showMainWindow()
    }
  }

  // --- NEW: The "Thumbnail Test" ---
  public async captureAndCheckDiff(
    hideMainWindow: () => void,
    showMainWindow: () => void
  ): Promise<string | null> {
    
    // 1. Capture
    const currentPath = await this.captureAndSaveScreenshot(hideMainWindow, showMainWindow);

    try {
      // 2. Shrink to 32px wide (The "Squint Test")
      // This blurs out tiny details like clocks and blinking cursors.
      const currentThumbnail = await sharp(currentPath)
        .resize(32) 
        .removeAlpha() // Ignore transparency
        .raw()         // Get raw pixel data
        .toBuffer();

      // 3. Compare with the last thumbnail we saw
      if (this.lastThumbnailBuffer && currentThumbnail.equals(this.lastThumbnailBuffer)) {
        console.log(`[LiveLoop] 💤 Screen matches thumbnail. Skipping.`);
        
        // It's a duplicate, so delete the file we just made
        try { fs.unlinkSync(currentPath); } catch (e) {}
        
        return null; // Return null so the main loop knows to stop
      }

      // 4. It's different! Update memory and return the file
      this.lastThumbnailBuffer = currentThumbnail;
      return currentPath;

    } catch (error) {
      console.error("[ScreenshotHelper] Diff check failed, defaulting to 'changed':", error);
      // If logic fails, just assume it's new to be safe
      return currentPath;
    }
  }
  
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

  public async deleteScreenshot(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      await fs.promises.unlink(filePath)
      this.screenshotQueue = this.screenshotQueue.filter((path) => path !== filePath)
      this.extraScreenshotQueue = this.extraScreenshotQueue.filter((path) => path !== filePath)
      console.log(`[ScreenshotHelper] Deleted screenshot: ${path.basename(filePath)}`);
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}