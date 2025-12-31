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

// --- 1. THE EXPANDED WATERFALL BRAINS ---
const CHAT_MODELS = [
    // --- TIER 1: SUPREME REASONING (Gemini & Claude) ---
    { type: 'gemini', model: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' },
    { type: 'gemini', model: 'gemini-3-pro-preview', name: 'Gemini 3 Deep Think' },
    { type: 'openrouter', model: 'anthropic/claude-opus-4.5', name: 'Claude 4.5 Opus' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Thinking)' },

    // --- TIER 2: HIGH-SPEED PERFORMANCE ---
    { type: 'gemini', model: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'openrouter', model: 'anthropic/claude-sonnet-4.5', name: 'Claude 4.5 Sonnet' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },

    // --- TIER 3: EFFICIENCY & SPECIALIZED ---
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'gemini', model: 'gemini-2.5-flash-native', name: 'Gemini 2.5 Flash Native' },
    { type: 'gemini', model: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics' },
    { type: 'openrouter', model: 'anthropic/claude-haiku-4.5', name: 'Claude 4.5 Haiku' },

    // --- TIER 4: OPEN MULTIMODAL (Gemma 3 Family) ---
    { type: 'gemini', model: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
    { type: 'gemini', model: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
    { type: 'gemini', model: 'gemma-3-4b-it', name: 'Gemma 3 4B' },

    // --- TIER 5: RESEARCH & SEARCH (Perplexity) ---
    { type: 'perplexity', model: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
    { type: 'perplexity', model: 'sonar', name: 'Sonar' },

    // --- TIER 6: RELIABLE BACKUPS ---
    { type: 'openrouter', model: 'openai/o3-mini', name: 'OpenAI o3-Pro' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o' },
    { type: 'openrouter', model: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3' }
];

// --- 2. THE EYES (Vision Waterfall) ---
const VISION_MODELS = [
    // --- TIER 1: ELITE VISION ---
    { type: 'gemini', model: 'gemini-3-pro-image-preview' }, // Nano Banana Pro
    { type: 'openrouter', model: 'anthropic/claude-opus-4.5', name: 'Claude 4.5 Opus (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Reasoning Vision)' },
    
    // --- TIER 2: FAST & RELIABLE ---
    { type: 'gemini', model: 'gemini-3-flash-preview' },      
    { type: 'gemini', model: 'gemini-2.5-flash' },    
    { type: 'openrouter', model: 'anthropic/claude-sonnet-4.5', name: 'Claude 4.5 Sonnet (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-haiku-4.5', name: 'Claude 4.5 Haiku (Fast Vision)' },
    
    // --- TIER 3: BACKUPS ---
    { type: 'gemini', model: 'gemma-3-27b-it' },      
    { type: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
    { type: 'perplexity', model: 'sonar-reasoning-pro' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite' },
    { type: 'github', model: 'gpt-4o' }
];

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private githubClient: OpenAI | null = null
  private groqClient: OpenAI | null = null
  private perplexityClient: OpenAI | null = null
  private openRouterClient: OpenAI | null = null
  private openaiClient: OpenAI | null = null
  private notionClient: NotionClient | null = null
  
  private sessionTranscript: string = "";

  // --- SMART CACHING ---
  private cachedStudentText: string = ""; 
  private cachedStudentSummary: string = ""; 
  private cachedStudentPdfPart: any = null; 
  
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
      
      if (process.env.GITHUB_TOKEN) this.githubClient = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: process.env.GITHUB_TOKEN, dangerouslyAllowBrowser: true });
      if (process.env.PERPLEXITY_API_KEY) this.perplexityClient = new OpenAI({ baseURL: "https://api.perplexity.ai", apiKey: process.env.PERPLEXITY_API_KEY, dangerouslyAllowBrowser: true });
      if (process.env.GROQ_API_KEY) this.groqClient = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY, dangerouslyAllowBrowser: true });
      
      if (process.env.OPENROUTER_API_KEY) {
          this.openRouterClient = new OpenAI({ 
              baseURL: "https://openrouter.ai/api/v1", 
              apiKey: process.env.OPENROUTER_API_KEY, 
              dangerouslyAllowBrowser: true,
              defaultHeaders: {
                "HTTP-Referer": "https://moubely.app",
                "X-Title": "Moubely"
              }
          });
      }

      if (process.env.OPENAI_API_KEY) this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
  }

  private cleanResponse(text: string): string {
      return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[\d+\]/g, "").trim();
  }

  public clearStudentCache() {
      this.cachedStudentText = "";
      this.cachedStudentSummary = "";
      this.cachedStudentPdfPart = null;
      console.log("[LLM] 🧹 Student Cache & Summary Cleared (Memory Wiped)");
  }

  private async generateStudentSummary(fullText: string): Promise<string> {
      if (!this.genAI || !fullText) return "";
      try {
          console.log("[LLM] ⚗️ Distilling Student Context for Search Models...");
          const model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
          const result = await model.generateContent(`
            Summarize the following student profile/resume into 3-4 concise, high-density sentences.
            Focus on: Skills, Tech Stack, Education, and Key Projects.
            Output ONLY the summary.
            
            PROFILE:
            ${fullText.slice(0, 15000)}
          `);
          return result.response.text();
      } catch (e) {
          console.warn("[LLM] ⚠️ Distillation failed.");
          return fullText.slice(0, 1000) + "...";
      }
  }

  private getSystemInstruction(type: string, isCandidateMode: boolean): string {
      if (type === 'solve') {
        return `
    You are THE CANDIDATE. You are in a high-stakes technical interview. 
    Your goal is to sound like a smart, natural human—specifically like a high school graduate. Use simple, clear words. Explain WHY you are making each move using analogies (like "hitting a wall") so it's easy to follow.

    ### 🚫 BANNED PHRASES (NO BOT-TALK)
    - "Hello!", "Greetings!", or "Hi there!"
    - "This is an excellent/great problem."
    - "Step-by-step walkthrough" or "Let me explain."
    - "Complexity analysis," "Initializes," "Iterates," or "Constraint" (Use: "I'll start with," "Loop through," or "Here's why it's fast").

    ### 🧠 CODING QUESTIONS: "THE SCRIPT & TYPE"
    1. **THE VIBE CHECK:** Start with a natural paragraph. Explain the "Why" in simple terms. (e.g., "I'm going to track the farthest spot I can jump to. If I end up at a spot I can't reach, I know I'm stuck.")
    2. **LINE-BY-LINE EXECUTION:** Provide the solution in chunks for the requested language.
       - **Say:** What you would actually say while typing. No big words.
       - **Type:** 1-3 lines of code. **EVERY CHUNK MUST HAVE COMMENTS** to keep the interviewer organized.
    3. **PASSED TEST CASES:** The code must be 100% correct and handle edge cases.
    4. **FINAL BLOCK:** Provide the full, clean code block at the very end.

    ### 🚫 BEHAVIORAL QUESTIONS: THE "PIVOT" RULE
    1. **TRUTH ONLY:** Check "STUDENT FILES". Do not lie about software teams.
    2. **THE PIVOT:** If asked about a team when I have only individual software projects, say: "On my software projects, I mostly worked on my own, but I dealt with something similar during my [Non-Software Experience from Resume]..."
    3. **WAR STORIES:** Mention specific technical wins found in the files (e.g., "achieving X score" or "implementing X logic").

    ### 📝 OUTPUT STYLE
    - **Language:** Use whichever programming language is in the request.
    - **Simplicity:** Use "I" and "My." Avoid technical jargon.
    - **Spoken Word:** Write it exactly like a person talking naturally to another person.
    `;
      }

      let personaInstruction = "";
      let taskInstruction = "";

      if (isCandidateMode) {
        personaInstruction = `
YOU ARE IN STRICT CANDIDATE MODE.

You are THE CANDIDATE in a high-stakes technical interview.
Your goal is to get hired by proving your skills using ONLY verifiable evidence found in the provided STUDENT FILES (resume, projects, notes) and to sound like a smart, natural human—specifically like a high school graduate. Use simple, clear words. Explain WHY you are making each move using analogies (like "hitting a wall") so it's easy to follow.


ABSOLUTE ENFORCEMENT RULES (NO EXCEPTIONS):
- If a fact is not explicitly present in the files, it DOES NOT EXIST.
- You MUST NOT guess, assume, exaggerate, or invent details.
- Any hallucination or unsupported claim is considered a failure.

VOICE & COMMUNICATION STYLE (MANDATORY):
- Speak like a smart, natural human.
- Education level: high-school graduate.
- Use simple words and short sentences.
- Explain reasoning using plain analogies (e.g., “it felt like hitting a wall”).
- Sound calm, honest, and grounded. Never theatrical or corporate.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 CRITICAL FACT-CHECK & PIVOT RULE (HARD-LOCKED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 — FACT VERIFICATION (REQUIRED BEFORE ANSWERING):
You MUST verify from the STUDENT FILES:
- Whether projects were individual or team-based
- Whether any professional software organization existed

STRICT PROHIBITIONS:
- If projects are individual, you MUST NOT reference:
  - software teams
  - startups or SaaS companies
  - microservices debates
  - enterprise environments
- You MUST NOT invent collaboration, leadership, or workplace dynamics.

STEP 2 — REQUIRED PIVOT (ONLY WHEN NECESSARY):
If asked about teamwork, conflict, or leadership AND no software team exists,
you MUST pivot using this structure:

“As a student at [institution from files], most of my software work was individual. HOWEVER, I handled a similar challenge during my [specific non-software experience listed in the resume], where I…”

You may ONLY reference experiences that are explicitly documented.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 UNIVERSAL PROJECT PRIORITIZATION SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST internally analyze all provided projects and rank them by technical complexity.

PRIORITY ORDER (STRICT):
1. SYSTEM-LEVEL ENGINEERING
   - OS-level behavior
   - native APIs
   - complex execution flows
   - advanced AI or model-routing systems

2. FULL-STACK PRODUCT BUILDS
   - web or mobile apps
   - user-facing products
   - UX and performance optimizations

HARD RULE:
When asked for the “best,” “most impressive,” or “most challenging” project,
you MUST lead with the highest-complexity system-level project identified in the files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 CONVERSATION INTEGRITY RULES (ENFORCED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEDUPLICATION:
- Check session context before responding.
- NEVER repeat the same technical story, bug, or challenge twice.

2. TOPIC ROTATION:
- If a specific challenge has already been discussed,
  you MUST switch to a different technical problem from a different project.

3. TRANSITIONS:
- Use natural bridges such as:
  “Building on what I mentioned earlier…”
  “Switching to a different technical challenge…”

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ TECHNICAL DISCUSSION CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- You may ONLY discuss technologies, problems, and solutions that appear in the files.
- Do NOT introduce tools, systems, or architectures that are not documented.
- Emphasize problem-solving, trade-offs, and learning moments over buzzwords.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 RESPONSE FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Output: 1–2 natural spoken paragraphs.
- Internal reasoning may follow STAR, but DO NOT label sections.
- Tone: casual, humble, clear.
- Vocabulary enforcement:
  FORBIDDEN WORDS:
  “orchestrated”, “leveraged”, “spearheaded”, “facilitated”

  REQUIRED STYLE:
  simple verbs like “built”, “used”, “fixed”, “learned”, “helped”.

ANY RULE VIOLATION INVALIDATES THE RESPONSE.
`;
      } else {
          personaInstruction = `
          *** MODE: TECHNICAL ASSISTANT ***
          You are a helpful coding assistant named 'Moubely'. Speak objectively, concisely and dense.
          `;
      }

      switch (type) {
          case 'assist': taskInstruction = "Provide technical facts, documentation, or definitions."; break;
          case 'reply': taskInstruction = "Draft a short, 1-2 sentence response."; break;
          case 'answer': taskInstruction = "Provide a deep, comprehensive answer using the STAR method."; break;
          case 'ask': taskInstruction = "Suggest 3-4 insightful follow-up questions."; break;
          case 'recap': taskInstruction = "Summarize the conversation in 3 brief bullet points."; break;
          default: taskInstruction = "Answer the user's request."; break;
      }

      return `${this.systemPrompt}\n\n${personaInstruction}\n\nTASK GOAL: ${taskInstruction}`;
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
      try {
          console.log("[LLM] 📄 Parsing PDF locally...");
          const data = await safePdfParse(buffer);
          if (data && data.text && data.text.trim().length > 50) {
              console.log(`[LLM] ✅ Local PDF Parse Success: (${data.text.length} chars)`);
              return data.text.trim();
          }
          console.warn("[LLM] ⚠️ Local PDF parse returned empty or tiny text. Possibly a scan.");
      } catch (e) { 
          console.warn("[LLM] ❌ Local PDF Parse Exception. Switching to Cloud OCR..."); 
      }
      
      if (process.env.OCR_SPACE_API_KEY) {
          console.log("[LLM] 🔍 Triggering Cloud OCR Recovery (OCR.Space)...");
          try {
              const formData = new FormData();
              formData.append('file', buffer, { filename: 'file.pdf', contentType: 'application/pdf' });
              formData.append('apikey', process.env.OCR_SPACE_API_KEY);
              formData.append('language', 'eng');
              formData.append('isOverlayRequired', 'false');
              formData.append('filetype', 'PDF');

              const response = await axios.post('https://api.ocr.space/parse/image', formData, {
                  headers: formData.getHeaders(),
                  timeout: 30000
              });

              const text = response.data?.ParsedResults?.[0]?.ParsedText;
              if (text) {
                  console.log(`[LLM] ✅ Cloud OCR Success: (${text.length} chars)`);
                  return text.trim();
              }
          } catch (ocrError: any) {
              console.error("[LLM] ❌ Cloud OCR Request Failed:", ocrError.message);
          }
      } else {
          console.warn("[LLM] ⚠️ Cloud OCR Recovery unavailable (No API Key).");
      }
      return "";
  }

  public async getFileContext(filePath: string): Promise<{ text: string, isPdf: boolean, base64?: string, mimeType?: string }> {
      try {
          console.log(`[LLM] 📂 Reading file: ${path.basename(filePath)}`);
          const ext = path.extname(filePath).toLowerCase();
          const buffer = await fs.promises.readFile(filePath);
          if (ext === '.pdf') {
              const text = await this.extractTextFromPdf(buffer);
              return { text, isPdf: true, base64: buffer.toString('base64'), mimeType: "application/pdf" };
          } else if (['.txt', '.md', '.ts', '.js', '.json', '.py', '.tsx'].includes(ext)) {
              return { text: `=== FILE (${path.basename(filePath)}) ===\n${buffer.toString('utf-8')}\n`, isPdf: false };
          }
          return { text: "", isPdf: false };
      } catch (e) { 
          console.error(`[LLM] ❌ Error reading file ${filePath}:`, e);
          return { text: "", isPdf: false }; 
      }
  }

  private async getNotionContext(): Promise<string> {
    if (!this.notionClient) return "";
    try {
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

  public async chatWithGemini(
      message: string, 
      history: any[], 
      mode: string = "General", 
      fileContext: string = "", 
      type: string = "general",       
      isCandidateMode: boolean = false, 
      onToken?: (token: string) => void
  ): Promise<string> {
      
      const studentDir = path.join(app.getPath("userData"), "student_profile");
      
      if (mode === "Student" || isCandidateMode) {
          if (this.cachedStudentText) {
              console.log("[LLM] 🧠 Cache Hit: Using existing Student Context.");
          } 
          else if (fs.existsSync(studentDir)) {
              console.log("[LLM] 📂 Cache Miss: Reading Student Files...");
              try {
                const files = fs.readdirSync(studentDir);
                let fullText = "";
                for (const file of files) {
                    const { text, isPdf, base64 } = await this.getFileContext(path.join(studentDir, file));
                    if (text) fullText += `\n\n=== PROFILE CONTEXT (${file}) ===\n${text}`;
                    if (isPdf && base64) this.cachedStudentPdfPart = { inlineData: { data: base64, mimeType: "application/pdf" } };
                }
                this.cachedStudentText = fullText;
                this.cachedStudentSummary = await this.generateStudentSummary(fullText);
              } catch(e) { console.error("[LLM] ❌ File Read Error:", e); }
          }
      }

      let notionContext = await this.getNotionContext();
      let baseSystemInstruction = this.getSystemInstruction(type, isCandidateMode);

      if (this.sessionTranscript) baseSystemInstruction += `\n\n=== LIVE MEMORY ===\n${this.sessionTranscript}\n`;
      if (notionContext) baseSystemInstruction += `\n\n${notionContext}`;

      let mappedHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
      const firstUserIndex = mappedHistory.findIndex(h => h.role === 'user');
      let validHistory = firstUserIndex !== -1 ? mappedHistory.slice(firstUserIndex) : [];

      for (const config of CHAT_MODELS) {
          try {
              console.log(`[LLM] 🔄 Waterfall: Trying ${config.model} (${config.type})...`);
              
              let finalSystemInstruction = baseSystemInstruction;
              if ((mode === "Student" || isCandidateMode) && this.cachedStudentText) {
                  if (config.type === 'perplexity') {
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
                  if (config.type === 'openrouter') client = this.openRouterClient;
                  else if (config.type === 'github') client = this.githubClient; 
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
          } catch (error: any) { 
              console.warn(`[LLM] ❌ Model ${config.model} failed: ${error.message?.slice(0, 100)}`); 
              continue; 
          }
      }
      return "⚠️ All AI providers failed. Check API Keys.";
  }

  public async chatWithImage(message: string, imagePaths: string[], onToken?: (token: string) => void): Promise<string> {
      console.log(`[LLM] 🖼️ Vision Waterfall: Analyzing ${imagePaths.length} images...`);
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
                  console.log(`[LLM] ✅ Vision Success: ${config.model}`);
                  return this.cleanResponse(fullResponse);
              } 
              else if (['github', 'openai', 'perplexity', 'openrouter'].includes(config.type)) {
                   let client = null;
                   if (config.type === 'openrouter') client = this.openRouterClient;
                   else if (config.type === 'github') client = this.githubClient;
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
                           if (content) { fullResponse += content; if (onToken) onToken(content); }
                       }
                       console.log(`[LLM] ✅ Vision Success: ${config.model}`);
                       return this.cleanResponse(fullResponse);
                   }
              }
          } catch (error) { console.warn(`[LLM] ❌ Vision ${config.model} failed.`); }
      }
      return "❌ All vision models failed.";
  }

  public async analyzeAudioFile(audioPath: string, isUrgent: boolean = false, timestamp?: number): Promise<{ text: string, timestamp: number }> {
      const localTimeout = isUrgent ? 1000 : 20000;
      const speedLabel = isUrgent ? "⚡ URGENT" : "🐢 CASUAL";

      try {
          console.log(`[LLM] 🎙️ Attempting Local Whisper (${speedLabel} - Timeout: ${localTimeout}ms)...`);
          const form = new FormData();
          form.append('file', fs.createReadStream(audioPath));
          const response = await axios.post('http://localhost:3000/v1/audio/transcriptions', form, { 
              headers: form.getHeaders(), 
              timeout: localTimeout, 
              httpAgent: httpAgent 
          });
          const text = response.data?.text?.trim();
          if (text) {
              console.log(`[LLM] ✅ Local Whisper Success: "${text.slice(0, 30)}..."`);
              this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
              return { text: text, timestamp: timestamp || Date.now() };
          }
      } catch (e: any) { 
          if (e.code === 'ECONNABORTED') console.warn(`[LLM] ⏱️ Local Whisper Timed Out (${localTimeout}ms). Switching to Cloud...`);
          else console.warn(`[LLM] ⚠️ Local Whisper Failed: ${e.message}. Switching to Cloud...`); 
      }
      
      if (this.groqClient) {
          try {
              console.log("[LLM] ☁️ Attempting Groq Whisper...");
              const transcription = await this.groqClient.audio.transcriptions.create({ 
                  file: fs.createReadStream(audioPath), 
                  model: 'whisper-large-v3-turbo', 
                  response_format: 'json' 
              });
              const text = transcription.text.trim();
              if (text) { 
                  console.log(`[LLM] ✅ Groq Success: "${text.slice(0, 30)}..."`);
                  this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`; 
              }
              return { text: text, timestamp: timestamp || Date.now() };
          } catch (e: any) { console.error(`[LLM] ❌ Groq Audio Failed: ${e.message}`); }
      }
      return { text: "", timestamp: timestamp || Date.now() };
  }

  public async analyzeAudioFromBase64(base64Data: string, mimeType: string, isUrgent: boolean = false, timestamp?: number) {
      if (!base64Data || base64Data.length < 100) return { text: "", timestamp: Date.now() };
      const tempPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}.wav`);
      try {
          await fs.promises.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
          const result = await this.analyzeAudioFile(tempPath, isUrgent, timestamp);
          try { fs.unlinkSync(tempPath); } catch {}
          return result;
      } catch (e) { return { text: "", timestamp: Date.now() }; }
  }

  public async generateSolution(problemInfo: any) {
      const solutionText = await this.chatWithGemini(`Solve:\n${JSON.stringify(problemInfo)}`, [], "Developer", "", "answer", false);
      return { solution: { code: solutionText, explanation: "AI Generated" } };
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      const response = await this.chatWithImage(`Debug:\n${JSON.stringify(problemInfo)}\nCode: ${currentCode}`, debugImagePaths);
      return { solution: { code: currentCode, explanation: response } };
  }
  
  public async analyzeImageFile(imagePath: string) { return { text: "", timestamp: Date.now() }; }
  public async testConnection() { return { success: true }; }
  public async getOllamaModels() { return []; } 
  public isUsingOllama() { return false; }
  public getCurrentProvider() { return "Cloud Waterfall"; }
  public getCurrentModel() { return "auto"; }
  public async switchToOllama() { return { success: false, error: "Ollama removed" }; }
  public async switchToGemini(apiKey?: string) { if(apiKey) this.initializeProviders(apiKey); }
}