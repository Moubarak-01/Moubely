import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import path from "path"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"

interface OllamaResponse {
  response: string
  done: boolean
}

export class LLMHelper {
  private genAI: GoogleGenerativeAI | null = null
  private model: GenerativeModel | null = null
  private readonly systemPrompt = `You are a dedicated Speech-to-Text engine.`
  
  // Providers
  private useOllama: boolean = false
  private ollamaModel: string = "llama3.2"
  private ollamaUrl: string = "http://localhost:11434"
  private githubToken: string | null = null
  private groqApiKey: string | null = null

  // Gemini Model Priority List (Fallback)
  private readonly geminiModels = [
    "gemini-1.5-flash-8b",       // Fast & High Quota
    "gemini-1.5-flash",          
    "gemini-1.5-pro"            
  ]

  constructor(apiKey?: string, useOllama: boolean = false, ollamaModel?: string, ollamaUrl?: string) {
    this.useOllama = useOllama
    
    // Load Keys from Env
    this.githubToken = process.env.GITHUB_TOKEN || null;
    this.groqApiKey = process.env.GROQ_API_KEY || null;

    if (useOllama) {
      this.ollamaUrl = ollamaUrl || "http://localhost:11434"
      this.ollamaModel = ollamaModel || "gemma:latest"
      console.log(`[LLMHelper] Using Ollama with model: ${this.ollamaModel}`)
      this.initializeOllamaModel()
    } else {
      // Initialize Gemini (Fallback)
      if (apiKey) {
          this.genAI = new GoogleGenerativeAI(apiKey)
          this.model = this.genAI.getGenerativeModel({ model: this.geminiModels[0] })
          console.log("[LLMHelper] Gemini Initialized (Fallback System)")
      }
      
      if (this.groqApiKey) console.log("[LLMHelper] Groq API detected. Active for Speech-to-Text.");
      if (this.githubToken) console.log("[LLMHelper] GitHub Token detected. Active for Chat.");
    }
  }

  // --- SPECIALIZED: GROQ WHISPER (Speech-to-Text) ---
  private async callGroqWhisper(audioBuffer: Buffer): Promise<string> {
      if (!this.groqApiKey) throw new Error("No Groq API Key");

      try {
          const form = new FormData();
          form.append("file", audioBuffer, { filename: 'audio.wav', contentType: 'audio/wav' });
          form.append("model", "whisper-large-v3"); // Groq's super-fast Whisper model
          form.append("response_format", "json");

          const response = await axios.post("https://api.groq.com/openai/v1/audio/transcriptions", form, {
              headers: {
                  ...form.getHeaders(),
                  "Authorization": `Bearer ${this.groqApiKey}`
              }
          });

          return response.data.text;
      } catch (error: any) {
          console.error("[LLMHelper] Groq Whisper failed:", error?.response?.data || error.message);
          throw error;
      }
  }

  // --- PRIMARY: GITHUB MODELS (Chat) ---
  private async callGithub(messages: any[]) {
    if (!this.githubToken) throw new Error("No GitHub Token provided.");
    
    try {
      const response = await axios.post("https://models.inference.ai.azure.com/chat/completions", {
            messages: messages,
            model: "gpt-4o-mini",
            temperature: 0.7,
            max_tokens: 4096
        }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.githubToken}`
        }
      });

      return {
          response: {
              text: () => response.data.choices[0].message.content
          }
      };
    } catch (error: any) {
        throw new Error(`GitHub API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
    }
  }

  // --- FALLBACK: GEMINI ---
  private async callGeminiFallback(params: any) {
    if (!this.genAI) throw new Error("Gemini not configured for fallback");

    for (const modelName of this.geminiModels) {
        try {
            const currentModel = this.genAI.getGenerativeModel({ model: modelName });
            const finalParams = Array.isArray(params) ? params : [params];
            const result = await currentModel.generateContent(finalParams);
            this.model = currentModel;
            return result;
        } catch (error: any) {
            if (error.message.includes("429") || error.message.includes("404")) continue;
            console.warn(`[LLMHelper] Gemini ${modelName} failed:`, error.message);
        }
    }
    throw new Error("All Gemini fallback models failed.");
  }

  // --- AUDIO ANALYSIS (Groq -> Gemini Fallback) ---
  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    if (!data || data.length < 100) return { text: "", timestamp: Date.now() };

    let text = "";
    
