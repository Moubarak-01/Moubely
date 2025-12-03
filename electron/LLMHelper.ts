import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private model: GenerativeModel | null = null
  private readonly systemPrompt = `You are a dedicated Speech-to-Text engine.`
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama
    
    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "gemma:latest"
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
    } else if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey)
      this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
      console.log("[LLMHelper] Using Google Gemini")
    } else {
      throw new Error("Either provide Gemini API key or enable Ollama mode")
    }
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    text = text.trim();
    return text;
  }

  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.7, top_p: 0.9 }
        }),
      })
      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) {
      console.error("[LLMHelper] Error calling Ollama:", error)
      throw new Error(`Failed to connect to Ollama: ${error.message}`)
    }
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`)
      return response.ok
    } catch { return false }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) return
      if (!availableModels.includes(this.ollamaModel)) {
        this.ollamaModel = availableModels[0]
      }
      await this.callOllama("Hello")
    } catch (error: any) {
      console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`)
    }
  }

  // --- AUDIO TRANSCRIPTION ---
  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    // FIX: VALIDATE DATA BEFORE API CALL
    if (!data || data.length < 100) {
        // Too small to be valid audio, skip API call to prevent 400
        return { text: "", timestamp: Date.now() };
    }

    try {
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };

      const prompt = `
Task: Transcribe the speech in this audio segment verbatim.
Requirements:
1. Return ONLY the spoken words.
2. Do NOT add labels like "Speaker" or timestamps (these are added by the system).
3. Do NOT describe the audio (e.g., do not say "The audio contains silence").
4. If there is no distinct speech, return nothing (empty string).
5. If the audio is unclear but speech-like, write [unclear].
`;

      let text = "";
      if (this.useOllama) {
          text = ""; 
      } else {
          const result = await this.model!.generateContent([prompt, audioPart]);
          const response = await result.response;
          text = response.text().trim();
      }
      
      return { text, timestamp: Date.now() };

    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      // Suppress error to keep loop alive in frontend
      return { text: "", timestamp: Date.now() };
    }
  }

  public async analyzeAudioFile(audioPath: string) {
      try {
        const audioData = await fs.promises.readFile(audioPath);
        const audioPart = {
            inlineData: { data: audioData.toString("base64"), mimeType: "audio/mp3" }
        };
        const prompt = `Transcribe the speech in this audio file verbatim. Return ONLY text.`;
        const result = await this.model!.generateContent([prompt, audioPart]);
        return { text: await result.response.text(), timestamp: Date.now() };
      } catch (e) { throw e; }
  }

  public async analyzeImageFile(imagePath: string) {
      try {
        const imageData = await fs.promises.readFile(imagePath);
        const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } };
        const prompt = `Describe this image concisely.`;
        const result = await this.model!.generateContent([prompt, imagePart]);
        return { text: await result.response.text(), timestamp: Date.now() };
      } catch (e) { throw e; }
  }

  public async chatWithGemini(message: string): Promise<string> {
      if (this.useOllama) return this.callOllama(message);
      if (this.model) return (await this.model.generateContent(message)).response.text();
      throw new Error("No LLM provider configured");
  }

  public async chatWithImage(message: string, imagePath: string) {
      const imageData = await fs.promises.readFile(imagePath);
      const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } };
      const prompt = `User Question: "${message}"\nAnswer based on the image.`;
      return (await this.model!.generateContent([prompt, imagePart])).response.text();
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model!.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

    console.log("[LLMHelper] Calling Gemini LLM for solution...");
    try {
      const result = await this.model!.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.");
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model!.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return this.useOllama ? "ollama" : "gemini"; }
  public getCurrentModel() { return this.useOllama ? this.ollamaModel : "gemini-2.0-flash"; }
  public async getOllamaModels() { if (!this.useOllama) return []; try { const r = await fetch(`${this.ollamaUrl}/api/tags`); const d = await r.json(); return d.models?.map((m: any) => m.name) || []; } catch { return [] } } 
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; if(url) this.ollamaUrl=url; if(model) this.ollamaModel=model; else await this.initializeOllamaModel(); }
  public async switchToGemini(apiKey?: string) { if(apiKey) { const g = new GoogleGenerativeAI(apiKey); this.model = g.getGenerativeModel({ model: "gemini-2.0-flash" }); } this.useOllama = false; }
  public async testConnection() { try { if(this.useOllama) { await this.checkOllamaAvailable(); return {success:true}; } else { if(!this.model) return {success:false, error:"No model"}; await this.model.generateContent("Hi"); return {success:true}; } } catch(e:any) { return {success:false, error:e.message}; } }
}