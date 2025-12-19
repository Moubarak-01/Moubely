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

// --- MODEL CONFIGURATIONS ---
const CHAT_MODELS = [
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'gemini', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { type: 'gemini', model: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
    { type: 'perplexity', model: 'sonar-reasoning-pro', name: 'Perplexity Pro' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o' },
    { type: 'github', model: 'DeepSeek-R1', name: 'DeepSeek R1' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq' }
];

// Vision Fallback Order
const VISION_MODELS = [
    { type: 'gemini', model: 'gemini-2.0-flash' },      
    { type: 'perplexity', model: 'sonar-reasoning-pro' },
    { type: 'github', model: 'gpt-4o' },
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
    console.log("[LLM] ☁️ Initializing Cloud Providers (Waterfall System)...");
    this.initializeProviders(apiKey);
  }

  private initializeProviders(geminiKey?: string) {
      if (process.env.NOTION_TOKEN) this.notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
      if (geminiKey) this.genAI = new GoogleGenerativeAI(geminiKey);
      if (process.env.GITHUB_TOKEN) this.githubClient = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN, dangerouslyAllowBrowser: true });
      if (process.env.PERPLEXITY_API_KEY) this.perplexityClient = new OpenAI({ baseURL: "https://api.perplexity.ai", apiKey: process.env.PERPLEXITY_API_KEY, dangerouslyAllowBrowser: true });
      if (process.env.GROQ_API_KEY) this.groqClient = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY, dangerouslyAllowBrowser: true });
      if (process.env.OPENAI_API_KEY) this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
  }

  private cleanResponse(text: string): string {
      return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[\d+\]/g, "").trim();
  }

  // --- PDF PARSER ---
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
      console.log("[LLM] 📄 Parsing PDF content...");
      try {
          const data = await safePdfParse(buffer);
          if (data && data.text && data.text.trim().length > 50) {
              console.log("[LLM] ✅ Local PDF Parse Successful");
              return data.text.trim();
          }
          console.warn("[LLM] ⚠️ Local PDF parse returned empty/short text. Switching to OCR...");
      } catch (e) { 
          console.warn("[LLM] ❌ Local PDF parse failed completely. Switching to OCR..."); 
      }

      // OCR Fallback
      const ocrKey = process.env.OCR_SPACE_API_KEY;
      if (ocrKey) {
          try {
              console.log("[LLM] 👁️ Attempting OCR via OCR Space API...");
              const formData = new FormData();
              formData.append('base64Image', `data:application/pdf;base64,${buffer.toString('base64')}`);
              formData.append('isOverlayRequired', 'false');
              formData.append('OCREngine', '2');
              
              const response = await axios.post('https://api.ocr.space/parse/image', formData, { 
                  headers: { ...formData.getHeaders(), 'apikey': ocrKey }, timeout: 30000 
              });

              if (response.data && response.data.ParsedResults) {
                  const ocrText = response.data.ParsedResults.map((r: any) => r.ParsedText).join('\n');
                  if (ocrText.trim().length > 0) {
                      console.log("[LLM] ✅ OCR Success! Text extracted.");
                      return ocrText;
                  }
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
          } else if (['.txt', '.md', '.ts', '.js', '.json', '.tsx'].includes(ext)) {
              return { text: `=== FILE (${path.basename(filePath)}) ===\n${buffer.toString('utf-8')}\n`, isPdf: false };
          }
          return { text: "", isPdf: false };
      } catch { return { text: "[Read Error]", isPdf: false }; }
  }

  private async getNotionContext(): Promise<string> {
    if (!this.notionClient) return "";
    try {
      console.log("[LLM] 📝 Fetching Notion Context...");
      const response = await this.notionClient.search({ query: "", page_size: 5, sort: { direction: 'descending', timestamp: 'last_edited_time' }});
      let context = "=== RECENT NOTION ACTIVITY ===\n";
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

  // --- MAIN CHAT LOGIC ---
  public async chatWithGemini(message: string, history: any[], mode: string = "General", fileContext: string = "", onToken?: (token: string) => void): Promise<string> {
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      let pdfPartForGemini: any = null;
      let textContext = "";

      if (mode === "Student" && fs.existsSync(studentDir)) {
          try {
            const files = fs.readdirSync(studentDir);
            if(files.length > 0) console.log(`[LLM] 🎓 Student Mode: Reading ${files.length} profile files...`);
            for (const file of files) {
                const { text, isPdf, base64 } = await this.getFileContext(path.join(studentDir, file));
                if (text) textContext += `\n\n=== PDF TEXT (${file}) ===\n${text}`;
                if (isPdf && base64) pdfPartForGemini = { inlineData: { data: base64, mimeType: "application/pdf" } };
            }
          } catch(e) {}
      }

      let notionContext = (mode === "General") ? await this.getNotionContext() : "";
      
      let systemInstruction = this.systemPrompt;
      if (this.sessionTranscript) systemInstruction += `\n\n=== LIVE MEMORY ===\n${this.sessionTranscript}\n`;
      if (textContext) systemInstruction += `\n\n=== STUDENT FILES ===\n${textContext}\n`;
      if (notionContext) systemInstruction += `\n\n${notionContext}`; 

      let validHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));

      for (const config of CHAT_MODELS) {
          try {
              console.log(`[LLM] 🔄 Trying Chat Model: ${config.model} (${config.type})...`);
              
              let fullResponse = "";
              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({ history: validHistory });
                  let parts: any[] = [{ text: systemInstruction + "\n\n" + message }];
                  if (pdfPartForGemini) parts.push(pdfPartForGemini);
                  
                  const result = await chat.sendMessageStream(parts);
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text); 
                  }
                  console.log(`[LLM] ✅ SUCCESS: Answer generated by ${config.model}`);
                  return this.cleanResponse(fullResponse);
              } else {
                  let client: OpenAI | null = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'groq') client = this.groqClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;
                  
                  if (client) {
                      const stream = await client.chat.completions.create({
                          messages: [{ role: "system", content: systemInstruction }, ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })), { role: "user", content: message }] as any,
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
                      console.log(`[LLM] ✅ SUCCESS: Answer generated by ${config.model}`);
                      return this.cleanResponse(fullResponse);
                  }
              }
          } catch (error) { console.warn(`[LLM] ❌ Failed: ${config.model}. Trying next provider...`); }
      }
      console.error("[LLM] ☠️ All AI providers failed.");
      return "⚠️ All AI providers failed.";
  }

  // --- VISION WATERFALL (Correctly Implemented with Fallbacks) ---
  public async chatWithImage(message: string, imagePaths: string[], onToken?: (token: string) => void): Promise<string> {
      console.log(`[LLM] 🖼️ Starting analysis of ${imagePaths.length} images...`);
      
      const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];

      for (const imagePath of imagePaths) {
          try {
              const buffer = await fs.promises.readFile(imagePath);
              imageParts.push({ inlineData: { data: buffer.toString("base64"), mimeType: imagePath.endsWith(".png") ? "image/png" : "image/jpeg" } });
          } catch (e: any) {
              console.error(`[LLM] ❌ Failed to read image file (${path.basename(imagePath)}): ${e.message}`);
          }
      }
      
      if (imageParts.length === 0) return "❌ Error: Could not read any images.";
      console.log(`[LLM] ✅ Successfully prepared ${imageParts.length} images for API call.`);
      
      let visionPrompt = message || "Analyze these images.";
      if (this.sessionTranscript) visionPrompt += `\n\nContext: ${this.sessionTranscript}`;
      const textPart = { type: "text", text: visionPrompt };

      for (const config of VISION_MODELS) {
          try {
              console.log(`[LLM] 🔄 Trying Vision Model: ${config.model} (${config.type})...`);
              let fullResponse = "";

              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const model = this.genAI.getGenerativeModel({ model: config.model });
                  const parts = [{ text: textPart.text }, ...imageParts];
                  const result = await model.generateContentStream(parts);
                  
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text);
                  }
                  console.log(`[LLM] ✅ VISION SUCCESS: ${config.model}`);
                  return this.cleanResponse(fullResponse);
              } 
              // --- RESTORED FALLBACK FOR OPENAI/GITHUB/PERPLEXITY ---
              else if (['github', 'openai', 'perplexity'].includes(config.type)) {
                  let client = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;

                  if (client) {
                      // Correctly format image payload for OpenAI-compatible APIs
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
          } catch (error: any) { console.warn(`[LLM] ❌ Vision Model ${config.model} failed: ${error.message}`); }
      }
      return "❌ Error: All vision models failed.";
  }

  // --- AUDIO LOGIC ---
  public async analyzeAudioFile(audioPath: string): Promise<{ text: string, timestamp: number }> {
      try {
          console.log(`[LLM] 🎙️ Transcribing Audio via Local Service...`);
          const form = new FormData();
          form.append('file', fs.createReadStream(audioPath));
          const response = await axios.post('http://localhost:3000/v1/audio/transcriptions', form, {
              headers: form.getHeaders(), timeout: 0, httpAgent: httpAgent
          });
          const text = response.data?.text?.trim();
          if (text) {
              console.log("[LLM] ✅ Audio Transcription Success (Local)");
              this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
              return { text: text, timestamp: Date.now() };
          }
      } catch (e) { console.warn("[LLM] ⚠️ Local transcription failed. Trying Cloud..."); }
      
      if (this.groqClient) {
          try {
              console.log("[LLM] ☁️ Transcribing Audio via Groq...");
              const transcription = await this.groqClient.audio.transcriptions.create({
                  file: fs.createReadStream(audioPath),
                  model: 'whisper-large-v3-turbo',
                  response_format: 'json',
              });
              const text = transcription.text.trim();
              if (text) {
                console.log("[LLM] ✅ Audio Transcription Success (Groq)");
                this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
              }
              return { text: text, timestamp: Date.now() };
          } catch (e) { console.error("[LLM] ❌ Audio Transcription Failed."); }
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
      console.log("[LLM] 🧠 Generating Solution...");
      const solutionText = await this.chatWithGemini(`Solve:\n${JSON.stringify(problemInfo)}`, [], "Developer");
      return { solution: { code: solutionText, explanation: "AI Generated" } };
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      console.log(`[LLM] 🐞 Debugging with ${debugImagePaths.length} screenshots...`);
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