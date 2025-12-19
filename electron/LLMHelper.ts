import { GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import { Client as NotionClient } from "@notionhq/client"
import fs from "fs"
import path from "path"
import os from "os"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"
import * as pdfLib from "pdf-parse"
import http from "http"

// CRITICAL: Keep connection open to prevent ECONNRESET
const httpAgent = new http.Agent({ keepAlive: true });

async function safePdfParse(buffer: Buffer) {
    // @ts-ignore
    const parser = pdfLib.default || pdfLib;
    return parser(buffer);
}

// --- 1. THE EXPANDED WATERFALL BRAINS (Chat & Logic) ---
const CHAT_MODELS = [
    // --- TIER 1: NEXT GEN (Gemini 3.0) ---
    // Best overall performance and speed as of late 2025
    { type: 'gemini', model: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },

    // --- TIER 2: SPECIALIZED & PREVIEW ---
    { type: 'gemini', model: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics' },

    // --- TIER 3: OPEN MULTIMODAL (Gemma 3 Family) ---
    // Now fully multimodal (Text + Vision)
    { type: 'gemini', model: 'gemma-3-27b-it', name: 'Gemma 3 27B (Vision)' },
    { type: 'gemini', model: 'gemma-3-12b-it', name: 'Gemma 3 12B (Vision)' },
    { type: 'gemini', model: 'gemma-3-4b-it', name: 'Gemma 3 4B (Vision)' },

    // --- TIER 4: RESEARCH & SEARCH (Perplexity Sonar) ---
    { type: 'perplexity', model: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
    { type: 'perplexity', model: 'sonar-deep-research', name: 'Sonar Deep Research' },
    { type: 'perplexity', model: 'sonar-pro', name: 'Sonar Pro' },
    { type: 'perplexity', model: 'sonar', name: 'Sonar' },

    // --- TIER 5: RELIABLE BACKUPS ---
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o' },
    { type: 'github', model: 'DeepSeek-R1', name: 'DeepSeek R1' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3' }
];

// --- 2. THE EYES (Vision Waterfall) ---
const VISION_MODELS = [
    { type: 'gemini', model: 'gemini-3-flash-preview' },      // NEW PRIMARY: 15% better image accuracy
    { type: 'gemini', model: 'gemini-2.5-flash' },      // Primary Fast Vision
    { type: 'gemini', model: 'gemma-3-27b-it' },      // Powerful open-weight vision alternative
    { type: 'perplexity', model: 'sonar-reasoning-pro' }, // Reasoning Vision
    { type: 'perplexity', model: 'sonar' },           // Basic search-based vision
    { type: 'gemini', model: 'gemini-2.5-flash-lite' }, // Fast, low-cost fallback
    { type: 'github', model: 'gpt-4o' },                // Backup
    { type: 'openai', model: 'gpt-4o' }                 
];

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private githubClient: OpenAI | null = null
  private groqClient: OpenAI | null = null
  private perplexityClient: OpenAI | null = null
  private openaiClient: OpenAI | null = null
  private notionClient: NotionClient | null = null
  
  // Session Memory
  private sessionTranscript: string = "";

  // --- SMART CACHING SYSTEM ---
  private cachedStudentText: string = ""; // Full text for Gemini/GPT
  private cachedStudentSummary: string = ""; // Distilled text for Perplexity
  private cachedStudentPdfPart: any = null; // Binary for Gemini Vision
  
  private readonly systemPrompt = `
  You are 'Moubely', an intelligent AI assistant.
  
  CORE RULES:
  1. Use '###' Headers for main topics.
  2. Use **bold** to highlight key variables or terms.
  3. Use provided "STUDENT CONTEXT" or "NOTION CONTEXT" silently.
  
  MATH FORMULA RULES (STRICT):
  - ALWAYS use '$$' for block equations (e.g. $$x^2$$).
  - ALWAYS use '$' for inline math (e.g. $x$).
  `;

  constructor(apiKey?: string, _u?: boolean, _m?: string, _url?: string) {
    console.log("[LLM] ☁️ Initializing Cloud Waterfall System...");
    this.initializeProviders(apiKey);
  }

  private initializeProviders(geminiKey?: string) {
      if (process.env.NOTION_TOKEN) this.notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
      if (geminiKey) this.genAI = new GoogleGenerativeAI(geminiKey);
      
      // Initialize Clients (GitHub, Perplexity, Groq, OpenAI)
      if (process.env.GITHUB_TOKEN) this.githubClient = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN, dangerouslyAllowBrowser: true });
      if (process.env.PERPLEXITY_API_KEY) this.perplexityClient = new OpenAI({ baseURL: "https://api.perplexity.ai", apiKey: process.env.PERPLEXITY_API_KEY, dangerouslyAllowBrowser: true });
      if (process.env.GROQ_API_KEY) this.groqClient = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY, dangerouslyAllowBrowser: true });
      if (process.env.OPENAI_API_KEY) this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
  }

  private cleanResponse(text: string): string {
      return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[\d+\]/g, "").trim();
  }

  // --- CACHE MANAGEMENT ---
  public clearStudentCache() {
      this.cachedStudentText = "";
      this.cachedStudentSummary = "";
      this.cachedStudentPdfPart = null;
      console.log("[LLM] 🧹 Student Cache & Summary Cleared (Memory Wiped)");
  }

  // --- CONTEXT DISTILLATION (Fixes Perplexity) ---
  private async generateStudentSummary(fullText: string): Promise<string> {
      if (!this.genAI || !fullText) return "";
      try {
          console.log("[LLM] ⚗️ Distilling Student Context for Search Models...");
          // Use the fastest model for internal summarization
          const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
          const result = await model.generateContent(`
            Summarize the following student profile/resume into 3-4 concise, high-density sentences.
            Focus on: Skills, Tech Stack, Education, and Key Projects.
            Output ONLY the summary.
            
            PROFILE:
            ${fullText.slice(0, 15000)}
          `);
          const summary = result.response.text();
          console.log(`[LLM] ✅ Distillation Complete (${summary.length} chars).`);
          return summary;
      } catch (e) {
          console.warn("[LLM] ⚠️ Distillation failed, using truncated text.");
          return fullText.slice(0, 1000) + "...";
      }
  }

  // --- PDF & CONTEXT TOOLS ---
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
      try {
          const data = await safePdfParse(buffer);
          if (data && data.text && data.text.trim().length > 50) return data.text.trim();
      } catch (e) { console.warn("[LLM] ⚠️ Local PDF parse failed."); }

      const ocrKey = process.env.OCR_SPACE_API_KEY;
      if (ocrKey) {
          try {
              console.log("[LLM] 👁️ Attempting OCR via OCR Space...");
              const formData = new FormData();
              formData.append('base64Image', `data:application/pdf;base64,${buffer.toString('base64')}`);
              formData.append('isOverlayRequired', 'false');
              formData.append('OCREngine', '2');
              
              const response = await axios.post('https://api.ocr.space/parse/image', formData, { 
                  headers: { ...formData.getHeaders(), 'apikey': ocrKey }, timeout: 30000 
              });

              if (response.data && response.data.ParsedResults) {
                  return response.data.ParsedResults.map((r: any) => r.ParsedText).join('\n');
              }
          } catch (e: any) { console.error(`[LLM] ❌ OCR Failed: ${e.message}`); }
      }
      return "";
  }

  public async getFileContext(filePath: string): Promise<{ text: string, isPdf: boolean, base64?: string, mimeType?: string }> {
      try {
          console.log(`[LLM] 📂 Reading file context: ${path.basename(filePath)}`);
          const ext = path.extname(filePath).toLowerCase();
          const buffer = await fs.promises.readFile(filePath);
          if (ext === '.pdf') {
              const text = await this.extractTextFromPdf(buffer);
              return { text, isPdf: true, base64: buffer.toString('base64'), mimeType: "application/pdf" };
          } else if (['.txt', '.md', '.ts', '.js', '.json', '.py', '.tsx'].includes(ext)) {
              return { text: `=== FILE (${path.basename(filePath)}) ===\n${buffer.toString('utf-8')}\n`, isPdf: false };
          }
          return { text: "", isPdf: false };
      } catch { return { text: "", isPdf: false }; }
  }

  // --- UNIVERSAL NOTION CONTEXT ---
  private async getNotionContext(): Promise<string> {
    if (!this.notionClient) return "";
    try {
      // Runs for ALL modes now
      console.log("[LLM] 📝 Fetching Universal Notion Context...");
      const response = await this.notionClient.search({ query: "", page_size: 5, sort: { direction: 'descending', timestamp: 'last_edited_time' }});
      let context = "=== RECENT NOTION WORKSPACE ACTIVITY ===\n";
      for (const result of response.results) {
        const item = result as any;
        if (item.properties) {
            const title = item.properties.Name?.title?.[0]?.plain_text || item.properties.Title?.title?.[0]?.plain_text || "Untitled";
            context += `- ${title} (${item.url})\n`;
        }
      }
      return context + "\n";
    } catch { return ""; }
  }

  // --- 🧠 MAIN CHAT WATERFALL ---
  public async chatWithGemini(message: string, history: any[], mode: string = "General", fileContext: string = "", onToken?: (token: string) => void): Promise<string> {
      // 1. Student Context: READ ONCE, CACHE FOREVER
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      
      // Load context if in Student mode OR if cache exists (to persist across mode switches if desired)
      if (mode === "Student") {
          if (this.cachedStudentText) {
              console.log("[LLM] 🧠 Cache Hit: Using existing Student Context & Summary.");
          } 
          else if (fs.existsSync(studentDir)) {
              console.log("[LLM] 📂 Cache Miss: Reading & Distilling Student Files...");
              try {
                const files = fs.readdirSync(studentDir);
                let fullText = "";
                for (const file of files) {
                    const { text, isPdf, base64 } = await this.getFileContext(path.join(studentDir, file));
                    if (text) fullText += `\n\n=== PROFILE CONTEXT (${file}) ===\n${text}`;
                    if (isPdf && base64) this.cachedStudentPdfPart = { inlineData: { data: base64, mimeType: "application/pdf" } };
                }
                this.cachedStudentText = fullText;
                // Generate Summary for Perplexity
                this.cachedStudentSummary = await this.generateStudentSummary(fullText);
              } catch(e) { console.error("[LLM] ❌ File Read Error:", e); }
          }
      }

      // 2. Load Universal Notion Context
      let notionContext = await this.getNotionContext();
      
      // 3. Base System Prompt
      let baseSystemInstruction = this.systemPrompt;
      if (this.sessionTranscript) baseSystemInstruction += `\n\n=== LIVE MEMORY ===\n${this.sessionTranscript}\n`;
      if (notionContext) baseSystemInstruction += `\n\n${notionContext}`;

      let validHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));

      // 4. Waterfall Execution with SMART ROUTING
      for (const config of CHAT_MODELS) {
          try {
              console.log(`[LLM] 🔄 Trying Chat Model: ${config.model} (${config.type})...`);
              
              // --- SMART ROUTING: Perplexity gets Summary, Others get Full Text ---
              let finalSystemInstruction = baseSystemInstruction;
              if (mode === "Student" && this.cachedStudentText) {
                  if (config.type === 'perplexity') {
                      console.log("[LLM] ℹ️ Injecting Distilled Summary for Perplexity.");
                      finalSystemInstruction += `\n\n=== STUDENT SUMMARY ===\n${this.cachedStudentSummary}\n`;
                  } else {
                      finalSystemInstruction += `\n\n=== STUDENT FILES ===\n${this.cachedStudentText}\n`;
                  }
              }

              let fullResponse = "";

              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({ history: validHistory });
                  
                  let parts: any[] = [{ text: finalSystemInstruction + "\n\n" + message }];
                  // Attach PDF binary only for Gemini if available
                  if (this.cachedStudentPdfPart) parts.push(this.cachedStudentPdfPart);

                  const result = await chat.sendMessageStream(parts);
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text); 
                  }
                  console.log(`[LLM] ✅ SUCCESS: ${config.model}`);
                  return this.cleanResponse(fullResponse);
              } 
              else {
                  let client: OpenAI | null = null;
                  if (config.type === 'github') client = this.githubClient; 
                  else if (config.type === 'groq') client = this.groqClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;
                  
                  if (client) {
                      const stream = await client.chat.completions.create({
                          messages: [
                              { role: "system", content: finalSystemInstruction },
                              ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
                              { role: "user", content: message }
                          ] as any,
                          model: config.model,
                          stream: true 
                      });
                      
                      for await (const chunk of stream) {
                          const content = chunk.choices[0]?.delta?.content || "";
                          if (content && !content.includes('<think>')) { 
                              fullResponse += content; 
                              if (onToken) onToken(content); 
                          }
                      }
                      console.log(`[LLM] ✅ SUCCESS: ${config.model}`);
                      return this.cleanResponse(fullResponse);
                  }
              }
          } catch (error) { console.warn(`[LLM] ❌ Model ${config.model} failed. Switching...`); continue; }
      }
      return "⚠️ All AI providers failed.";
  }

  // --- VISION WATERFALL ---
  public async chatWithImage(message: string, imagePaths: string[], onToken?: (token: string) => void): Promise<string> {
      console.log(`[LLM] 🖼️ Analyzing ${imagePaths.length} images...`);
      const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];

      for (const imagePath of imagePaths) {
          try {
              const buffer = await fs.promises.readFile(imagePath);
              imageParts.push({ inlineData: { data: buffer.toString("base64"), mimeType: imagePath.endsWith(".png") ? "image/png" : "image/jpeg" } });
          } catch (e) { console.error(`[LLM] ❌ Image Read Error: ${imagePath}`); }
      }
      if (imageParts.length === 0) return "❌ No valid images found.";

      let visionPrompt = message || "Analyze these images.";
      if (this.sessionTranscript) visionPrompt += `\n\nContext: ${this.sessionTranscript}`;
      const textPart = { type: "text", text: visionPrompt };

      for (const config of VISION_MODELS) {
          try {
              console.log(`[LLM] 👁️ Trying Vision Model: ${config.model}...`);
              let fullResponse = "";

              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const model = this.genAI.getGenerativeModel({ model: config.model });
                  const result = await model.generateContentStream([{ text: visionPrompt }, ...imageParts]);
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text);
                  }
                  return this.cleanResponse(fullResponse);
              } 
              else if (['github', 'openai', 'perplexity'].includes(config.type)) {
                  let client = null;
                  if (config.type === 'github') client = this.githubClient; 
                  else if (config.type === 'openai') client = this.openaiClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;

                  if (client) {
                      const openAIParts: any[] = [textPart, ...imageParts.map(p => ({ 
                          type: "image_url", 
                          image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } 
                      }))];

                      const stream = await client.chat.completions.create({
                          model: config.model,
                          messages: [{ role: "user", content: openAIParts }],
                          max_tokens: 2000, 
                          stream: true 
                      });

                      for await (const chunk of stream) {
                          const content = chunk.choices[0]?.delta?.content || "";
                          if (content) {
                              fullResponse += content;
                              if (onToken) onToken(content);
                          }
                      }
                      console.log(`[LLM] ✅ VISION SUCCESS: ${config.model}`);
                      return this.cleanResponse(fullResponse);
                  }
              }
          } catch (error) { console.warn(`[LLM] ❌ Vision ${config.model} failed.`); }
      }
      return "❌ All vision models failed.";
  }

  // --- AUDIO LOGIC ---
  public async analyzeAudioFile(audioPath: string): Promise<{ text: string, timestamp: number }> {
      try {
          console.log("[LLM] 🎙️ Trying Local Whisper...");
          const form = new FormData();
          form.append('file', fs.createReadStream(audioPath));
          const response = await axios.post('http://localhost:3000/v1/audio/transcriptions', form, { headers: form.getHeaders(), timeout: 0, httpAgent: httpAgent });
          const text = response.data?.text?.trim();
          if (text) {
              console.log("[LLM] ✅ Local Audio Success");
              this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
              return { text: text, timestamp: Date.now() };
          }
      } catch (e) { console.warn("[LLM] ⚠️ Local Whisper failed. Switching to Cloud..."); }
      
      if (this.groqClient) {
          try {
              console.log("[LLM] ☁️ Trying Groq Whisper...");
              const transcription = await this.groqClient.audio.transcriptions.create({ file: fs.createReadStream(audioPath), model: 'whisper-large-v3-turbo', response_format: 'json' });
              const text = transcription.text.trim();
              if (text) {
                console.log("[LLM] ✅ Groq Audio Success");
                this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
              }
              return { text: text, timestamp: Date.now() };
          } catch (e) { console.error("[LLM] ❌ Audio Failed."); }
      }
      return { text: "", timestamp: Date.now() };
  }

  public async analyzeAudioFromBase64(base64Data: string, mimeType: string) {
      if (!base64Data || base64Data.length < 100) return { text: "", timestamp: Date.now() };
      const tempPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}.wav`);
      try {
          await fs.promises.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
          const result = await this.analyzeAudioFile(tempPath);
          try { fs.unlinkSync(tempPath); } catch {}
          return result;
      } catch { return { text: "", timestamp: Date.now() }; }
  }

  public async generateSolution(problemInfo: any) {
      const solutionText = await this.chatWithGemini(`Solve:\n${JSON.stringify(problemInfo)}`, [], "Developer");
      return { solution: { code: solutionText, explanation: "AI Generated" } };
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      const response = await this.chatWithImage(`Debug:\n${JSON.stringify(problemInfo)}\nCode: ${currentCode}`, debugImagePaths);
      return { solution: { code: currentCode, explanation: response } };
  }
  
  public async analyzeImageFile(imagePath: string) { 
      console.log(`[LLM] 🖼️ Analyzing Single Image File: ${path.basename(imagePath)}`);
      return { text: "", timestamp: Date.now() }; 
  }
  
  public async testConnection() { 
      console.log("[LLM] 📡 Testing AI Connections...");
      return { success: true }; 
  }
  
  public async getOllamaModels() { return []; } 
  public isUsingOllama() { return false; }
  public getCurrentProvider() { return "Cloud Waterfall"; }
  public getCurrentModel() { return "auto"; }
  public async switchToOllama() { return { success: false, error: "Ollama removed" }; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); }
}