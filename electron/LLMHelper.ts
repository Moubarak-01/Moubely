import { GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import { Client as NotionClient } from "@notionhq/client"
import fs from "fs"
import path from "path"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"

// --- FIX: ROBUST PDF IMPORT ---
// We import as * to catch all export types, then handle it safely below.
import * as pdfLib from "pdf-parse"

// Helper function to handle the PDF library safely
async function safePdfParse(buffer: Buffer) {
    // @ts-ignore - Bypasses the "not callable" TS error
    const parser = pdfLib.default || pdfLib;
    return parser(buffer);
}

// --- 1. GEMINI FALLBACK STRATEGY ---
const GEMINI_STRATEGIES = [
    'gemini-2.5-flash',       // 1. Primary (Multimodal, 20 RPD)
    'gemma-2-27b-it',         // 2. High-Capacity (Text Only, 14.4k RPD)
    'gemma-2-9b-it',          // 3. Balanced (Text Only)
    'gemini-2.5-flash-lite',  // 4. Flash Fallback (Multimodal)
    'gemma-2-2b-it',          // 5. Fast (Text Only)
];

// --- 2. UNIFIED MODEL CONFIG ---
const CHAT_MODELS = [
    // TIER 1: GOOGLE
    ...GEMINI_STRATEGIES.map(model => ({ 
        type: 'gemini', 
        model: model, 
        name: `Google ${model}` 
    })),
    // TIER 2: REASONING
    { type: 'github', model: 'DeepSeek-R1', name: 'DeepSeek R1 (GitHub)' },
    // TIER 3: SEARCH
    { type: 'perplexity', model: 'llama-3.1-sonar-small-128k-online', name: 'Perplexity Online' },
    // TIER 4: BACKUP
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub)' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3' }
];

const VISION_MODELS = [
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'perplexity', model: 'r1-1776', name: 'Perplexity Vision' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub)' },
    { type: 'openai', model: 'gpt-4o', name: 'GPT-4o Vision' }
];