    // 1. Try Groq (Whisper)
    if (this.groqApiKey) {
        try {
            const audioBuffer = Buffer.from(data, 'base64');
            text = await this.callGroqWhisper(audioBuffer);
            return { text: text.trim(), timestamp: Date.now() };
        } catch (e) {
            console.warn("[LLMHelper] Groq failed, trying Gemini fallback...");
        }
    }

    // 2. Fallback to Gemini (Multimodal)
    try {
        const audioPart = { inlineData: { data, mimeType } };
        const prompt = `Transcribe the speech verbatim. Return ONLY spoken words.`;
        
        if (this.useOllama) {
             // Ollama audio support is limited, return empty or handle differently
             text = "";
        } else {
             const result = await this.callGeminiFallback([prompt, audioPart]);
             text = typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text;
        }
    } catch (error) {
        console.error("All audio providers failed:", error);
    }

    return { text: text?.trim() || "", timestamp: Date.now() };
  }

  public async analyzeAudioFile(audioPath: string) {
      // 1. Try Groq
      if (this.groqApiKey) {
          try {
              const buffer = await fs.promises.readFile(audioPath);
              const text = await this.callGroqWhisper(buffer);
              return { text: text.trim(), timestamp: Date.now() };
          } catch (e) { console.warn("Groq file analysis failed, fallback..."); }
      }

      // 2. Fallback Gemini
      try {
        const audioData = await fs.promises.readFile(audioPath);
        const audioPart = { inlineData: { data: audioData.toString("base64"), mimeType: "audio/mp3" } };
        const prompt = `Transcribe the speech verbatim.`;
        const result = await this.callGeminiFallback([prompt, audioPart]);
        const text = typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text;
        return { text, timestamp: Date.now() };
      } catch (e) { throw e; }
  }

  // --- CHAT (GitHub -> Gemini Fallback) ---
  public async chatWithGemini(message: string, history: any[] = [], mode: string = "General"): Promise<string> {
      let systemInstruction = this.systemPrompt;

      if (mode === "Student") {
          const studentFiles = this.getStudentFiles();
          systemInstruction = `
You are an expert Career and Computer Science Mentor.
You have access to the user's uploaded profile files (Resume, Projects) below:${studentFiles ? `# ====== USER PROFILE / RESUME ======\n${studentFiles}\n# ===========================` : ""}

**YOUR INSTRUCTION:**
Analyze the user's question and classify it as either **TECHNICAL** or **BEHAVIORAL**.

### 1. IF THE QUESTION IS TECHNICAL / CODING:
- Act as a Tutor.
- **Do not give the answer immediately.**
- Ask: "Do you want a **Hint (Idea)**, a **Brute Force Approach**, or the **Optimal Solution**?"

### 2. IF THE QUESTION IS BEHAVIORAL / SOFT SKILLS:
- **DRAFT AN ANSWER DIRECTLY** for the user.
- **CRITICAL:** Use the **USER PROFILE** content above to personalize the answer.
- Structure the answer using the **STAR Method**.

Current User Question:${message}
`;
      }

      if (this.useOllama) return this.callOllama(`${systemInstruction}\nUser: ${message}`);
      
      const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n\n');
      const fullPrompt = `${systemInstruction}\n\n=== CHAT HISTORY ===\n${historyText}\n\n=== CURRENT MESSAGE ===\nUser: ${message}`;

      // 1. Try GitHub (Text Chat)
      if (this.githubToken) {
          try {
               let messages = [{ role: "system", content: systemInstruction }];
               // Add simplified history if needed, or just full prompt logic
               messages.push({ role: "user", content: `History:\n${historyText}\n\nCurrent:\n${message}`});
               
               const result = await this.callGithub(messages);
               return result.response.text();
          } catch (e: any) {
              console.warn(`GitHub Chat failed: ${e.message}. Switching to Gemini...`);
          }
      }

      // 2. Fallback Gemini
      try {
          const result = await this.callGeminiFallback(fullPrompt);
          return typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text;
      } catch (error: any) {
          return `⚠️ Error: All AI providers failed.\nDetails: ${error.message}`;
      }
  }

  // --- IMAGES (Gemini Only - GitHub 4o-mini supports it but format is complex, staying safe with Gemini) ---
  public async analyzeImageFile(imagePath: string) {
      try {
        const imageData = await fs.promises.readFile(imagePath);
        const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } };
        const prompt = `Describe this image concisely.`;
        const result = await this.callGeminiFallback([prompt, imagePart]);
        const text = typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text;
        return { text, timestamp: Date.now() };
      } catch (e) { throw e; }
  }
  
  public async chatWithImage(message: string, imagePath: string) {
      const imageData = await fs.promises.readFile(imagePath);
      const imagePart = { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } };
      const prompt = `User Question: "${message}"\nAnswer based on the image.`;
      const result = await this.callGeminiFallback([prompt, imagePart]);
      return typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text;
  }

  // --- UTILS ---
  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return { inlineData: { data: imageData.toString("base64"), mimeType: "image/png" } }
  }

  private cleanJsonResponse(text: string): string {
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    text = text.trim();
    return text;
  }

  // --- OLLAMA METHODS (Unchanged) ---
  private async callOllama(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.ollamaModel, prompt: prompt, stream: false, options: { temperature: 0.7 } }),
      })
      if (!response.ok) throw new Error(`Ollama API error: ${response.status}`)
      const data: OllamaResponse = await response.json()
      return data.response
    } catch (error: any) { throw new Error(`Failed to connect to Ollama: ${error.message}`) }
  }

  private async checkOllamaAvailable(): Promise<boolean> {
    try { const response = await fetch(`${this.ollamaUrl}/api/tags`); return response.ok } catch { return false }
  }

  private async initializeOllamaModel(): Promise<void> {
    try {
      const availableModels = await this.getOllamaModels()
      if (availableModels.length === 0) return
      if (!availableModels.includes(this.ollamaModel)) { this.ollamaModel = availableModels[0] }
      await this.callOllama("Hello")
    } catch (error: any) { console.error(`[LLMHelper] Failed to initialize Ollama model: ${error.message}`) }
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
  
  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      const prompt = `Analyze these images and extract problem info JSON.`;
      const result = await this.callGeminiFallback([prompt, ...imageParts])
      return JSON.parse(this.cleanJsonResponse(typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text))
    } catch (error) { throw error }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nSolve this:\n${JSON.stringify(problemInfo, null, 2)}`;
    try {
      // Prefer GitHub for Logic/Code Generation if available
      if (this.githubToken) {
          try {
              const result = await this.callGithub([{role: "user", content: prompt}]);
              return JSON.parse(this.cleanJsonResponse(result.response.text()));
          } catch(e) { console.warn("GitHub solution gen failed, using Gemini..."); }
      }
      const result = await this.callGeminiFallback(prompt)
      return JSON.parse(this.cleanJsonResponse(typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text))
    } catch (error) { throw error; }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
      // Must use Gemini for Image Analysis
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      const prompt = `Debug this solution given images.`;
      const result = await this.callGeminiFallback([prompt, ...imageParts])
      return JSON.parse(this.cleanJsonResponse(typeof result.response.text === 'function' ? result.response.text() : (result.response as any).text))
  }

  public isUsingOllama() { return this.useOllama; }
  public getCurrentProvider() { return this.useOllama ? "ollama" : (this.githubToken ? "github+groq" : "gemini"); }
  public getCurrentModel() { return this.useOllama ? this.ollamaModel : "hybrid"; }
  public async getOllamaModels() { if (!this.useOllama) return []; try { const r = await fetch(`${this.ollamaUrl}/api/tags`); const d = await r.json(); return d.models?.map((m: any) => m.name) || []; } catch { return [] } } 
  
  public async switchToOllama(model?: string, url?: string) { this.useOllama = true; if(url) this.ollamaUrl=url; if(model) this.ollamaModel=model; else await this.initializeOllamaModel(); }
  public async switchToGemini(apiKey?: string) { if(apiKey) { this.genAI = new GoogleGenerativeAI(apiKey); this.model = this.genAI.getGenerativeModel({ model: this.geminiModels[0] }); } this.useOllama = false; }
  public async testConnection() { 
      try { 
        if(this.useOllama) { await this.checkOllamaAvailable(); return {success:true}; } 
        // Test primary chain
        if (this.groqApiKey) await this.callGroqWhisper(Buffer.from("UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "base64")); // tiny wav header
        else if (this.githubToken) await this.callGithub([{role:"user", content:"hi"}]);
        else await this.callGeminiFallback("hi");
        return {success:true}; 
      } catch(e:any) { return {success:false, error:e.message}; } 
  }
}