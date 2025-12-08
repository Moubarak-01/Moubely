import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
import { app } from "electron"

// --- MODEL CONFIGURATION ---
const CHAT_MODELS = [
    { type: 'deepseek', model: 'deepseek-chat', name: 'DeepSeek V3 (Primary)' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub Fallback)' },
    { type: 'gemini', model: 'gemini-1.5-flash-8b', name: 'Gemini Flash 8B (Free Tier Fallback)' }
];

const VISION_MODELS = [
    { type: 'openai', model: 'gpt-5-vision', name: 'GPT-5 Vision (Primary)' }, 
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub Vision)' },
    { type: 'gemini', model: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Vision Fallback)' }
];

const AUDIO_MODELS = [
    { type: 'groq', model: 'whisper-large-v3-turbo', name: 'Groq Whisper (Primary)' },
    { type: 'gemini', model: 'gemini-1.5-flash', name: 'Gemini Flash (Audio Fallback)' }
];

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private deepseekClient: OpenAI | null = null
  private githubClient: OpenAI | null = null
  private groqClient: OpenAI | null = null
  private openaiClient: OpenAI | null = null 

  // State
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"
  private readonly systemPrompt = `You are a helpful AI assistant named Moubely.`

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama;

    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434";
      this.ollamaModel = ollamaModel || "gemma:latest";
      console.log(`[LLMHelper] Mode: Ollama (${this.ollamaModel})`);
      this.initializeOllamaModel();
    } else {
      this.initializeProviders(apiKey);
    }
  }

  private initializeProviders(geminiKey?: string) {
      // 1. DeepSeek (Primary Chat)
      // Note: If you don't have a specific DeepSeek key, you can use your GitHub token if GitHub models supports 'DeepSeek-V3' directly, 
      // but usually DeepSeek requires its own client or an OpenAI-compatible endpoint.
      if (process.env.DEEPSEEK_API_KEY) {
          this.deepseekClient = new OpenAI({
              baseURL: "https://api.deepseek.com", 
              apiKey: process.env.DEEPSEEK_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] DeepSeek Client Initialized");
      }

      // 2. Groq (Primary Audio)
      if (process.env.GROQ_API_KEY) {
          this.groqClient = new OpenAI({
              baseURL: "https://api.groq.com/openai/v1",
              apiKey: process.env.GROQ_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] Groq Client Initialized");
      }

      // 3. GitHub Models (Chat Fallback)
      if (process.env.GITHUB_TOKEN) {
          this.githubClient = new OpenAI({
              baseURL: "https://models.inference.ai.azure.com",
              apiKey: process.env.GITHUB_TOKEN,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] GitHub Client Initialized");
      }

      // 4. Standard OpenAI (Primary Vision)
      if (process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN) {
          this.openaiClient = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY || process.env.GITHUB_TOKEN,
              dangerouslyAllowBrowser: true
          });
      }

      // 5. Gemini (Universal Fallback)
      if (geminiKey) {
          this.genAI = new GoogleGenerativeAI(geminiKey);
          console.log("[LLMHelper] Gemini Initialized (Universal Fallback)");
      }
  }

  // ==========================================
  //  1. CHAT HANDLING
  // ==========================================
  public async chatWithGemini(message: string, history: any[] = [], mode: string = "General"): Promise<string> {
      if (this.useOllama) return this.callOllama(message);

      const systemInstruction = this.getSystemInstruction(mode);
      const messages = [
          { role: "system", content: systemInstruction },
          ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
          { role: "user", content: message }
      ];

      for (const config of CHAT_MODELS) {
          try {
              let responseText = "";

              if (config.type === 'deepseek' && this.deepseekClient) {
                  const completion = await this.deepseekClient.chat.completions.create({
                      messages: messages as any,
                      model: config.model,
                      temperature: 0.7
                  });
                  responseText = completion.choices[0].message.content || "";
              }
              else if (config.type === 'github' && this.githubClient) {
                  const completion = await this.githubClient.chat.completions.create({
                      messages: messages as any,
                      model: config.model,
                      temperature: 0.7
                  });
                  responseText = completion.choices[0].message.content || "";
              }
              else if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({
                      history: history.map(h => ({
                          role: h.role === 'ai' ? 'model' : 'user',
                          parts: [{ text: h.text }]
                      }))
                  });
                  const result = await chat.sendMessage(systemInstruction + "\n\n" + message);
                  responseText = result.response.text();
              }

              if (responseText) return responseText;

          } catch (error: any) {
              console.warn(`[LLMHelper] ${config.name} failed. Trying next...`);
              continue;
          }
      }
      return "⚠️ All AI providers failed. Check your API keys.";
  }

  // ==========================================
  //  2. VISION HANDLING
  // ==========================================
  // This method MUST return a string to satisfy internal calls
  public async chatWithImage(message: string, imagePath: string): Promise<string> {
      let base64Image = "";
      try {
          const imageData = await fs.promises.readFile(imagePath);
          base64Image = imageData.toString("base64");
      } catch (e) {
          return "Error reading image file.";
      }

      for (const config of VISION_MODELS) {
          try {
              if ((config.type === 'openai' && this.openaiClient) || (config.type === 'github' && this.githubClient)) {
                  const client = config.type === 'github' ? this.githubClient : this.openaiClient;
                  if (!client) continue;

                  const response = await client.chat.completions.create({
                      model: config.model,
                      messages: [
                          {
                              role: "user",
                              content: [
                                  { type: "text", text: message },
                                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                              ]
                          }
                      ] as any
                  });
                  return response.choices[0].message.content || "";
              }
              else if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const imagePart = { inlineData: { data: base64Image, mimeType: "image/png" } };
                  const result = await geminiModel.generateContent([message, imagePart]);
                  return result.response.text();
              }
          } catch (error: any) {
              console.warn(`[LLMHelper] Vision ${config.name} failed. Trying next...`);
              continue;
          }
      }
      return "⚠️ Image analysis failed on all providers.";
  }

  // FIX FOR ERROR 2: analyzeImageFile must return object { text, timestamp }
  public async analyzeImageFile(imagePath: string) {
      const text = await this.chatWithImage("Describe this image concisely.", imagePath);
      return { text, timestamp: Date.now() };
  }

  // ==========================================
  //  3. AUDIO HANDLING
  // ==========================================
  public async analyzeAudioFromBase64(data: string, mimeType: string) {
      if (!data || data.length < 100) return { text: "", timestamp: Date.now() };

      for (const config of AUDIO_MODELS) {
          try {
              if (config.type === 'groq' && this.groqClient) {
                  const buffer = Buffer.from(data, 'base64');
                  const file = await OpenAI.toFile(buffer, 'audio.webm', { type: 'audio/webm' });
                  
                  const transcription = await this.groqClient.audio.transcriptions.create({
                      file: file,
                      model: config.model,
                      response_format: "json",
                      temperature: 0.0
                  });
                  return { text: transcription.text.trim(), timestamp: Date.now() };
              }
              else if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const audioPart = { inlineData: { data, mimeType } };
                  const result = await geminiModel.generateContent(["Transcribe verbatim:", audioPart]);
                  return { text: result.response.text().trim(), timestamp: Date.now() };
              }
          } catch (error: any) {
              console.warn(`[LLMHelper] Audio ${config.name} failed. Switching...`);
              continue;
          }
      }
      return { text: "", timestamp: Date.now() };
  }

  // ==========================================
  //  4. UTILITIES & MISSING METHODS (Fixes Errors 1, 3, 4)
  // ==========================================

  // FIX FOR ERROR 3: generateSolution
  public async generateSolution(problemInfo: any) {
      const prompt = `Solve this problem:\n${JSON.stringify(problemInfo)}`;
      const solutionText = await this.chatWithGemini(prompt, [], "Developer");
      try {
          const cleaned = solutionText.replace(/^```json/, '').replace(/```$/, '');
          return JSON.parse(cleaned);
      } catch {
          return { solution: { code: solutionText, explanation: "Generated by AI" } };
      }
  }

  // FIX FOR ERROR 4: debugSolutionWithImages
  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      const prompt = `
      I am debugging a solution. 
      Original Problem: ${JSON.stringify(problemInfo)}
      Current Code: ${currentCode}
      
      Please look at the attached screenshot (the error or output) and fix the code.
      Return JSON: { "solution": { "code": "fixed code", "explanation": "what was fixed" } }
      `;

      if (debugImagePaths.length > 0) {
          const responseText = await this.chatWithImage(prompt, debugImagePaths[0]);
          try {
              const cleaned = responseText.replace(/^```json/, '').replace(/```$/, '');
              return JSON.parse(cleaned);
          } catch {
              return { solution: { code: currentCode, explanation: "Could not parse fix: " + responseText } };
          }
      }
      throw new Error("No debug images provided.");
  }

  // FIX FOR ERROR 1: testConnection
  public async testConnection() { 
      try {
          if (this.useOllama) { await this.callOllama("hi"); }
          else { await this.chatWithGemini("hi"); }
          return { success: true };
      } catch (e: any) { return { success: false, error: e.message }; }
  }

  public async extractProblemFromImages(imagePaths: string[]) {
      if (!this.genAI) throw new Error("Gemini required for multi-image extraction");
      const imageParts = await Promise.all(imagePaths.map(async (p) => {
          const d = await fs.promises.readFile(p);
          return { inlineData: { data: d.toString('base64'), mimeType: "image/png" } };
      }));
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(["Extract problem as JSON:", ...imageParts]);
      const text = result.response.text().replace(/^```json/, '').replace(/```$/, '');
      return JSON.parse(text);
  }

  public async analyzeAudioFile(audioPath: string) {
      const buffer = await fs.promises.readFile(audioPath);
      return this.analyzeAudioFromBase64(buffer.toString('base64'), 'audio/mp3');
  }

  private getSystemInstruction(mode: string): string {
      const studentFiles = (mode === "Student") ? this.getStudentFiles() : "";
      let prompt = this.systemPrompt;
      if (mode === "Student") {
          prompt += `\n\nCONTEXT: Mentor mode. Use these files if relevant:\n${studentFiles}\n\nDo not give code directly. Guide the user.`;
      } else {
          prompt += `\n\nCONTEXT: Expert Developer mode. Provide concise, correct code solutions.`;
      }
      return prompt;
  }

  private getStudentFiles(): string {
    const dir = path.join(app.getPath("userData"), "student_profile");
    if (!fs.existsSync(dir)) return "";
    try {
        const files = fs.readdirSync(dir).filter(name => name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".ts"));
        return files.map(f => `File: ${f}\n${fs.readFileSync(path.join(dir, f), "utf8")}`).join("\n\n");
    } catch { return ""; }
  }

  // Ollama Implementation
  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.ollamaModel, prompt, stream: false }),
      })
      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) { throw new Error(`Ollama failed: ${error.message}`) }
  }
  private async initializeOllamaModel(): Promise<void> {}
  public async getOllamaModels() { return []; } 
  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return this.useOllama ? "ollama" : "multi-provider"; }
  public getCurrentModel() { return "auto-routing"; }
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); this.useOllama = false; }
}