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

// --- MODEL CONFIGURATIONS (Updated Priority Order) ---
const CHAT_MODELS = [
    { type: 'gemini', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { type: 'gemini', model: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Lite' },
    { type: 'gemini', model: 'gemma-2-27b-it', name: 'Gemma 2 27B' },
    { type: 'github', model: 'DeepSeek-R1', name: 'DeepSeek R1' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o' },
    { type: 'perplexity', model: 'sonar-reasoning-pro', name: 'Perplexity Pro' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq' }
];

// UPDATED: Vision Fallback Order
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
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"
  
  private readonly systemPrompt = `
  You are 'Moubely', an intelligent AI assistant.
  
  CORE RULES:
  1. Use '###' Headers for main topics.
  2. Use **bold** to highlight key variables or terms.
  3. Use provided "STUDENT CONTEXT" or "NOTION CONTEXT" silently.
  
  MATH FORMULA RULES (STRICT):
  - ALWAYS use '$$' for block equations (e.g. $$x^2$$).
  - ALWAYS use '$' for inline math (e.g. $x$).
  - NEVER use the bracket syntax like \\[ ... \\].
  
  STRICT TITLE RULE: If asking for a title, output ONLY the title text string. No quotes.
  `;

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama;
    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434";
      this.ollamaModel = ollamaModel || "gemma:latest";
      this.initializeOllamaModel();
    } else {
      this.initializeProviders(apiKey);
    }
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
      return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
      try {
          const data = await safePdfParse(buffer);
          if (data && data.text && data.text.trim().length > 50) return data.text.trim();
      } catch (e) { console.warn("Local PDF parse failed."); }
      return "[Error extracting PDF text]";
  }

  public async getFileContext(filePath: string): Promise<{ text: string, isPdf: boolean, base64?: string, mimeType?: string }> {
      try {
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
      const response = await this.notionClient.search({ query: "", page_size: 5, sort: { direction: 'descending', timestamp: 'last_edited_time' }});
      let context = "=== RECENT NOTION ACTIVITY (CONTEXT) ===\n";
      for (const result of response.results) {
        const item = result as any;
        if (item.properties) {
            const titleProp = item.properties.Name?.title?.[0]?.plain_text || item.properties.Title?.title?.[0]?.plain_text || "Untitled";
            context += `- Page: "${titleProp}" (Link: ${item.url || ""})\n`;
        }
      }
      return context + "\n";
    } catch (error) { return ""; }
  }

  public async getNotionUsers() {
      if (!this.notionClient) return "Notion not configured.";
      try { const list = await this.notionClient.users.list({}); return JSON.stringify(list); } catch (error: any) { return `Error: ${error.message}`; }
  }

  public async chatWithGemini(message: string, history: any[], mode: string = "General", fileContext: string = "", onToken?: (token: string) => void): Promise<string> {
      if (this.useOllama) return this.callOllama(message);
      
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      let pdfPartForGemini: any = null;
      let textContext = "";

      if (mode === "Student" && fs.existsSync(studentDir)) {
          try {
            const files = fs.readdirSync(studentDir);
            for (const file of files) {
                const { text, isPdf, base64, mimeType } = await this.getFileContext(path.join(studentDir, file));
                if (text) textContext += `\n\n=== PDF TEXT (${file}) ===\n${text}`;
                if (isPdf && base64) pdfPartForGemini = { inlineData: { data: base64, mimeType: mimeType || "application/pdf" } };
            }
          } catch(e) {}
      }

      let notionContext = (mode === "General" || mode === "Student") ? await this.getNotionContext() : "";
      let systemInstruction = this.systemPrompt;
      if (mode === "Student") systemInstruction += "\nCONTEXT: Mentor mode. Use attached files.";
      if (fileContext) systemInstruction += `\n\n=== UPLOADED FILE ===\n${fileContext}\n`;
      if (textContext) systemInstruction += `\n\n=== STUDENT FILES ===\n${textContext}\n`;
      if (notionContext) systemInstruction += `\n\n${notionContext}`; 

      let validHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
      while (validHistory.length > 0 && validHistory[0].role === 'model') validHistory.shift(); 

      for (const config of CHAT_MODELS) {
          try {
              console.log(`[LLMHelper] 💬 Attempting Chat with: ${config.model} (${config.type})`);
              
              let fullResponse = "";
              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const isTextOnly = config.model.includes('gemma');
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({ history: validHistory });
                  let prompt = systemInstruction + "\n\n" + message;
                  if (isTextOnly && textContext) prompt += `\n\n${textContext}`;
                  
                  let parts: any[] = [{ text: prompt }];
                  if (!isTextOnly && pdfPartForGemini) parts.push(pdfPartForGemini);
                  
                  const result = await chat.sendMessageStream(parts);
                  
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text); 
                  }
                  
                  return fullResponse;
              } else {
                  let client: OpenAI | null = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'groq') client = this.groqClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  
                  if (client) {
                      const stream = await client.chat.completions.create({
                          messages: [{ role: "system", content: systemInstruction + (textContext ? `\n\n${textContext}` : "") }, ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })), { role: "user", content: message }] as any,
                          model: config.model,
                          temperature: 0.7,
                          stream: true 
                      });
                      
                      let isThinking = false;
                      for await (const chunk of stream) {
                          let content = chunk.choices[0]?.delta?.content || "";
                          if (!content) continue;

                          if (content.includes('<think>')) { isThinking = true; continue; }
                          if (content.includes('</think>')) { isThinking = false; continue; }
                          if (isThinking) continue;

                          if (content) { 
                              fullResponse += content; 
                              if (onToken) onToken(content); 
                          }
                      }
                      
                      return this.cleanResponse(fullResponse);
                  }
              }
          } catch (error) { continue; }
      }
      return "⚠️ All AI providers failed.";
  }

  // --- NEW: VISION STREAMING SUPPORT ---
  public async chatWithImage(message: string, imagePath: string, onToken?: (token: string) => void): Promise<string> {
      console.log(`[LLMHelper] 🖼️ Analyzing image: ${imagePath}`);
      
      const imageBuffer = await fs.promises.readFile(imagePath);
      const base64Image = imageBuffer.toString("base64");
      const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
      const prompt = (message || "Describe this image.") + "\n\nIMPORTANT: Use $$ for block math and $ for inline math.";

      for (const config of VISION_MODELS) {
          try {
              console.log(`[LLMHelper] 🔄 Trying Vision Model: ${config.model} (${config.type})`);
              let fullResponse = "";

              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const model = this.genAI.getGenerativeModel({ model: config.model });
                  const result = await model.generateContentStream([
                      prompt, 
                      { inlineData: { data: base64Image, mimeType: mimeType } }
                  ]);
                  
                  for await (const chunk of result.stream) {
                      const text = chunk.text();
                      fullResponse += text;
                      if (onToken) onToken(text); // Streaming Image Response
                  }
                  
                  return this.cleanResponse(fullResponse);
              } 
              else if (['github', 'openai', 'perplexity'].includes(config.type)) {
                  let client = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;

                  if (!client) continue;
                  
                  const stream = await client.chat.completions.create({
                      model: config.model,
                      messages: [
                          { role: "user", content: [
                              { type: "text", text: prompt },
                              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                          ]}
                      ],
                      max_tokens: 1000,
                      stream: true // Enable streaming
                  });

                  for await (const chunk of stream) {
                      const content = chunk.choices[0]?.delta?.content || "";
                      if (content) {
                          fullResponse += content;
                          if (onToken) onToken(content); // Streaming Image Response
                      }
                  }
                  return this.cleanResponse(fullResponse);
              }
          } catch (error: any) {
              console.warn(`[LLMHelper] ⚠️ ${config.model} failed: ${error.message || 'Unknown error'}`);
          }
      }

      return "❌ Error: All vision models failed or hit rate limits. Please try again later.";
  }

  public async analyzeAudioFile(audioPath: string): Promise<{ text: string, timestamp: number }> {
      try {
          const form = new FormData();
          form.append('file', fs.createReadStream(audioPath));
          const response = await axios.post('http://localhost:3000/v1/audio/transcriptions', form, {
              headers: form.getHeaders(), timeout: 60000, httpAgent: httpAgent
          });
          const text = response.data?.text?.trim();
          if (text) return { text: text, timestamp: Date.now() };
      } catch (e) {}
      
      if (this.groqClient) {
          try {
              const transcription = await this.groqClient.audio.transcriptions.create({
                  file: fs.createReadStream(audioPath),
                  model: 'whisper-large-v3-turbo',
                  response_format: 'json',
              });
              return { text: transcription.text.trim(), timestamp: Date.now() };
          } catch (e) { }
      }
      return { text: "", timestamp: Date.now() };
  }

  public async analyzeAudioFromBase64(base64Data: string, mimeType: string) {
      if (!base64Data || base64Data.length < 100) return { text: "", timestamp: Date.now() };
      const tempPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}.wav`);
      try {
          const buffer = Buffer.from(base64Data, 'base64');
          await fs.promises.writeFile(tempPath, buffer);
          const result = await this.analyzeAudioFile(tempPath);
          try { fs.unlinkSync(tempPath); } catch (e) {}
          return result;
      } catch (error) { return { text: "", timestamp: Date.now() }; }
  }

  public async generateSolution(problemInfo: any) {
      const solutionText = await this.chatWithGemini(`Solve:\n${JSON.stringify(problemInfo)}`, [], "Developer");
      try { return JSON.parse(this.cleanResponse(solutionText).replace(/^```json/, '').replace(/```$/, '')); } catch { return { solution: { code: solutionText, explanation: "AI Generated" } }; }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      const response = await this.chatWithImage(`Debug:\n${JSON.stringify(problemInfo)}\nCode: ${currentCode}`, debugImagePaths[0]);
      try { return JSON.parse(this.cleanResponse(response).replace(/^```json/, '').replace(/```$/, '')); } catch { return { solution: { code: currentCode, explanation: response } }; }
  }

  public async analyzeImageFile(imagePath: string) { return { text: "", timestamp: Date.now() }; }
  public async testConnection() { return { success: true }; }
  public async getOllamaModels() { return []; } 
  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return "multi-provider"; }
  public getCurrentModel() { return "auto"; }
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); this.useOllama = false; }
  private async callOllama(prompt: string): Promise<string> { return ""; }
  private async initializeOllamaModel(): Promise<void> {}
}