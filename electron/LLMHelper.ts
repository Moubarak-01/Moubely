import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import path from "path"
import { app } from "electron" 

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

  private getStudentFiles(): string {
    const dir = path.join(app.getPath("userData"), "student_profile");
    if (!fs.existsSync(dir)) return "";

    const files = fs.readdirSync(dir)
      .filter(name => name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".pdf") || name.endsWith(".ts") || name.endsWith(".js"));

    let content = "";
    for (const file of files) {
        try {
            const filePath = path.join(dir, file);
            const fileContent = fs.readFileSync(filePath, "utf8");
            content += `\n\n# FILE: ${file}\n${fileContent}\n`;
        } catch(e) { console.error(`Error reading ${file}`, e)}
    }
    return content;
  }

  // --- AUDIO TRANSCRIPTION ---
  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    if (!data || data.length < 100) {
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
2. Do NOT add labels like "Speaker" or timestamps.
3. If there is no distinct speech, return nothing (empty string).
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

  // UPDATE: Accept history argument
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
(e.g., "Reverse a string", "How does Garbage Collection work?", "Time complexity of BFS")
- Act as a Tutor.
- **Do not give the answer immediately.**
- Ask: "Do you want a **Hint (Idea)**, a **Brute Force Approach**, or the **Optimal Solution**?"
- Wait for their choice. (Exception: If they already asked for "Optimal", give it).

### 2. IF THE QUESTION IS BEHAVIORAL / SOFT SKILLS:
(e.g., "Tell me about a time you failed", "What is your greatest weakness?", "Describe a conflict you resolved")
- **DO NOT** ask for hints or brute force.
- **DRAFT AN ANSWER DIRECTLY** for the user.
- **CRITICAL:** You MUST use the **USER PROFILE** content above to personalize the answer.
- Find a specific project or experience from their files that fits the question.
- Structure the answer using the **STAR Method** (Situation, Task, Action, Result).
- If you cannot find a relevant experience in the files, provide a generic template but explicitly tell the user: "I couldn't find a specific example of [topic] in your uploaded files, but here is how you should structure it..."

Current User Question:${message}
`;
      }

      // Format history into a string
      const historyText = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n\n');

      // Construct full prompt with history
      const fullPrompt = `${systemInstruction}\n\n=== CHAT HISTORY ===\n${historyText}\n\n=== CURRENT MESSAGE ===\nUser: ${message}`;

      if (this.useOllama) return this.callOllama(fullPrompt);
      if (this.model) return (await this.model.generateContent(fullPrompt)).response.text();
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