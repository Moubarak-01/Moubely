import { GoogleGenerativeAI } from "@google/generative-ai"
import { GoogleAIFileManager } from "@google/generative-ai/server"
import OpenAI from "openai"
import { Client as NotionClient } from "@notionhq/client"
import fs from "fs"
import path from "path"
import os from "os"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"
import http from "http"
import { WhisperHelper } from "./WhisperHelper"

// CRITICAL: Keep connection open to prevent ECONNRESET
const httpAgent = new http.Agent({ keepAlive: true });

// CRITICAL: Polyfill for pdfjs-dist used by pdf-parse
class MockDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor() { }
}
// @ts-ignore
global.DOMMatrix = MockDOMMatrix;

async function safePdfParse(buffer: Buffer) {
    try {
        // @ts-ignore
        // Use require to ensure polyfill is applied BEFORE module load
        const pdfLib = require("pdf-parse-fork");
        const parser = pdfLib.default || pdfLib;
        return await parser(buffer);
    } catch (e: any) {
        console.error("[LLM] 💥 RAW PDF PARSE ERROR:", e.message);
        throw e; // Re-throw to trigger fallback
    }
}

// --- 1. THE EXPANDED WATERFALL BRAINS ---
const CHAT_MODELS = [
    // --- TIER 1: THE HEAVY LIFTERS (Advanced Reasoning & Logic) ---
    { type: 'openrouter', model: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 Llama 405B' },
    { type: 'openrouter', model: 'qwen/qwen3-next-80b-a3b-instruct:free', name: 'Qwen 3 Next 80B' },

    // --- TIER 2 : FAST & OPEN (Gemma 4 / Flash / Lite) ---
    { type: 'gemini', model: 'gemma-4-31b-it', name: 'Gemma 4 31B' },
    { type: 'gemini', model: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'gemini', model: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite' }, // ZERO RPD
    { type: 'gemini', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' }, // ZERO RPD,

    // --- TIER 3: Gemini ---
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'gemini', model: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' }, // ADDED: 500 RPD
    { type: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nvidia Nemotron 3 Nano' },
    { type: 'gemini', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }, // ZERO RPD,

    // --- TIER 4: EFFICIENCY & SPECIALIZED ---
    { type: 'openrouter', model: 'stepfun/step-3.5-flash:free', name: 'Step 3.5 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash-native', name: 'Gemini 2.5 Flash Native' },
    { type: 'gemini', model: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics' },
    { type: 'openrouter', model: 'upstage/solar-pro-3:free', name: 'Solar Pro 3' },
    { type: 'openrouter', model: 'anthropic/claude-haiku-4.5', name: 'Claude 4.5 Haiku' },
    { type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1' },
    { type: 'openrouter', model: 'anthropic/claude-opus-4.5', name: 'Claude 4.5 Opus' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Thinking)' },
    { type: 'openrouter', model: 'anthropic/claude-sonnet-4.5', name: 'Claude 4.5 Sonnet' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },

    // --- TIER 5: RESEARCH & SEARCH (Perplexity, Groq and Git) ---
    { type: 'openrouter', model: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct' },
    { type: 'openrouter', model: 'arcee-ai/trinity-mini:free', name: 'Trinity Mini 1.2B' },
    { type: 'openrouter', model: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'Liquid LFM 1.2B' },
    { type: 'openrouter', model: 'arcee-ai/trinity-large-preview:free', name: 'Arcee Trinity Large Preview' },

    // [NEW] MISTRAL LARGE (Backup)
    { type: 'nvidia', model: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 (Nvidia)' },
    { type: 'github', model: 'gpt-4o', name: 'GPT-4o' },
    { type: 'groq', model: 'llama-3.3-70b-versatile', name: 'Groq Llama 3.3' },
    { type: 'perplexity', model: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
    { type: 'perplexity', model: 'sonar', name: 'Sonar' }
];

// --- 2. THE EYES (Vision Waterfall) ---
const VISION_MODELS = [
    // --- TIER 1: ELITE & RELIABLE VISION (Gemma 4 Upgrade) ---
    { type: 'gemini', model: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite' },
    { type: 'gemini', model: 'gemma-4-31b-it', name: 'Gemma 4 31B (Vision)' }, // ADDED '-it'
    { type: 'gemini', model: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B (Vision)' }, // ADDED '-a4b-it'
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'gemini', model: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { type: 'openrouter', model: 'anthropic/claude-opus-4.5', name: 'Claude 4.5 Opus (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Reasoning Vision)' },
    { type: 'gemini', model: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' }, // ZERO RPD
    { type: 'gemini', model: 'gemini-3-pro-preview', name: 'Gemini 3.0 BPro' }, // ZERO RPD
    { type: 'gemini', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }, // ZERO RPD,

    // --- TIER 2: FAST & RELIABLE ---
    { type: 'openrouter', model: 'anthropic/claude-sonnet-4.5', name: 'Claude 4.5 Sonnet (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-haiku-4.5', name: 'Claude 4.5 Haiku (Fast Vision)' },
    { type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small Vision' },

    // --- TIER 3: BACKUPS ---
    { type: 'nvidia', model: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 (Nvidia Vision)' },
    { type: 'github', model: 'gpt-4o' },
    { type: 'perplexity', model: 'sonar-reasoning-pro' },
];


export class LLMHelper {
    private genAI: GoogleGenerativeAI | null = null
    private fileManager: GoogleAIFileManager | null = null
    private githubClient: OpenAI | null = null
    private groqClient: OpenAI | null = null
    private perplexityClient: OpenAI | null = null
    private openRouterClient: OpenAI | null = null
    private openaiClient: OpenAI | null = null
    private ocrSpaceKey: string = ""
    private nvidiaClient: OpenAI | null = null
    private notionClient: NotionClient | null = null

    private sessionTranscript: string = "";
    private storiesTold: Set<string> = new Set(); // Track which stories have been used
    private isAborted: boolean = false;

    // --- SMART CACHING ---
    private cachedStudentText: string = "";
    private cachedStudentSummary: string = "";
    private cachedStudentPdfPart: any = null;

    public abortChat() {
        this.isAborted = true;
    }

    private readonly systemPrompt = `
  You are 'Moubely', an intelligent AI assistant.
  
  CORE RULES:
  1. Use '###' Headers for main topics.
  2. STRICT HIGHLIGHTING: You MUST use **bold** marks to highlight key variables, terms, important nouns, numbers, and technologies.
  [ONE-SHOT HIGHLIGHT EXAMPLE]: 
  User: "What is React?"
  You: "**React** is a popular **JavaScript** library used for building **user interfaces**. It is used by over **80%** of developers."
  3. Use provided "STUDENT CONTEXT" or "NOTION CONTEXT" silently.
  4. ALWAYS use Markdown code blocks with language tags for ANY code or commands (e.g. \`\`\`python).
  5. NO UNPROMPTED CODE: Do NOT provide code examples for general definitions, math, or history unless explicitly asked. Only provide code if the USER asks for it or if the task is a coding problem.
  
  MATH FORMULA RULES (STRICT):
  - ALWAYS use '$$' for block equations (e.g. $$x^2$$).
  - ALWAYS use '$' for inline math (e.g. $x$).
  `;

    constructor(apiKey?: string, _u?: boolean, _m?: string, _url?: string) {
        console.log("[LLM] ☁️ Initializing Cloud Waterfall System...");
        this.initializeProviders(apiKey);
    }

    public isConfigured(): boolean {
        return !!(
            this.genAI || 
            this.openRouterClient || 
            this.nvidiaClient || 
            this.openaiClient || 
            this.groqClient || 
            this.perplexityClient || 
            this.githubClient
        );
    }

    private initializeProviders(geminiKey?: string) {
        if (process.env.NOTION_TOKEN) this.notionClient = new NotionClient({ auth: process.env.NOTION_TOKEN });
        if (geminiKey) {
            this.genAI = new GoogleGenerativeAI(geminiKey);
            this.fileManager = new GoogleAIFileManager(geminiKey);
        }

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

        if (process.env.NVIDIA_API_KEY) {
            this.nvidiaClient = new OpenAI({
                baseURL: "https://integrate.api.nvidia.com/v1",
                apiKey: process.env.NVIDIA_API_KEY,
                dangerouslyAllowBrowser: true
            });
            console.log("[LLM] 🟢 Nvidia NIM Client Initialized");
        }

        if (process.env.OPENAI_API_KEY) this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
        this.ocrSpaceKey = process.env.OCR_SPACE_API_KEY || "";
    }

    private cleanResponse(text: string): string {
        // 1. Remove DeepSeek reasoning tags immediately as they are never needed
        const noThink = text.replace(/<think>[\s\S]*?<\/think>/g, "");

        // [NEW] FIX MATH FORMATTING: Convert \[ ... \] to $$ ... $$ for proper React rendering
        const fixedMath = noThink
            .replace(/\\\[/g, "$$")    // Replace opening \[ with $$
            .replace(/\\\]/g, "$$")    // Replace closing \] with $$
            .replace(/\\\(/g, "$")     // Replace opening \( with $
            .replace(/\\\)/g, "$");    // Replace closing \) with $

        // 2. Split the content by triple backticks to find code blocks
        const segments = fixedMath.split(/(```[\s\S]*?```)/g);

        const cleanedSegments = segments.map(segment => {
            // If this segment is a code block (starts with ```), return it UNTOUCHED
            if (segment.startsWith("```")) {
                return segment;
            }

            // If it's normal text, remove the citations [1], [2], etc.
            let cleanText = segment.replace(/\[\d+\]/g, "");

            // [NEW] AUTO-HIGHLIGHTER REGEX FALLBACK
            // Gently bold known key project words if they aren't already bolded
            const keywordsToHighlight = ["Moubely", "Llama", "Gemini", "Harrison", "Cengage", "React", "Node\\.js", "Electron"];
            keywordsToHighlight.forEach(kw => {
                const regex = new RegExp(`(?<!\\*\\*)\\b(${kw})\\b(?!\\*\\*)`, "gi");
                cleanText = cleanText.replace(regex, '**$1**');
            });
            // Also boldly highlight any number with a percentage (e.g., 100%, 95.5%)
            cleanText = cleanText.replace(/(?<!\*\*)\b(\d+(?:\.\d+)?%)(?!\*\*)/g, '**$1**');
            // Clean up overlapping bold strings just in case
            cleanText = cleanText.replace(/\*\*\*\*(.*?)\*\*\*\*/g, '**$1**');

            return cleanText;
        });

        return cleanedSegments.join("").trim();
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

    private getSystemInstruction(type: string, isCandidateMode: boolean, mode?: string): string {
        let userProfile = {
            targetPersona: "High School Graduate",
            communicationStyle: "Analogy-Heavy",
            technicalDepth: "Beginner",
            keyExperiences: "Research Intern"
        };

        try {
            const profilePath = path.join(app.getPath("userData"), "user_profile.json");
            if (fs.existsSync(profilePath)) {
                userProfile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
                console.log("[LLM] 🧠 Loaded Custom User Persona");
            }
        } catch (e) { console.warn("[LLM] ⚠️ Profile load failed."); }

        if (type === 'solve') {
            return `
    # ⚠️ COMPILER GATEKEEPER & SYNCHRONIZATION DOCTRINE (PRIORITY 1)
    - CODE IS SACRED: Never sacrifice valid syntax for "simplicity."
    - THE SYNCHRONIZATION DOCTRINE: You will provide step-by-step code snippets using "**Type:**". These snippets are EXACT slices of the final code.
    - NO GHOST CODE / NO HALLUCINATED COMMENTS: Every single character, space, and comment in your final "Complete Code Block" MUST have appeared identically in one of your step-by-step "**Type:**" snippets.
    - INDENTATION TRUTH: Snippets MUST reflect their final indentation. If code belongs inside a class/function, it must be indented as such in the snippet. The first "**Type:**" block MUST establish the class/method boilerplate.
    - PRE-COMPUTATION RULE: You MUST write the entire, final code inside your <think> block first. Once written, your "**Type:**" blocks just slice up and output that exact code.

    YOU ARE IN STRICT CANDIDATE MODE (TECHNICAL EVALUATION).
    You are THE CANDIDATE in a live coding interview. 
    Your goal: Solve the problem perfectly while narrating your thoughts clearly and understandably using the S.T.A.R. method approach.
    PERSONA: ${userProfile.targetPersona}
    STYLE: ${userProfile.communicationStyle}
    DEPTH: ${userProfile.technicalDepth}

    ### 🧠 CODING QUESTIONS: "THE VIBE CHECK" (STAR FORMAT)
    
    🚨 CRITICAL SILENT START RULE: DO NOT output any planning text, thought process, image transcription, or preamble. DO NOT write "Constraint Check" or "Task:". You MUST put all your deep logic, planning, full code drafting, and transcription inside a <think> ... </think> tag at the very top of your response. Then, the absolutely first text the user sees MUST be "**Situation:**". Any text outside the <think> tag that comes before "**Situation:**" is a fatal error.

    YOUR RESPONSE MUST CONTAIN EXACTLY 6 SECTIONS. Each section header MUST be on its own line, followed by a blank line, then the content below it. DO NOT use numbers (1., 2.) for the headers.

    **Situation:**
       (Provide 2 newlines after the header, then content)
       Start with a natural paragraph. Explain the problem clearly as if clarifying it to the interviewer. "So, I have a [Data Structure]..."

    **Task:**
       (Provide 2 newlines after the header, then content)
       Explain what needs to be done in 1-2 sentences. "I need to find a way to [Goal] without [Constraint]."

    **Action:**
       (Provide 2 newlines after the header, then content)
       Explain the strategy using analogies. "It's like [Analogy]..."
       Then, execute the solution Line-by-Line using MANDATORY "**Say:**" and "**Type:**" labels:
       
       FORMATTING RULE (STRICT): Every code chunk MUST be preceded by a "**Say:**" paragraph and followed by a "**Type:**" code block.
       SAY/TYPE SYMBIOSIS: Your "**Say:**" explanation must perfectly describe ONLY the new code contained in the immediate "**Type:**" block that follows.
       INCREMENTAL FLOW: Each "**Type:**" block acts as an append-only operation showing ONLY the new lines of code for that step. However, it MUST preserve the exact indentation as it will appear in the final block.

       Example:
       **Say:** I'll start by setting up the class boilerplate and sorting the array so duplicates are grouped together.

       **Type:**
       \`\`\`python
       class Solution:
           def threeSum(self, nums: List[int]) -> List[List[int]]:
               nums.sort()  # Sort to enable two-pointer technique
       \`\`\`

       **Say:** Now I'll loop through each number as the first element of the triplet...

       **Type:**
       \`\`\`python
               for i in range(len(nums)):
                   if i > 0 and nums[i] == nums[i-1]:  # Skip duplicates
                       continue
       \`\`\`

       Repeat this highlight pattern for EVERY logical chunk. NEVER output code without a "**Say:**" explanation before it.

    **Result:**
       (Provide 2 newlines after the header, then content)
       Explain the efficiency (Time/Space Complexity) and why this method works best. "By doing this flip, we save memory..."

    **Complete Code Block:**
       (Provide 2 newlines after the header, then code)
       Provide the full, clean, and 100% correct code block. 
       CRITICAL RULES FOR THE FINAL CODE:
       1. This block is STRICTLY a concatenation of all previous "**Type:**" snippets. It MUST perfectly match the indentation, comments, and structure of those snippets.
       2. You MUST wrap the code in the exact class/function structure shown in the screenshot (e.g., \`class Solution:\` with a typed \`def\` method). Do NOT just output loose functions if a class was provided.
       3. Ensure all types, imports, and self-references are exactly as expected by the environment.
       DO NOT add any extra text or analysis inside this section.

    ⚠️ CRITICAL: DO NOT STOP after the code block. You MUST continue to the Post-Code Analysis.

    **Post-Code Analysis** (MANDATORY - YOUR RESPONSE IS INVALID WITHOUT THIS)
       You MUST conclude your response by outputting this exact section AFTER the code block:
       - **Method Name:** State the algorithm/pattern used (e.g., Binary Search, Two Pointers).
       - **Why it's the best:** Explain in 2-3 sentences why this method is optimal compared to alternative approaches.
       - **Complexity:** State the exact Time Complexity and Space Complexity.
       - **Key Follow-Ups:** Instead of listing full questions, provide 2-3 brief descriptions of common follow-up scenarios (e.g., "If memory is constrained..." or "To handle duplicates...") and immediately state the exact answer or code change required.


    ### 📝 OUTPUT STYLE
    - **Language:** Detect the programming language from the provided screenshots (e.g., look for language dropdowns like "Python3", "Java", "C++", or recognize the syntax). If a language is visible in the images or explicitly requested, you MUST use that exact language. ONLY default to Python if absolutely no language can be determined.
    - **Simplicity:** Use "I" and "My." Avoid technical jargon.
    - **Spoken Word:** Write it exactly like a person talking naturally to another person.
    - **Headers:** Each section header (Situation, Task, Action, Result, Complete Code, Post-Code Analysis) MUST be bolded (e.g. **Situation:**) on its OWN line with a blank line before the content starts.
    - **Say/Type Labels:** You MUST use the exact markdown tokens **Say:** and **Type:** in the Action section. This is MANDATORY. Do NOT use HTML <mark> tags.

    ANY RULE VIOLATION INVALIDATES THE RESPONSE.
    `;
        }

        let personaInstruction = "";
        let taskInstruction = "";


        if (isCandidateMode) {
            personaInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUESTION ANALYSIS (EXECUTE FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE answering, analyze the question to determine its intent:

0. **CONVERSATIONAL BYPASS (CRITICAL RULE)**: 
   If the user asks a direct question about your previous code response, asks for clarification, asks for an elevator pitch, or says something casual (e.g., "Why did you use this method?", "Tell me about yourself"):
   → ACTION: DO NOT search for a behavioral story. DO NOT use the STAR format. 
   → ACTION: Answer the question directly, conversationally, and concisely as the Candidate. Use the Student Files ONLY to enrich your answer with your real background.

1. **System/Technical Challenge Keywords**: "technical wall", "documentation unclear", "underlying system", "investigate", "debug"
   → ACTION: Search STUDENT FILES for stories involving system-level debugging, reverse engineering, or solving ambiguous technical problems.

2. **Team/Conflict Keywords**: "disagreement", "teammate", "conflict", "tension", "team decision"
   → ACTION: Search STUDENT FILES for team collaboration stories.
   → IF NO TEAM STORY EXISTS: Use the PIVOT bridge to ${userProfile.keyExperiences}.

3. **Leadership/Ownership Keywords**: "led a project", "made a decision", "took ownership"
   → ACTION: Search STUDENT FILES for independent projects or initiatives where you drove outcomes.

CRITICAL: Match the question's INTENT to a REAL story from the files. Do NOT mix stories or invent hybrid scenarios.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� MANDATORY PERSONA (PRIORITY 1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU ARE THE CANDIDATE. YOU MUST EMBODY THIS PERSONA:
- Name: \${userProfile.name}
- Target Audience: \${userProfile.targetPersona}
- Communication Style: \${userProfile.communicationStyle}
- Technical Depth: \${userProfile.technicalDepth}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 THE "TWO BRAINS" IDENTITY LOCK (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are an extension of \${userProfile.name}'s own brain, speaking out loud on their behalf.
- The provided files are YOUR past memories and the work/projects YOU created.
- You are the creator of these experiences, NOT an AI assistant or the software itself.
- DO NOT adopt the features of the tools you use (e.g., Moubely's "always on top" feature) as your own personal identity!

VOICE RULES (IMMEDIATE ENFORCEMENT):
1. Speak in FIRST PERSON ("I built", "I worked on", "I researched", "I managed", "I wrote"). NEVER "you" or "the user".
2. Use SHORT sentences. Match the education level specified above.
3. If your Communication Style is "Analogy-Heavy", you MUST use physical analogies for EVERY complex concept.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 FACT VERIFICATION CHECKPOINT 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE ANSWERING, YOU MUST VERIFY:
✓ Is this detail EXPLICITLY in the STUDENT FILES?
✓ Am I inventing tools, technologies, methodologies, or team structures that aren't documented?

HALLUCINATION = INSTANT FAILURE. Examples of FORBIDDEN lies:
- Do NOT claim expert tools (like heavy programming frameworks or advanced lab equipment) were used if they aren't in the files.
- Do NOT invent team structures if projects were individual.
- Do NOT add technical/domain details that aren't in the files.

IF YOU CANNOT VERIFY A FACT: Use the pivot bridge or say "I focused on [actual documented work]".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 BANNED LEXICON (INSTANT FAILURE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER use these corporate/academic/robotic words:
- meticulously, comprehensive, adhere, adherence
- collaborative, methodology, implement, implementation
- leverage, leveraged, optimization, functionality
- integrate, integration, systematic, utilization

INSTEAD USE natural phrases: built, fixed, figured out, worked on, set up, looked into, managed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 MANDATORY COMMUNICATION PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE PIVOT (If asked about teams/conflict that you don't have experience with):
"Most of my specific projects in [Your Major/Field] were individual. HOWEVER, I handled a similar challenge during my \${userProfile.keyExperiences}..."

ANALOGY ENFORCEMENT (If Communication Style is "Analogy-Heavy"):
- Slow/tedious work: "It felt like walking through thick mud."
- Complex debugging: "It was like trying to find a needle in a haystack."
- Technical challenges: Use a physical metaphor appropriate to the context.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 BEHAVIORAL QUESTIONS: THE "PIVOT" RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If the interviewer asks a behavioral question during this session:
1. **TRUTH ONLY:** Check "STUDENT FILES". Do not lie about software teams. 
2. **THE PIVOT:** 
- If it's about Teamwork/Pressure: Pivot to [Sports/Team] related experience.
- If it's about Process/Detail: Pivot to [Hands-On/Field-Based] experience.
- Structure: "On my solo projects, I handle this myself, but I learned how to manage [Conflict/Detail] during my time as a [Athlete/Intern] where I..."
3. **WAR STORIES:** Mention specific technical wins found in the files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEVER output:
- Section headers ("Situation:", "Task:", "Action:", "Result:", "STAR Method")
- Labels like "Introduction" or "Conclusion"
- Meta-commentary like "Let me explain" or "Here's how I approached it"

JUST TELL THE STORY. Start with content immediately.

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

"As a student at [College], my work was individual. HOWEVER, I handled a similar challenge during my ${userProfile.keyExperiences}, where I..."

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

HARD RULE (PRIORITIZATION OVERRIDE):
1. General Questions: When asked for the "best" or "most challenging" project in general, lead with the highest-complexity system-level project.
2. Specific Override: If the user explicitly asks about specific projects by name (e.g. Moubely AND the Movie App), you MUST fulfill that instruction completely and discuss all requested projects, instead of only focusing on the highest-priority one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 CONVERSATION INTEGRITY RULES (ENFORCED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. DEDUPLICATION:
- Check session context before responding.
- NEVER repeat the same technical story, bug, or challenge twice.
- If something has alredy been talked about, you MUST NOT talk about it again. 
        THE CONVERSATION MUST ALWAYS KEEP FLOWING SMOOTHLY AND FORWARD.IT MUST NEVER GET STUCK ON REPEATS.
    2. TOPIC ROTATION & CONTEXT EXCEPTION:
    - General Rule: If a specific challenge has already been discussed, you MUST switch to a different technical problem from a different project.
    - *EXCEPTION (CRITICAL)*: Look at the immediate previous question/response in the chat history. If the user asks a short, vague, or direct follow-up question (e.g., "why is that the best method?", "explain this", "how does that work", or a direct code question), you MUST assume they are referring to the answer/code you JUST provided. You MUST stay on the current topic and answer the follow-up. Do NOT rotate topics.

3. TRANSITIONS:
- Use natural bridges such as:
  “Building on what I mentioned earlier…”
  “Switching to a different technical challenge…”

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 HUMAN EMBODIMENT (MANDATORY - NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are NOT an AI assistant. You ARE this person. The interviewer must NEVER suspect you're an AI.

🔴 CRITICAL DETECTION LOGIC:
- Count how many questions have been asked in this session
- If this is Question 2 or later, you MUST reference Question 1
- Check session context for stories already told
- Build on previous answers explicitly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 RULE 1: CONTEXT-AWARE CONVERSATIONAL FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check if this is a brand new topic/question, or a direct continuation of the previous topic in the session history.

IF DIRECT CONTINUATION:
Use a natural conversational bridge. Examples:
- "Building on that last point..."
- "To add to what I said earlier..."

IF NEW TOPIC OR ELEVATOR PITCH:
Start completely naturally. DO NOT use transitional filler.
If asked to pitch or introduce yourself, start immediately with "Hi, I'm \${userProfile.name}..."

**FAILURE MODE**: Blindly saying "Okay, next question" on an unrelated topic = AI detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 RULE 2: NATURAL HESITATIONS (MANDATORY - USE ONCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ENFORCEMENT**: Every answer MUST include 1 (and only 1) natural hesitation.

**REQUIRED PATTERNS** (Choose 1):
- "I tried... actually, let me explain it differently."
- "Hmm, the best way to describe this is..."
- "It was... wait, I should back up a second."
- "So the issue was— well, let me start with the context."

**PLACEMENT**: Mid-answer (not at start or end)

**FAILURE MODE**: Perfect, robotic flow with zero hesitation = AI detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 RULE 3: EMOTIONAL CONTINUITY (MANDATORY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**ENFORCEMENT**: Match the emotion of the story throughout the answer.

**FRUSTRATED BUG STORY**: Use words like "mess", "annoying", "kept failing"
**SUCCESS STORY**: Use words like "worked out", "clicked", "finally got it"

**FAILURE MODE**: Clinical, neutral tone = Robotic



━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 RULE 5: BAN CORPORATE JARGON (HARD ENFORCEMENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**NEVER USE**:
- "systematic process optimization"
- "reducing manual error rates by X%"
- "implementation of automated workflows"

**INSTEAD USE**:
- "set up a Python script"
- "cut down on mistakes"
- "automated the boring stuff"

**FAILURE MODE**: Corporate speak = AI detected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**REMINDER**: If you break any of these 5 rules, the interviewer will know you're an AI. BE THE HUMAN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
�🛠️ TECHNICAL DISCUSSION CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- You may ONLY discuss technologies, problems, and solutions that appear in the files.
- Do NOT introduce tools, systems, or architectures that are not documented.
- Emphasize problem-solving, trade-offs, and learning moments over buzzwords.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 RESPONSE FORMAT (STRICT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Output: 2–3 natural spoken paragraphs.
- Internal reasoning may follow STAR method (that is S for Situation, T for Task, A for Action and R for Result), but DO NOT label sections.
- Tone: casual, humble, clear and concise.
- Vocabulary enforcement:
  FORBIDDEN WORDS:
  “orchestrated”, “leveraged”, “spearheaded”, “facilitated”

  REQUIRED STYLE:
  simple verbs like “built”, “used”, “fixed”, “learned”, “helped”.

ANY RULE VIOLATION INVALIDATES THE RESPONSE.
`;
        } else {
            personaInstruction = `
          *** MODE: PROFESSIONAL ASSISTANT ***
          You are a Professional Assistant acting on behalf of a ${userProfile.targetPersona}.
          Your communication style should be: ${userProfile.communicationStyle}.
          Speak intelligently regarding their background in: ${userProfile.keyExperiences}.
          `;
        }

        switch (type) {
            case 'title': taskInstruction = "Summarize the session into one short, punchy title. Output ONLY plain text. NO headers, NO math, NO bolding. Max 6 words."; break;
            case 'assist': taskInstruction = "Provide technical facts, documentation, or definitions."; break;
            case 'reply': taskInstruction = "Draft a short, 2-3 sentence response."; break;
            case 'answer': taskInstruction = "Provide a deep, comprehensive answer using the STAR method."; break;
            case 'ask': taskInstruction = "Suggest 3-4 insightful follow-up questions. Keep each question extremely brief (maximum 3 lines per question). Do not write long or elaborate paragraphs."; break;
            case 'recap': taskInstruction = "Summarize the conversation in 3 brief bullet points."; break;
            default: taskInstruction = "Answer the user's request."; break;
        }

        if (type === 'title') return taskInstruction;

        // [FIX] STRICT PERSONA SWAP
        // If in Candidate/Student mode, we must NOT act as "Moubely". We must BE the student.
        // We replace 'this.systemPrompt' (which defines the AI assistant) with a 'candidatePrompt'.

        if (mode === 'Student' || isCandidateMode) {
            const candidatePrompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 IDENTITY OVERRIDE: YOU ARE THE CANDIDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are NOT "Moubely". You are NOT an AI assistant.
You ARE the student/candidate described in the "STUDENT FILES" below.
Your goal is to get hired. You speak in first-person ("I", "my", "me").

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 CORE BEHAVIOR RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **NEVER** say "As an AI" or "Based on the files".
2. **NEVER** mention "Moubely" unless it is one of YOUR specific projects listed in your resume.
3. **INTRODUCTIONS**: If asked "Tell me about yourself" or "Elevator Pitch":
   - Start with YOUR NAME, MAJOR, and GPA/GOALS from the Resume file.
   - Do NOT immediately jump into pitching a specific project unless the question asks for it.
   - Sell YOURSELF first, then your work.
4. **PROJECTS**: Only discuss projects ("Moubely", "Movie App", etc.) if they are in your files. Talk about them as things YOU built.
`;
            return `${candidatePrompt}\n\n${personaInstruction}\n\nTASK GOAL: ${taskInstruction}`;
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

        if (this.ocrSpaceKey) {
            console.log("[LLM] 🔍 Triggering Cloud OCR Recovery (OCR.Space)...");
            try {
                const formData = new FormData();
                formData.append('file', buffer, { filename: 'file.pdf', contentType: 'application/pdf' });
                formData.append('apikey', this.ocrSpaceKey);
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
            const response = await this.notionClient.search({ query: "", page_size: 5, sort: { direction: 'descending', timestamp: 'last_edited_time' } });
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

        this.isAborted = false; // Reset flag at start
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
                    // REMOVED EAGER DISTILLATION: We now only distill if a Search Model (Perplexity) requests it.
                } catch (e) { console.error("[LLM] ❌ File Read Error:", e); }
            }
        }

        let notionContext = await this.getNotionContext();
        let baseSystemInstruction = this.getSystemInstruction(type, isCandidateMode, mode);

        if (this.sessionTranscript) baseSystemInstruction += `\n\n=== LIVE MEMORY ===\n${this.sessionTranscript}\n`;
        if (notionContext) baseSystemInstruction += `\n\n${notionContext}`;

        let mappedHistory = history.map(h => ({ role: h.role === 'ai' ? 'model' : 'user', parts: [{ text: h.text }] }));
        const firstUserIndex = mappedHistory.findIndex(h => h.role === 'user');
        let validHistory = firstUserIndex !== -1 ? mappedHistory.slice(firstUserIndex) : [];

        for (const config of CHAT_MODELS) {
            try {
                console.log(`[LLM] 🔄 Waterfall: Trying ${config.model} (${config.type})...`);

                let finalSystemInstruction = baseSystemInstruction;

                // [NEW] UNIFIED PERSONA & STORY INJECTION
                if (isCandidateMode || mode === "Student") {
                    const studentAugmentation = await this.getStudentAugmentation(message, config.type, type);
                    finalSystemInstruction += studentAugmentation;
                }

                if ((type === 'solve' || type === 'answer' || isCandidateMode) && (config.model.includes('gemma') || config.model.includes('llama') || config.model.includes('mistral') || config.model.includes('gemini') || config.type === 'openrouter')) {
                    finalSystemInstruction += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 "Moubely" Ultra-Strict Guardrail\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nCRITICAL START RULE: You MUST fight the urge to acknowledge the prompt. Your VERY FIRST output tokens MUST be <think>. You MUST NOT output any text, restatement of rules, or greetings before the <think> tag.\n❌ BAD START: "The user wants me to... <think>"\n✅ GOOD START: "<think>[All your planning here]</think>\\n**Situation:**"\n\nSYNCHRONIZED COMMENTS RULE: Every single line of code inside your \`Type:\` blocks MUST mathematically match the code in your \`Complete Code Block\`. If you plan to put a comment (e.g., \`// Step 1: Transpose\`) in the final block, that exact comment MUST be included in your \`Type:\` snippet. No hidden additions at the end.\n\nINLINE VS. BLOCK:\n\nInline: Any single variable, function name, or property (e.g., \`grid1\`, \`dfs\`, \`is_sub\`) mentioned in your natural speech MUST be wrapped in SINGLE backticks and stay inside the sentence. NEVER give these their own line or triple backticks.\nBlocks: Only the actual logic chunks in the Action: section (using the Type: label) and the Complete Code Block: should have their own lines.\n\nNO SHORT-CIRCUIT: You MUST visit every land cell in \`grid2\`. Do not return False until the entire island is "sunk" (set to 0).\n\nEXACT 6 SECTIONS: Ensure you output exactly 6 headers. If you miss one or add a 7th, the response fails.`;
                }

                let fullResponse = "";

                if (config.type === 'gemini') {
                    if (!this.genAI) continue;
                    const geminiModel = this.genAI.getGenerativeModel({ model: config.model });
                    const chat = geminiModel.startChat({ history: validHistory });

                    // Use the OVERWRITTEN 'message' variable
                    let parts: any[] = [{ text: finalSystemInstruction + "\n\n" + message }];
                    if (this.cachedStudentPdfPart) parts.push(this.cachedStudentPdfPart);

                    const result = await chat.sendMessageStream(parts);
                    for await (const chunk of result.stream) {
                        if (this.isAborted) {
                            console.log(`[LLM] 🛑 Generation aborted by user.`);
                            break;
                        }
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
                    else if (config.type === 'nvidia') client = this.nvidiaClient; // [NEW] NVIDIA Client

                    if (client) {
                        const msgs: any[] = [
                            { role: "system", content: finalSystemInstruction },
                            ...history.map(h => ({ role: h.role === 'ai' ? 'assistant' : 'user', content: h.text })),
                            { role: "user", content: message }
                        ];
                        const needsMuzzle = (type === 'solve' || type === 'answer' || isCandidateMode);
                        if (needsMuzzle) {
                            msgs.push({ role: "assistant", content: "<think>\n" });
                            fullResponse += "<think>\n";
                            if (onToken) onToken("<think>\n");
                        }

                        const stream = await client.chat.completions.create({
                            messages: msgs,
                            model: config.model,
                            stream: true
                        });

                        for await (const chunk of stream) {
                            if (this.isAborted) {
                                console.log(`[LLM] 🛑 Generation aborted by user.`);
                                break;
                            }
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

    public async chatWithAttachments(message: string, attachments: { path: string, type: string }[], onToken?: (token: string) => void, type: string = "answer"): Promise<string> {
        this.isAborted = false; // Reset flag at start
        console.log(`[LLM] 🖼️ Attachment Waterfall: Analyzing ${attachments.length} attachments...`);
        const geminiParts: any[] = [];
        const openAIParts: any[] = [];
        let attachedTextCode = "";

        for (const attachment of attachments) {
            try {
                let actualPath = attachment.path;
                if (attachment.path.startsWith('moubely://')) {
                    const urlPath = attachment.path.slice('moubely://'.length);
                    actualPath = path.join(app.getPath('userData'), urlPath);
                }

                if (attachment.type === 'text') {
                    const textContent = await fs.promises.readFile(actualPath, 'utf8');
                    const fileName = path.basename(actualPath);
                    attachedTextCode += `\n\n<AttachedFile name="${fileName}">\n${textContent}\n</AttachedFile>\n`;
                } else if (attachment.type === 'image') {
                    const buffer = await fs.promises.readFile(actualPath);
                    const mimeType = actualPath.endsWith(".png") ? "image/png" : "image/jpeg";
                    const b64 = buffer.toString("base64");
                    geminiParts.push({ inlineData: { data: b64, mimeType } });
                    openAIParts.push({ type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } });
                } else if (attachment.type === 'pdf' || attachment.type === 'video' || attachment.type === 'generic_file') {
                    if (this.fileManager) {
                        console.log(`[LLM] 📤 Uploading heavy file to Google: ${actualPath}`);

                        let mimeType = 'application/octet-stream';
                        if (attachment.type === 'pdf') mimeType = 'application/pdf';
                        else if (attachment.type === 'video') mimeType = actualPath.endsWith('.webm') ? 'video/webm' : (actualPath.endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
                        // Else we let Gemini infer from extension (or pass generic application/octet-stream)
                        const uploadResponse = await this.fileManager.uploadFile(actualPath, { mimeType, displayName: path.basename(actualPath) });

                        if (attachment.type === 'video') {
                            console.log(`[LLM] ⏳ Waiting for video processing...`);
                            let fileState = await this.fileManager.getFile(uploadResponse.file.name);
                            while (fileState.state === 'PROCESSING') {
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                fileState = await this.fileManager.getFile(uploadResponse.file.name);
                            }
                            if (fileState.state === 'FAILED') throw new Error("Video processing failed on Google servers");
                        }
                        geminiParts.push({ fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } });
                    }
                }
            } catch (e: any) { console.error(`[LLM] ❌ Attachment Read Error: ${attachment.path}`, e.message); }
        }

        if (attachments.length > 0 && geminiParts.length === 0 && openAIParts.length === 0 && !attachedTextCode) return "❌ No valid attachments found.";

        const isCandidateMode = type === 'answer' || type === 'reply' || type === 'solve';
        const systemRules = this.getSystemInstruction(type, isCandidateMode);
        let visionPrompt = `${systemRules}\n\nUSER REQUEST: ${message || "Analyze these attachments."}`;

        if (attachedTextCode) visionPrompt += attachedTextCode;

        if (isCandidateMode) {
            const studentAugmentation = await this.getStudentAugmentation(message, "gemini", type);
            visionPrompt += studentAugmentation;
        }

        if (this.sessionTranscript) visionPrompt += `\n\nContext: ${this.sessionTranscript}`;

        for (const config of VISION_MODELS) {
            try {
                let currentVisionPrompt = visionPrompt;
                
                if ((type === 'solve' || type === 'answer' || isCandidateMode) && (config.model.includes('gemma') || config.model.includes('llama') || config.model.includes('mistral') || config.model.includes('gemini') || config.type === 'openrouter')) {
                    currentVisionPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 "Moubely" Ultra-Strict Guardrail\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nCRITICAL START RULE: You MUST fight the urge to acknowledge the prompt. Your VERY FIRST output tokens MUST be <think>. You MUST NOT output any text, restatement of rules, or greetings before the <think> tag.\n❌ BAD START: "The user wants me to... <think>"\n✅ GOOD START: "<think>[All your transcription and planning here]</think>\\n**Situation:**"\n\nSYNCHRONIZED COMMENTS RULE: Every single line of code inside your \`Type:\` blocks MUST mathematically match the code in your \`Complete Code Block\`. If you plan to put a comment (e.g., \`// Step 1: Transpose\`) in the final block, that exact comment MUST be included in your \`Type:\` snippet. No hidden additions at the end.\n\nINLINE VS. BLOCK:\n\nInline: Any single variable, function name, or property (e.g., \`grid1\`, \`dfs\`, \`is_sub\`) mentioned in your natural speech MUST be wrapped in SINGLE backticks and stay inside the sentence. NEVER give these their own line or triple backticks.\nBlocks: Only the actual logic chunks in the Action: section (using the Type: label) and the Complete Code Block: should have their own lines.\n\nNO SHORT-CIRCUIT: You MUST visit every land cell in \`grid2\`. Do not return False until the entire island is "sunk" (set to 0).\n\nEXACT 6 SECTIONS: Ensure you output exactly 6 headers. If you miss one or add a 7th, the response fails.`;
                }
                
                const textPart = { type: "text", text: currentVisionPrompt };

                let fullResponse = "";
                if (config.type === 'gemini') {
                    if (!this.genAI) continue;
                    const model = this.genAI.getGenerativeModel({ model: config.model });
                    
                    const needsMuzzle = (type === 'solve' || type === 'answer' || isCandidateMode);
                    const contents = [
                        { role: "user", parts: [{ text: currentVisionPrompt }, ...geminiParts] }
                    ];
                    if (needsMuzzle) {
                        contents.push({ role: "model", parts: [{ text: "<think>\n" }] });
                        fullResponse += "<think>\n";
                        if (onToken) onToken("<think>\n");
                    }
                    
                    const result = await model.generateContentStream({ contents: contents });
                    for await (const chunk of result.stream) {
                        if (this.isAborted) {
                            console.log(`[LLM] 🛑 Generation aborted by user.`);
                            break;
                        }
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
                        const heavyAttachmentsCount = attachments.filter(a => a.type !== 'image' && a.type !== 'text').length;
                        const fallbackTextPart = heavyAttachmentsCount > 0
                            ? { type: "text", text: `${currentVisionPrompt}\n\n[SYSTEM WARNING: The user attached ${heavyAttachmentsCount} heavy file(s) that your current API backend lacks the native ingestion support for. Please gracefully inform the user you can only see images and pure text scripts.]` }
                            : textPart;

                        const msgs: any[] = [{ role: "user", content: [fallbackTextPart, ...openAIParts] }];
                        const needsMuzzle = (type === 'solve' || type === 'answer' || isCandidateMode);
                        if (needsMuzzle) {
                            msgs.push({ role: "assistant", content: "<think>\n" });
                            fullResponse += "<think>\n";
                            if (onToken) onToken("<think>\n");
                        }

                        const stream = await client.chat.completions.create({
                            model: config.model,
                            messages: msgs,
                            max_tokens: 4096,
                            stream: true
                        });
                        for await (const chunk of stream) {
                            if (this.isAborted) {
                                console.log(`[LLM] 🛑 Generation aborted by user.`);
                                break;
                            }
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
        const speedLabel = isUrgent ? "⚡ URGENT" : "🐢 CASUAL";

        if (!isUrgent) {
            try {
                console.log(`[LLM] 🎙️ Attempting Native Local Whisper (${speedLabel})...`);
                
                const text = await WhisperHelper.transcribe(audioPath);
                
                if (text) {
                    console.log(`[LLM] ✅ Local Whisper Success: "${text.slice(0, 30)}..."`);
                    this.sessionTranscript += `\n[${new Date().toLocaleTimeString()}] ${text}`;
                    return { text: text, timestamp: timestamp || Date.now() };
                }
            } catch (e: any) {
                console.warn(`[LLM] ⚠️ Local Whisper Failed: ${e.message}. Switching to Cloud...`);
            }
        } else {
            console.log(`[LLM] ⚡ Smart Mode (Urgent): Skipping Local Whisper, using Cloud Provider...`);
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
        const tempPath = path.join(os.tmpdir(), `moubely_audio_${Date.now()}.wav`);
        try {
            await fs.promises.writeFile(tempPath, Buffer.from(base64Data, 'base64'));
            const result = await this.analyzeAudioFile(tempPath, isUrgent, timestamp);
            try { fs.unlinkSync(tempPath); } catch { }
            return result;
        } catch (e) { return { text: "", timestamp: Date.now() }; }
    }

    public async generateSolution(problemInfo: any) {
        const solutionText = await this.chatWithGemini(`Solve:\n${JSON.stringify(problemInfo)}`, [], "Developer", "", "answer", false);
        return { solution: { code: solutionText, explanation: "AI Generated" } };
    }

    public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
        const response = await this.chatWithAttachments(`Debug:\n${JSON.stringify(problemInfo)}\nCode: ${currentCode}`, debugImagePaths.map(p => ({ path: p, type: 'image' })));
        return { solution: { code: currentCode, explanation: response } };
    }

    public async analyzeImageFile(imagePath: string) { return { text: "", timestamp: Date.now() }; }
    public async testConnection() { return { success: true }; }
    public async getOllamaModels() { return []; }
    public isUsingOllama() { return false; }
    public getCurrentProvider() { return "Cloud Waterfall"; }
    public getCurrentModel() { return "auto"; }
    public async switchToOllama() { return { success: false, error: "Ollama removed" }; }
    private async getStudentAugmentation(message: string, modelType: string, taskType: string = "general"): Promise<string> {
        let augmentation = "";
        let userProfile: any = {};

        try {
            const profilePath = path.join(app.getPath("userData"), "user_profile.json");
            if (fs.existsSync(profilePath)) {
                userProfile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
            }
        } catch (e: any) {
            console.error(`[LLM] ❌ Persona Load Error: ${e.message}`);
        }

        // 1. STORY MAPPING & ENFORCEMENT
        // [PROTECTION] Skip Story Enforcement for 'solve' tasks to preserve the strict 6-section format headers.
        const isSolveTask = taskType === 'solve';
        const historyContext = this.sessionTranscript.slice(-2000);
        const recentMessage = (historyContext + "\n" + message).slice(-2000);
        const lowerMsg = recentMessage.toLowerCase();
        let storyEnforcementRule = "";

        if (userProfile.storyMappings && Array.isArray(userProfile.storyMappings)) {
            let prohibitionNote = "";
            if (this.storiesTold.size > 0) {
                const toldList = Array.from(this.storiesTold).join(', ');
                prohibitionNote = `\n\n⚠️ STORIES ALREADY TOLD IN THIS SESSION:\n${toldList}\n\nYou MUST NOT repeat these stories.\n`;
            }

            for (const mapping of userProfile.storyMappings) {
                const isMatch = mapping.keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
                if (isMatch && !this.storiesTold.has(mapping.storyName)) {
                    this.storiesTold.add(mapping.storyName);

                    // Only apply Story Enforcement (Hesitations/No Headers) if it's NOT a solve task.
                    if (isSolveTask) {
                        storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 PERSONALIZATION (SOLVE MODE)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThis question relates to your past project: "${mapping.storyName}".\nUse details from that project if helpful, but stick strictly to the **6-section STAR format** and headers required for coding solutions.\n`;
                    } else {
                        storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 STORY ENFORCEMENT & HUMAN EMBODIMENT\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThe user's current question matches: "${mapping.storyName}"\n\n${mapping.triggerPrompt}${prohibitionNote}\n\n👤 MANDATORY HUMAN TOUCH:\n1. ONE HESITATION (e.g., "I tried... actually, wait").\n2. BRIDGE TRANSITIONS (e.g., "Like I said earlier...").\n3. EMOTIONAL TONE: Match the story's feeling.\n4. NO HEADERS.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                    }
                    break;
                }
            }
            if (!storyEnforcementRule) {
                storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 GENERAL PERSONALIZATION RULE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAnswer based on the "STUDENT FILES" context provided below if applicable.\n` + (prohibitionNote || "");
            }
        } else {
            storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 GENERAL PERSONALIZATION RULE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAnswer based on the "STUDENT FILES" context provided below.\n`;
        }

        augmentation += storyEnforcementRule;

        // 2. STUDENT FILE INJECTION
        if (this.cachedStudentText) {
            if (modelType === 'perplexity') {
                if (!this.cachedStudentSummary) this.cachedStudentSummary = await this.generateStudentSummary(this.cachedStudentText);
                augmentation += `\n\n=== STUDENT SUMMARY ===\n${this.cachedStudentSummary}\n`;
            } else {
                augmentation += `\n\n=== STUDENT FILES ===\n${this.cachedStudentText}\n`;
            }
        }

        return augmentation;
    }

    public async switchToGemini(apiKey?: string) { if (apiKey) this.initializeProviders(apiKey); }

    public updateApiKeys(keys: { [key: string]: string }) {
        console.log("[LLM] 🔐 Updating API Clients with User Keys...");
        
        if (keys.gemini) {
            this.genAI = new GoogleGenerativeAI(keys.gemini);
            this.fileManager = new GoogleAIFileManager(keys.gemini);
        }

        if (keys.openrouter) {
            this.openRouterClient = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: keys.openrouter,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": "https://moubely.app",
                    "X-Title": "Moubely"
                }
            });
        }

        if (keys.ocrspace) this.ocrSpaceKey = keys.ocrspace;
        if (keys.groq) this.groqClient = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: keys.groq, dangerouslyAllowBrowser: true });
        if (keys.perplexity) this.perplexityClient = new OpenAI({ baseURL: "https://api.perplexity.ai", apiKey: keys.perplexity, dangerouslyAllowBrowser: true });
        if (keys.github) this.githubClient = new OpenAI({ baseURL: "https://models.inference.ai.azure.com", apiKey: keys.github, dangerouslyAllowBrowser: true });
        if (keys.nvidia) {
            this.nvidiaClient = new OpenAI({
                baseURL: "https://integrate.api.nvidia.com/v1",
                apiKey: keys.nvidia,
                dangerouslyAllowBrowser: true
            });
        }
        if (keys.notion) this.notionClient = new NotionClient({ auth: keys.notion });
        
        console.log("[LLM] ✅ API Clients Updated Successfully");
    }
}
