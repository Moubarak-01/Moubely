import { AppState } from "./main"
import { LLMHelper } from "./LLMHelper"
import dotenv from "dotenv"

dotenv.config()

export class ProcessingHelper {
  private appState: AppState
  private llmHelper: LLMHelper
  private currentProcessingAbortController: AbortController | null = null
  private currentExtraProcessingAbortController: AbortController | null = null

  constructor(appState: AppState) {
    this.appState = appState
    const useOllama = process.env.USE_OLLAMA === "true"
    if (useOllama) {
      this.llmHelper = new LLMHelper(undefined, true, process.env.OLLAMA_MODEL, process.env.OLLAMA_URL)
    } else {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error("GEMINI_API_KEY missing")
      this.llmHelper = new LLMHelper(apiKey, false)
    }
  }

  public async processScreenshots(): Promise<void> {
    const mainWindow = this.appState.getMainWindow()
    if (!mainWindow) return
    const view = this.appState.getView()

    if (view === "queue") {
      const screenshotQueue = this.appState.getScreenshotHelper().getScreenshotQueue()
      if (screenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      const lastPath = screenshotQueue[screenshotQueue.length - 1];
      
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_START)
      this.appState.setView("solutions")
      this.currentProcessingAbortController = new AbortController()
      
      try {
        if (lastPath.endsWith('.mp3') || lastPath.endsWith('.wav')) {
             const audioResult = await this.llmHelper.analyzeAudioFile(lastPath);
             const problem = { problem_statement: audioResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] };
             mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problem);
             this.appState.setProblemInfo(problem);
        } else {
             const imageResult = await this.llmHelper.analyzeImageFile(lastPath);
             const problem = { problem_statement: imageResult.text, input_format: {}, output_format: {}, constraints: [], test_cases: [] };
             mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.PROBLEM_EXTRACTED, problem);
             this.appState.setProblemInfo(problem);
        }
      } catch (error: any) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.INITIAL_SOLUTION_ERROR, error.message)
      } finally {
        this.currentProcessingAbortController = null
      }
    } else {
      const extraScreenshotQueue = this.appState.getScreenshotHelper().getExtraScreenshotQueue()
      if (extraScreenshotQueue.length === 0) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.NO_SCREENSHOTS)
        return
      }
      mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_START)
      this.currentExtraProcessingAbortController = new AbortController()

      try {
        const problemInfo = this.appState.getProblemInfo()
        if (!problemInfo) throw new Error("No problem info")

        // 👇 FIX: Cast to 'any' to fix the TS2339 build error
        const currentSolution = await this.llmHelper.generateSolution(problemInfo) as any
        const currentCode = currentSolution?.solution?.code || "No code"

        const debugResult = await this.llmHelper.debugSolutionWithImages(problemInfo, currentCode, extraScreenshotQueue)
        this.appState.setHasDebugged(true)
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_SUCCESS, debugResult)
      } catch (error: any) {
        mainWindow.webContents.send(this.appState.PROCESSING_EVENTS.DEBUG_ERROR, error.message)
      } finally {
        this.currentExtraProcessingAbortController = null
      }
    }
  }

  public cancelOngoingRequests() {
    if (this.currentProcessingAbortController) this.currentProcessingAbortController.abort()
    if (this.currentExtraProcessingAbortController) this.currentExtraProcessingAbortController.abort()
    this.appState.setHasDebugged(false)
  }
  public async processAudioBase64(data: string, mimeType: string) { return this.llmHelper.analyzeAudioFromBase64(data, mimeType); }
  public async processAudioFile(filePath: string) { return this.llmHelper.analyzeAudioFile(filePath); }
  public getLLMHelper() { return this.llmHelper; }
}