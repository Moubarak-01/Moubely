import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import OpenAI from "openai"
import fs from "fs"
import path from "path"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"

// --- CONFIGURATION ---
// Priority chains. Note: 'type: github' uses the GitHub Token.
const CHAT_MODELS = [
    { type: 'github', model: 'DeepSeek-V3', name: 'DeepSeek V3 (GitHub)' }, // Primary
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub)' },          // Fallback 1
    { type: 'gemini', model: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' } // Fallback 2
];

const VISION_MODELS = [
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o Vision (GitHub)' },    // Primary Vision
    { type: 'gemini', model: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }     // Fallback Vision
];

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private githubClient: OpenAI | null = null
  private groqClient: OpenAI | null = null

  // State
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"
  private model: GenerativeModel | null = null // Current active Gemini model wrapper
  private readonly systemPrompt = `You are a dedicated Speech-to-Text engine.`

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
      // 1. Gemini (Final Fallback)
      if (geminiKey) {
          this.genAI = new GoogleGenerativeAI(geminiKey);
          this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          console.log("[LLMHelper] Gemini Initialized (Fallback)");
      }

      // 2. GitHub Models (Powers DeepSeek AND GPT-4o)
      if (process.env.GITHUB_TOKEN) {
          this.githubClient = new OpenAI({
              baseURL: "https://models.inference.ai.azure.com", // GitHub Models Endpoint
              apiKey: process.env.GITHUB_TOKEN
          });
          console.log("[LLMHelper] GitHub Client Initialized (DeepSeek & GPT-4o)");
      }

      // 3. Groq (Primary Audio)
      if (process.env.GROQ_API_KEY) {
          this.groqClient = new OpenAI({
              baseURL: "https://api.groq.com/openai/v1",
              apiKey: process.env.GROQ_API_KEY
          });
          console.log("[LLMHelper] Groq Client Initialized (Primary Audio)");
      }
  }

  // --- 1. CHAT HANDLER (DeepSeek -> GPT-4o -> Gemini) ---
  public async chatWithGemini(message: string, history: any[] = [], mode: string = "General"): Promise<string> {
      if (this.useOllama) return this.callOllama(message);

      const systemInstruction = this.getSystemInstruction(mode);
      
      // Convert history to OpenAI format
      const messages = [
          { role: "system", content: systemInstruction },
          ...history.map(h => ({ role: h.role, content: h.text })),
          { role: "user", content: message }
      ];

      // Try providers in order
      for (const config of CHAT_MODELS) {
          try {
              if (config.type === 'github' && this.githubClient) {
                  // This client handles BOTH DeepSeek and GPT-4o
                  // console.log(`[LLMHelper] Trying ${config.name}...`);
                  const completion = await this.githubClient.chat.completions.create({
                      messages: messages as any,
                      model: config.model, // Swaps between 'DeepSeek-V3' and 'gpt-4o'
                      temperature: 0.7
                  });
                  return completion.choices[0].message.content || "";
              }

              if (config.type === 'gemini' && this.genAI) {
                  // Gemini Fallback
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({
                      history: history.map(h => ({
                          role: h.role === 'ai' ? 'model' : 'user',
                          parts: [{ text: h.text }]
                      }))
                  });
                  const result = await chat.sendMessage(systemInstruction + "\n\nUser: " + message);
                  return result.response.text();
              }
          } catch (error: any) {
              console.warn(`[LLMHelper] ${config.name} failed: ${error.message}`);
              continue; // Try next model
          }
      }

      throw new Error("All AI Chat providers (DeepSeek, GitHub, Gemini) failed.");
  }

  // --- 2. IMAGE HANDLER (GPT-4o -> Gemini) ---
  public async chatWithImage(message: string, imagePath: string): Promise<string> {
      const imageData = await fs.promises.readFile(imagePath);
      const base64Image = imageData.toString("base64");
      
      for (const config of VISION_MODELS) {
          try {
              // 1. GitHub / OpenAI Vision
              if (config.type === 'github' && this.githubClient) {
                  const response = await this.githubClient.chat.completions.create({
                      model: config.model,
                      messages: [
                          {
                              role: "user",
                              content: [
                                  { type: "text", text: message },
                                  { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
                              ]
                          }
                      ] as any
                  });
                  return response.choices[0].message.content || "";
              }

              // 2. Gemini Vision
              if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const imagePart = { inlineData: { data: base64Image, mimeType: "image/png" } };
                  const result = await geminiModel.generateContent([message, imagePart]);
                  return result.response.text();
              }

          } catch (error: any) {
              console.warn(`[LLMHelper] ${config.name} failed for image: ${error.message}`);
              continue;
          }
      }

      throw new Error("All Vision providers failed.");
  }

  // --- 3. AUDIO HANDLER (Groq -> Gemini) ---
  public async analyzeAudioFromBase64(data: string, mimeType: string) {
      if (!data || data.length < 100) return { text: "", timestamp: Date.now() };

      // 1. Try Groq (Whisper) - FASTEST
      if (this.groqClient) {
          try {
              // Standard OpenAI SDK 'toFile' workaround for Buffers
              const buffer = Buffer.from(data, 'base64');
              const file = await OpenAI.toFile(buffer, 'audio.webm', { type: 'audio/webm' });
              
              const transcription = await this.groqClient.audio.transcriptions.create({
                  file: file,
                  model: "whisper-large-v3",
                  response_format: "json",
                  temperature: 0.0
              });

              return { text: transcription.text.trim(), timestamp: Date.now() };

          } catch (error: any) {
              console.warn(`[LLMHelper] Groq Whisper failed: ${error.message}. Switching to Gemini...`);
          }
      }

      // 2. Fallback to Gemini
      if (this.genAI) {
          try {
              const geminiModel = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" }); 
              const audioPart = { inlineData: { data, mimeType } };
              const result = await geminiModel.generateContent(["Transcribe this audio verbatim.", audioPart]);
              return { text: result.response.text().trim(), timestamp: Date.now() };
          } catch (error: any) {
              console.error("[LLMHelper] Gemini Audio fallback failed:", error);
          }
      }

      return { text: "", timestamp: Date.now() };
  }

  // --- HELPER METHODS ---

  private getSystemInstruction(mode: string): string {
      const studentFiles = (mode === "Student") ? this.getStudentFiles() : "";
      
      let prompt = `You are a helpful AI assistant named Moubely.`;
      
      if (mode === "Student") {
          prompt += `\n\nCONTEXT: You are a Mentor. Use the user's files to personalize advice:\n${studentFiles}\n\nINSTRUCTION: Ask probing questions. Do not give direct answers for code.`;
      } else if (mode === "Developer") {
          prompt += `\n\nCONTEXT: You are a Senior Engineer. Be concise, technical, and provide production-ready code.`;
      }

      return prompt;
  }

  private getStudentFiles(): string {
    const dir = path.join(app.getPath("userData"), "student_profile");
    if (!fs.existsSync(dir)) return "";
    const files = fs.readdirSync(dir).filter(name => name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".pdf") || name.endsWith(".ts"));
    let content = "";
    for (const file of files) {
        try { content += `\n\n# FILE: ${file}\n${fs.readFileSync(path.join(dir, file), "utf8")}\n`; } catch(e) {}
    }
    return content;
  }

  // --- LEGACY/UTILITY SUPPORT ---
  public async analyzeAudioFile(audioPath: string) {
      const buffer = await fs.promises.readFile(audioPath);
      return this.analyzeAudioFromBase64(buffer.toString('base64'), 'audio/mp3');
  }

  // FIX: Return an object { text, timestamp } to satisfy ProcessingHelper
  public async analyzeImageFile(imagePath: string) {
      const text = await this.chatWithImage("Describe this image concisely.", imagePath);
      return { text, timestamp: Date.now() };
  }

  public async extractProblemFromImages(imagePaths: string[]) {
      if (!this.genAI) throw new Error("Gemini required for multi-image extraction");
      
      const imageParts = await Promise.all(imagePaths.map(async (p) => {
          const d = await fs.promises.readFile(p);
          return { inlineData: { data: d.toString('base64'), mimeType: "image/png" } };
      }));

      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = "Extract the problem statement, context, and requirements from these images as a JSON object.";
      const result = await model.generateContent([prompt, ...imageParts]);
      const text = result.response.text().replace(/^```json/, '').replace(/```$/, '');
      return JSON.parse(text);
  }

  public async generateSolution(problemInfo: any) {
      const prompt = `Solve this problem:\n${JSON.stringify(problemInfo)}`;
      // Use standard chat flow so it benefits from DeepSeek
      const solutionText = await this.chatWithGemini(prompt, [], "Developer");
      
      try {
          const cleaned = solutionText.replace(/^```json/, '').replace(/```$/, '');
          return JSON.parse(cleaned);
      } catch {
          return { solution: { code: solutionText, explanation: "Generated by DeepSeek/GPT" } };
      }
  }

  // --- ADDED MISSING METHOD: debugSolutionWithImages ---
  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      const prompt = `
      I am debugging a solution. 
      Original Problem: ${JSON.stringify(problemInfo)}
      Current Code: ${currentCode}
      
      Please look at the attached screenshot (the error or output) and fix the code.
      Return JSON: { "solution": { "code": "fixed code", "explanation": "what was fixed" } }
      `;

      // We use the first debug image with the Vision Handler
      // If there are multiple, handling them with GPT-4o or Gemini is complex in this simplified structure,
      // so we prioritize the first one for now.
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

  // Ollama Support (Legacy)
  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.ollamaModel, prompt: prompt, stream: false, options: { temperature: 0.7 } }),
      })
      if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) { throw new Error(`Ollama failed: ${error.message}`) }
  }

  private async initializeOllamaModel(): Promise<void> {
     this.callOllama("hi").catch(e => console.error("Ollama check failed", e));
  }
  
  public async getOllamaModels() { if (!this.useOllama) return []; try { const r = await fetch(`${this.ollamaUrl}/api/tags`); const d = await r.json(); return d.models?.map((m: any) => m.name) || []; } catch { return [] } } 
  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return this.useOllama ? "ollama" : "hybrid-cloud"; }
  public getCurrentModel() { return "auto-switching"; }
  
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; if(url) this.ollamaUrl=url; if(model) this.ollamaModel=model; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); this.useOllama = false; }
  
  public async testConnection() { 
      try {
          if (this.useOllama) { await this.callOllama("hi"); }
          else { await this.chatWithGemini("hi"); }
          return { success: true };
      } catch (e: any) { return { success: false, error: e.message }; }
  }
}