const AUDIO_MODELS = [
    { type: 'groq', model: 'whisper-large-v3-turbo', name: 'Groq Whisper' },
    { type: 'gemini', model: 'gemini-2.0-flash-001', name: 'Gemini Flash' }
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
  
  // --- SYSTEM PROMPT ---
  private readonly systemPrompt = `
  You are 'Moubely', an intelligent AI assistant.
  
  CORE RULES:
  1. **Structure (CRITICAL)**: 
     - Use '###' Headers for ALL main topics (e.g. ### Matter).
     - Do not use bolding for titles, use Headers.
  2. **Math**: 
     - Use '$$' for block equations (e.g. $$A = \pi r^2$$).
     - Use '$' for inline math.
     - NEVER escape dollar signs.
  3. **Context**: Use "STUDENT CONTEXT" or "NOTION CONTEXT" if available.
  
  STRICT TITLE GENERATION RULE:
  If asking for a title, output ONLY the text.
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
      if (process.env.NOTION_TOKEN) {
          this.notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
          console.log("[LLMHelper] Notion Client Initialized");
      }
      if (geminiKey) {
          this.genAI = new GoogleGenerativeAI(geminiKey);
          console.log("[LLMHelper] Gemini Initialized");
      }
      if (process.env.GITHUB_TOKEN) {
          this.githubClient = new OpenAI({
              baseURL: "https://models.inference.ai.azure.com",
              apiKey: process.env.GITHUB_TOKEN,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] GitHub Client Initialized");
      }
      if (process.env.PERPLEXITY_API_KEY) {
          this.perplexityClient = new OpenAI({
              baseURL: "https://api.perplexity.ai",
              apiKey: process.env.PERPLEXITY_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] Perplexity Client Initialized");
      }
      if (process.env.GROQ_API_KEY) {
          this.groqClient = new OpenAI({
              baseURL: "https://api.groq.com/openai/v1",
              apiKey: process.env.GROQ_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] Groq Client Initialized");
      }
      if (process.env.OPENAI_API_KEY) {
          this.openaiClient = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
              dangerouslyAllowBrowser: true
          });
      }
  }

  // --- PDF TEXT EXTRACTOR (Robust Fallback System) ---
  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
      let extractedText = "";

      // 1. Primary Attempt: Local PDF Parse (Fast/Free)
      try {
          // Use our safe helper instead of calling it directly
          const data = await safePdfParse(buffer);
          
          if (data && data.text && data.text.trim().length > 50) {
              return data.text.trim();
          }
      } catch (e: any) {
          // If local parse fails, we LOG it but DO NOT RETURN. We continue to OCR.
          console.warn("[LLMHelper] Local PDF parse failed/empty:", e.message);
          console.log("[LLMHelper] Switching to OCR Space fallback...");
      }

      // 2. Secondary Attempt: OCR Space API (For Scanned PDFs or Fallback)
      try {
          const ocrKey = process.env.OCR_SPACE_API_KEY;
          if (!ocrKey) {
              return extractedText || "[PDF Read Failed: Local parse failed & No OCR Key]";
          }

          const formData = new FormData();
          formData.append('base64Image', `data:application/pdf;base64,${buffer.toString('base64')}`);
          formData.append('isOverlayRequired', 'false');
          formData.append('scale', 'true');
          formData.append('OCREngine', '2'); 

          const response = await axios.post('https://api.ocr.space/parse/image', formData, {
              headers: {
                  ...formData.getHeaders(),
                  'apikey': ocrKey
              }
          });

          if (response.data && response.data.ParsedResults) {
              const ocrText = response.data.ParsedResults.map((r: any) => r.ParsedText).join('\n');
              return ocrText || "[OCR detected no text]";
          }
      } catch (e: any) {
          console.error("[LLMHelper] OCR Space Failed:", e.message);
      }

      return "[Error extracting text from PDF]";
  }

  // --- GET FILE CONTEXT ---
  public async getFileContext(filePath: string): Promise<{ text: string, isPdf: boolean, base64?: string, mimeType?: string }> {
      try {
          const ext = path.extname(filePath).toLowerCase();
          const buffer = await fs.promises.readFile(filePath);
          
          if (ext === '.pdf') {
              // Extract text automatically for fallback models
              const extractedText = await this.extractTextFromPdf(buffer);
              return { 
                  text: extractedText, 
                  isPdf: true, 
                  base64: buffer.toString('base64'),
                  mimeType: "application/pdf"
              };
          } else if (['.txt', '.md', '.ts', '.js', '.json', '.tsx', '.css', '.html'].includes(ext)) {
              const text = `=== FILE CONTENT (${path.basename(filePath)}) ===\n${buffer.toString('utf-8')}\n`;
              return { text, isPdf: false };
          }
          return { text: `[Warning: File type ${ext} not supported]`, isPdf: false };
      } catch (error: any) {
          return { text: `[Error reading file: ${error.message}]`, isPdf: false };
      }
  }

  // --- NOTION HELPER ---
  private async getNotionContext(): Promise<string> {
    if (!this.notionClient) return "";
    try {
      const response = await this.notionClient.search({
        query: "", 
        page_size: 5,
        sort: { direction: 'descending', timestamp: 'last_edited_time' }
      });
      let context = "=== RECENT NOTION ACTIVITY (CONTEXT) ===\n";
      for (const result of response.results) {
        if ('properties' in result) {
            const titleProp = (result as any).properties.Name?.title?.[0]?.plain_text || 
                              (result as any).properties.Title?.title?.[0]?.plain_text || 
                              "Untitled Page";
            const url = (result as any).url;
            context += `- Page: "${titleProp}" (Link: ${url})\n`;
        }
      }
      return context + "\n";
    } catch (error) {
      console.error("Notion Fetch Error:", error);
      return "";
    }
  }

  public async getNotionUsers() {
      if (!this.notionClient) return "Notion not configured.";
      try {
          const listUsersResponse = await this.notionClient.users.list({});
          return JSON.stringify(listUsersResponse);
      } catch (error: any) {
          return `Error fetching Notion users: ${error.message}`;
      }
  }

  // --- MAIN CHAT LOGIC ---
  public async chatWithGemini(
    message: string, 
    history: any[] = [], 
    mode: string = "General", 
    fileContext: string = "", 
    onToken?: (token: string) => void
  ): Promise<string> {
      if (this.useOllama) return this.callOllama(message);

      // 1. Prepare Local Files
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      let pdfPartForGemini: any = null;
      let textContext = "";

      if (mode === "Student" && fs.existsSync(studentDir)) {
          try {
            const files = fs.readdirSync(studentDir);
            for (const file of files) {
                const filePath = path.join(studentDir, file);
                const { text, isPdf, base64, mimeType } = await this.getFileContext(filePath);
                
                // Keep extracted text for ALL models (Critical for fallbacks)
                if (text) textContext += `\n\n=== PDF CONTENT (${file}) ===\n${text}`;
                
                // Keep base64 ONLY for Gemini Multimodal
                if (isPdf && base64) {
                    pdfPartForGemini = { inlineData: { data: base64, mimeType: mimeType || "application/pdf" } };
                }
            }
          } catch(e) { console.error("Error reading student files", e); }
      }

      // 2. Prepare Notion Context
      let notionContext = "";
      if ((mode === "General" || mode === "Student") && this.notionClient) {
          notionContext = await this.getNotionContext();
      }

      // 3. Build Base System Prompt
      let systemInstruction = this.systemPrompt;
      if (mode === "Student") systemInstruction += "\nCONTEXT: Mentor mode. Use the attached files to guide the user.";
      if (fileContext) systemInstruction += `\n\n=== UPLOADED FILE ===\n${fileContext}\n`;
      if (notionContext) systemInstruction += `\n\n${notionContext}`; 

      // 4. CASCADE STRATEGY
      for (const config of CHAT_MODELS) {
          try {
              let fullResponse = "";

              // A. GOOGLE MODELS (Gemini / Gemma)
              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  
                  // DETECT MODEL CAPABILITY
                  const isTextOnlyModel = config.model.includes('gemma');
                  
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({ 
                      history: history.map(h => ({ 
                          role: h.role === 'ai' ? 'model' : 'user', 
                          parts: [{ text: h.text }] 
                      })) 
                  });
                  
                  // Construct Message
                  let promptText = systemInstruction + "\n\n" + message;
                  
                  // If model is Text Only (Gemma), append extracted text manually
                  if (isTextOnlyModel && textContext) {
                      promptText += `\n\n${textContext}`;
                  }

                  let msgParts: any[] = [{ text: promptText }];
                  
                  // Only send PDF Blob if model is Multimodal (Flash)
                  if (!isTextOnlyModel && pdfPartForGemini) {
                      msgParts.push(pdfPartForGemini);
                  }

                  const result = await chat.sendMessageStream(msgParts);
                  for await (const chunk of result.stream) {
                      const chunkText = chunk.text();
                      fullResponse += chunkText;
                      if (onToken) onToken(chunkText); 
                  }
                  return fullResponse;
              }
              // B. FALLBACK PROVIDERS (DeepSeek / Groq / Perplexity)
              else {
                  let client: OpenAI | null = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'groq') client = this.groqClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  
                  if (client) {
                      // Append extracted text to prompt for these text-only providers
                      let finalTextContext = textContext ? `\n\n${textContext}` : "";
                      
                      const stream = await client.chat.completions.create({
                          messages: [
                              { role: "system", content: systemInstruction + finalTextContext },
                              ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
                              { role: "user", content: message }
                          ] as any,
                          model: config.model,
                          temperature: 0.7,
                          stream: true 
                      });

                      for await (const chunk of stream) {
                          const content = chunk.choices[0]?.delta?.content || "";
                          if (content) {
                              if (content.includes('<think>')) continue; 
                              if (content.includes('</think>')) continue;
                              fullResponse += content;
                              if (onToken) onToken(content); 
                          }
                      }
                      return fullResponse;
                  }
              }
          } catch (error: any) {
              console.warn(`[LLMHelper] ${config.name} failed:`, error.message);
              continue;
          }
      }
      return "⚠️ All AI providers failed. Check API keys.";
  }

  // --- VISION/AUDIO STUBS ---
  public async chatWithImage(message: string, imagePath: string): Promise<string> {
      try {
          const imageData = await fs.promises.readFile(imagePath);
          const base64Image = imageData.toString("base64");
          const lowerMsg = message.toLowerCase();
          const isCodingRelated = lowerMsg.includes('debug') || lowerMsg.includes('code') || lowerMsg.includes('error');
          
          for (const config of VISION_MODELS) {
            try {
              if (config.type === 'perplexity' && isCodingRelated) continue;

              if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const result = await geminiModel.generateContent([message, { inlineData: { data: base64Image, mimeType: "image/png" } }]);
                  return result.response.text();
              }

              if ((config.type === 'openai' || config.type === 'github' || config.type === 'perplexity')) {
                  let client: OpenAI | null = null;
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;

                  if (!client) continue;
                  
                  const response = await client.chat.completions.create({
                      model: config.model,
                      messages: [{ 
                        role: "user", 
                        content: [ { type: "text", text: message }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } } ] 
                      }] as any
                  });
                  return response.choices[0].message.content || "";
              }
            } catch (e) { continue; }
          }
      } catch (e) { return "Error processing image."; }
      return "All vision providers failed.";
  }
  
  public async analyzeImageFile(imagePath: string) {
      const text = await this.chatWithImage("Describe this image concisely.", imagePath);
      return { text, timestamp: Date.now() };
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
      if (!data || data.length < 100) return { text: "", timestamp: Date.now() };
      for (const config of AUDIO_MODELS) {
          try {
              if (config.type === 'groq' && this.groqClient) {
                  const buffer = Buffer.from(data, 'base64');
                  const file = await OpenAI.toFile(buffer, 'audio.webm', { type: 'audio/webm' });
                  const transcription = await this.groqClient.audio.transcriptions.create({
                      file: file, model: config.model, response_format: "json", temperature: 0.0
                  });
                  return { text: transcription.text.trim(), timestamp: Date.now() };
              } else if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const result = await geminiModel.generateContent(["Transcribe verbatim:", { inlineData: { data, mimeType } }]);
                  return { text: result.response.text().trim(), timestamp: Date.now() };
              }
          } catch (e) { continue; }
      }
      return { text: "", timestamp: Date.now() };
  }

  public async generateSolution(problemInfo: any) {
      const prompt = `Solve this problem:\n${JSON.stringify(problemInfo)}`;
      const solutionText = await this.chatWithGemini(prompt, [], "Developer");
      try { return JSON.parse(solutionText.replace(/^```json/, '').replace(/```$/, '')); } 
      catch { return { solution: { code: solutionText, explanation: "AI Generated" } }; }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      if (debugImagePaths.length === 0) throw new Error("No debug images.");
      const prompt = `Debug this code based on the screenshot.\nProblem: ${JSON.stringify(problemInfo)}\nCode: ${currentCode}`;
      const responseText = await this.chatWithImage(prompt, debugImagePaths[0]);
      try { return JSON.parse(responseText.replace(/^```json/, '').replace(/```$/, '')); }
      catch { return { solution: { code: currentCode, explanation: responseText } }; }
  }

  public async testConnection() { return { success: true }; }
  public async extractProblemFromImages(imagePaths: string[]) { return {}; }
  public async analyzeAudioFile(audioPath: string) {
      const buffer = await fs.promises.readFile(audioPath);
      return this.analyzeAudioFromBase64(buffer.toString('base64'), 'audio/mp3');
  }

  public async readFileContext(filePath: string): Promise<string> {
      const { text } = await this.getFileContext(filePath);
      return text;
  }
  private async getStudentFiles(): Promise<string> { return ""; }
  private async callOllama(prompt: string): Promise<string> { return ""; }
  private async initializeOllamaModel(): Promise<void> {}
  public async getOllamaModels() { return []; } 
  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return "multi-provider"; }
  public getCurrentModel() { return "auto"; }
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); this.useOllama = false; }
}