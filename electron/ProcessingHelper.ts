import { AppState } from "./main"
import { LLMHelper } from "./LLMHelper"
import path from "node:path"
import { app } from "electron"

const isDev = !app.isPackaged || process.env.NODE_ENV === "development"

if (isDev) {
  const envPath = path.join(__dirname, "../.env")
  require("dotenv").config({ path: envPath })
}

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(appState: AppState) {
    this.appState = appState
    const useOllama = process.env.USE_OLLAMA === "true"
    if (useOllama) {
      console.log("[Processing] 🔧 Initializing with Ollama");
      this.llmHelper = new LLMHelper(undefined, true, process.env.OLLAMA_MODEL, process.env.OLLAMA_URL)
    } else {
      console.log("[Processing] ☁️ Initializing with Cloud APIs");
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) {
        console.log("[Processing] ℹ️ No GEMINI_API_KEY found in environment. Waiting for user input in settings.");
      }
      this.llmHelper = new LLMHelper(apiKey, false)
    }  }

  public async processScreenshots(): Promise<void> {
    console.log("[Processing] 🚀 Processing Screenshots triggered");
    
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return
    const view = this.appState.getView()

    if (view === "queue") {
      // FIX: Use the new getter method
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        console.log("[Processing] ⚠️ Screenshot queue is empty");
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      const lastPath = screenshotQueue[screenshotQueue.length - 1];
      
      console.log(`[Processing] 🔍 Analyzing last screenshot: ${lastPath}`);
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")
      this.currentProcessingAbortController = new AbortController()
      
      try {
        if (lastPath.endsWith('.mp3') || lastPath.endsWith('.wav')) {
             console.log("[Processing] 🎙️ Detected Audio File - Starting Transcription");
             const audioResult = await this.llmHelper.analyzeAudioFile(lastPath);
             const problem = { problem_statement: audioResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] };
             console.log("[Processing] ✅ Audio Processed Successfully");
             
             mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problem);
             this.appState.setProblemInfo(problem);
        } else {
             console.log("[Processing] 🖼️ Detected Image File - Starting Visual Analysis");
             const imageResult = await this.llmHelper.analyzeImageFile(lastPath);
             const problem = { problem_statement: imageResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] };
             console.log("[Processing] ✅ Image Processed Successfully");
             
             mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problem);
             this.appState.setProblemInfo(problem);
        }
      } catch (error: any) {
        console.error(`[Processing] ❌ Error processing file: ${error.message}`);
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      // --- DEBUGGING / EXTRA SCREENSHOTS MODE ---
      // FIX: Use the new getter method
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        console.log("[Processing] ⚠️ Extra screenshot queue is empty");
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      
      console.log(`[Processing] 🐞 Starting Debug Flow with ${extraScreenshotQueue.length} new screenshots`);
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        const problemInfo = this.appState.getProblemInfo()
        if (!problemInfo) throw new Error("No problem info available for debugging")

        console.log("[Processing] 🧠 Generating current solution context...");
        // 👇 FIX: Cast to 'any' to fix TS build error
        const currentSolution = await this.llmHelper.generateSolution(problemInfo) as any
        const currentCode = currentSolution?.solution?.code || "No code"

        console.log("[Processing] 🕵️ analyzing new screenshots against current code...");
        const debugResult = await this.llmHelper.debugSolutionWithImages(problemInfo, currentCode, extraScreenshotQueue)
        
        console.log("[Processing] ✅ Debugging/Refinement Successful");
        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS, debugResult)
      } catch (error: any) {
        console.error(`[Processing] ❌ Debugging Failed: ${error.message}`);
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_ERROR, error.message)
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests() {
    console.log("[Processing] 🛑 Cancelling ongoing requests");
    if (this.currentProcessingAbortController) this.currentProcessingAbortController.abort()
    if (this.currentExtraProcessingAbortController) this.currentExtraProcessingAbortController.abort()
    this.appState.setHasDebugged(false)
  }
  
  public async processAudioBase64(data: string, mimeType: string) { 
      // console.log("[Processing] 🎙️ Processing Audio Chunk..."); // Optional log
      return this.llmHelper.analyzeAudioFromBase64(data, mimeType); 
  }
  
  public async processAudioFile(filePath: string) { 
      console.log(`[Processing] 📁 Process Audio File: ${filePath}`);
      return this.llmHelper.analyzeAudioFile(filePath); 
  }
  
  public getLLMHelper() { return this.llmHelper; }
}