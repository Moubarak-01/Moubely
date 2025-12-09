import { GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import { Client as NotionClient } from "@notionhq/client"
import fs from "fs"
import path from "path"
import { app } from "electron"

// --- FIX: ROBUST PDF IMPORT ---
let pdfLib = require("pdf-parse");
if (typeof pdfLib !== 'function' && pdfLib.default) {
    pdfLib = pdfLib.default;
}
const pdfParse = pdfLib;

// --- MODEL CONFIGURATION (ORDER MATTERS) ---
const CHAT_MODELS = [
    // 1. Gemini 2.5 Flash (Primary - Multimodal & Fast)
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },

    // 2. DeepSeek R1 (GitHub - Excellent Reasoning)
    { type: 'github', model: 'DeepSeek-R1', name: 'DeepSeek R1 (GitHub)' },

    // 3. Perplexity (Search/Chat - Good for General Info)
    { type: 'perplexity', model: 'llama-3.1-sonar-small-128k-online', name: 'Perplexity Online' },

    // 4. GPT-4o (GitHub - Reliable Fallback)
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o (GitHub)' },

    // 5. Groq (Llama 3.3 - Speed Fallback)
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3' }
];

const VISION_MODELS = [
    // 1. Gemini 2.5 Flash (Primary Vision)
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },

    // 2. Perplexity (General Images ONLY - No Coding)
    { type: 'perplexity', model: 'r1-1776', name: 'Perplexity Vision' }, // Using a placeholder/compatible model ID if available

    // 3. GPT-4o (Fallback)
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
  
  // --- STRICT SYSTEM PROMPT (APPLIES TO ALL MODELS) ---
  private readonly systemPrompt = `
  You are 'Moubely', an intelligent and concise AI assistant.
  
  CORE RULES:
  1. **Directness**: Be direct. Do not use filler phrases like "Here is the answer" or "I can help with that."
  2. **Formatting**: Use standard Markdown. Use LaTeX for math ($...$).
  3. **Consistency**: Your output must look the same regardless of which AI model generates it.
  4. **Context**: Use the provided "STUDENT CONTEXT" to personalize answers.
  
  STRICT TITLE GENERATION RULE:
  If the user asks for a title, summary, or meeting name:
  - Output **ONLY** the text of the title.
  - Do NOT add "Title:", "Subject:", "Meeting Name:", quotes, or bolding.
  - Example Input: "Give me a title for this text."
  - Example Output: Kingdom Come Dimension Song Discussion
  
  Do not output internal thought processes or <think> tags.
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
      // 1. Notion Client
      if (process.env.NOTION_TOKEN) {
          this.notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
          console.log("[LLMHelper] Notion Client Initialized");
      }

      // 2. Gemini Client
      if (geminiKey) {
          this.genAI = new GoogleGenerativeAI(geminiKey);
          console.log("[LLMHelper] Gemini Initialized");
      }

      // 3. GitHub Client (DeepSeek & GPT-4o)
      if (process.env.GITHUB_TOKEN) {
          this.githubClient = new OpenAI({
              baseURL: "https://models.inference.ai.azure.com",
              apiKey: process.env.GITHUB_TOKEN,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] GitHub Client Initialized (DeepSeek/GPT-4o)");
      }

      // 4. Perplexity Client
      if (process.env.PERPLEXITY_API_KEY) {
          this.perplexityClient = new OpenAI({
              baseURL: "https://api.perplexity.ai",
              apiKey: process.env.PERPLEXITY_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] Perplexity Client Initialized");
      }

      // 5. Groq Client
      if (process.env.GROQ_API_KEY) {
          this.groqClient = new OpenAI({
              baseURL: "https://api.groq.com/openai/v1",
              apiKey: process.env.GROQ_API_KEY,
              dangerouslyAllowBrowser: true
          });
          console.log("[LLMHelper] Groq Client Initialized");
      }

      // 6. OpenAI Standard (Optional Fallback)
      if (process.env.OPENAI_API_KEY) {
          this.openaiClient = new OpenAI({
              apiKey: process.env.OPENAI_API_KEY,
              dangerouslyAllowBrowser: true
          });
      }
  }

  // --- UNIVERSAL FILE READER ---
  public async getFileContext(filePath: string): Promise<{ text: string, isPdf: boolean, base64?: string, mimeType?: string }> {
      try {
          const ext = path.extname(filePath).toLowerCase();
          const buffer = await fs.promises.readFile(filePath);
          
          if (ext === '.pdf') {
              return { 
                  text: "", 
                  isPdf: true, 
                  base64: buffer.toString('base64'),
                  mimeType: "application/pdf"
              };
          } 
          else if (['.txt', '.md', '.ts', '.js', '.json', '.tsx', '.css', '.html'].includes(ext)) {
              const text = `=== FILE CONTENT (${path.basename(filePath)}) ===\n${buffer.toString('utf-8')}\n`;
              return { text, isPdf: false };
          }
          return { text: `[Warning: File type ${ext} not supported]`, isPdf: false };
      } catch (error: any) {
          return { text: `[Error reading file: ${error.message}]`, isPdf: false };
      }
  }

  // --- NOTION HELPER ---
  public async getNotionUsers() {
      if (!this.notionClient) return "Notion not configured.";
      try {
          const listUsersResponse = await this.notionClient.users.list({});
          return JSON.stringify(listUsersResponse);
      } catch (error: any) {
          console.error("Notion Error:", error);
          return `Error fetching Notion users: ${error.message}`;
      }
  }

  // --- UNIVERSAL CHAT FUNCTION ---
  public async chatWithGemini(
    message: string, 
    history: any[] = [], 
    mode: string = "General", 
    fileContext: string = "", 
    onToken?: (token: string) => void
  ): Promise<string> {
      if (this.useOllama) return this.callOllama(message);

      // 1. Prepare Context (Files/Resumes)
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      let pdfPartForGemini: any = null;
      let textContext = "";

      if (mode === "Student" && fs.existsSync(studentDir)) {
          try {
            const files = fs.readdirSync(studentDir);
            for (const file of files) {
                const filePath = path.join(studentDir, file);
                const { text, isPdf, base64, mimeType } = await this.getFileContext(filePath);
                
                if (isPdf && base64) {
                    pdfPartForGemini = {
                        inlineData: { data: base64, mimeType: mimeType || "application/pdf" }
                    };
                } else {
                    textContext += text;
                }
            }
          } catch(e) { console.error("Error reading student files", e); }
      }

      // 2. Build The Prompt
      let systemInstruction = this.systemPrompt;
      if (mode === "Student") systemInstruction += "\nCONTEXT: Mentor mode. Use the attached files to guide the user.";
      if (fileContext) systemInstruction += `\n\n=== UPLOADED FILE ===\n${fileContext}\n`;
      if (textContext) systemInstruction += `\n\n=== STUDENT FILES (TEXT) ===\n${textContext}\n`;

      // 3. Prepare Messages for OpenAI-Compatible APIs
      const messages = [
          { role: "system", content: systemInstruction },
          ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
          { role: "user", content: message }
      ];

      // 4. Prepare History for Gemini
      let validHistory = history.map(h => ({ 
          role: h.role === 'ai' ? 'model' : 'user', 
          parts: [{ text: h.text }] 
      }));
      while(validHistory.length > 0 && validHistory[0].role === 'model') validHistory.shift(); 

      // 5. CASCADE STRATEGY (Waterfall)
      for (const config of CHAT_MODELS) {
          try {
              let fullResponse = "";

              // --- A. GEMINI (Google) ---
              if (config.type === 'gemini') {
                  if (!this.genAI) continue;
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const chat = geminiModel.startChat({ history: validHistory });
                  
                  let msgParts: any[] = [{ text: systemInstruction + "\n\n" + message }];
                  if (pdfPartForGemini) msgParts.push(pdfPartForGemini);

                  const result = await chat.sendMessageStream(msgParts);
                  for await (const chunk of result.stream) {
                      const chunkText = chunk.text();
                      fullResponse += chunkText;
                      if (onToken) onToken(chunkText); 
                  }
                  return fullResponse;
              }

              // --- B. OPENAI-COMPATIBLE (GitHub / Groq / Perplexity) ---
              else {
                  let client: OpenAI | null = null;
                  
                  if (config.type === 'github') client = this.githubClient;
                  else if (config.type === 'groq') client = this.groqClient;
                  else if (config.type === 'perplexity') client = this.perplexityClient;
                  else if (config.type === 'openai') client = this.openaiClient;
                  
                  if (client) {
                      const stream = await client.chat.completions.create({
                          messages: messages as any,
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

  // --- VISION (IMAGES) ---
  public async chatWithImage(message: string, imagePath: string): Promise<string> {
      try {
          const imageData = await fs.promises.readFile(imagePath);
          const base64Image = imageData.toString("base64");
          const lowerMsg = message.toLowerCase();

          // Guard Clause: Keywords that suggest coding tasks
          const isCodingRelated = lowerMsg.includes('debug') || 
                                  lowerMsg.includes('code') || 
                                  lowerMsg.includes('function') || 
                                  lowerMsg.includes('script') ||
                                  lowerMsg.includes('error');
          
          for (const config of VISION_MODELS) {
            try {
              // SKIP Perplexity if it's a coding task (as requested)
              if (config.type === 'perplexity' && isCodingRelated) {
                  console.log("[LLMHelper] Skipping Perplexity for coding-related image task.");
                  continue; 
              }

              // --- A. GEMINI VISION ---
              if (config.type === 'gemini' && this.genAI) {
                  const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                  const result = await geminiModel.generateContent([message, { inlineData: { data: base64Image, mimeType: "image/png" } }]);
                  return result.response.text();
              }

              // --- B. OPENAI-COMPATIBLE VISION (GitHub / OpenAI / Perplexity) ---
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
                        content: [ 
                          { type: "text", text: message }, 
                          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } } 
                        ] 
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

  // --- AUDIO (WHISPER) ---
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

  // --- HELPER UTILS ---
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

  // --- STUBS ---
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