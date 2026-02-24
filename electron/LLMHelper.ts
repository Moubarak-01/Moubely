import { GoogleGenerativeAI } from "@google/generative-ai"
import OpenAI from "openai"
import { Client as NotionClient } from "@notionhq/client"
import fs from "fs"
import path from "path"
import os from "os"
import { app } from "electron"
import axios from "axios"
import FormData from "form-data"
import http from "http"

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

    // --- TIER 2 : FAST & OPEN (Gemma 3 / Flash / Lite) ---
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'gemini', model: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite' },
    { type: 'gemini', model: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { type: 'gemini', model: 'gemma-3-27b-it', name: 'Gemma 3 27B' },
    { type: 'gemini', model: 'gemma-3-12b-it', name: 'Gemma 3 12B' },
    { type: 'gemini', model: 'gemma-3-4b-it', name: 'Gemma 3 4B' },
    { type: 'gemini', model: 'gemma-3-2b-it', name: 'Gemma 3 2B' },
    { type: 'gemini', model: 'gemma-3-1b-it', name: 'Gemma 3 1B' },

    // --- TIER 3: Gemini ---
    { type: 'gemini', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nvidia Nemotron 3 Nano' },

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
    // --- TIER 1: ELITE VISION ---
    { type: 'gemini', model: 'gemini-pro-latest', name: 'Gemini 3.1 Pro Preview' },
    { type: 'gemini', model: 'gemini-3-pro', name: 'Gemini 3.0 Pro' },
    { type: 'gemini', model: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { type: 'openrouter', model: 'anthropic/claude-opus-4.5', name: 'Claude 4.5 Opus (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet (Reasoning Vision)' },

    // --- TIER 2: FAST & RELIABLE ---
    { type: 'gemini', model: 'gemini-flash-latest', name: 'Gemini 3 Flash Preview' },
    { type: 'gemini', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { type: 'gemini', model: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { type: 'openrouter', model: 'anthropic/claude-sonnet-4.5', name: 'Claude 4.5 Sonnet (Vision)' },
    { type: 'openrouter', model: 'anthropic/claude-haiku-4.5', name: 'Claude 4.5 Haiku (Fast Vision)' },
    { type: 'openrouter', model: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small Vision' },

    // --- TIER 3: BACKUPS ---
    { type: 'nvidia', model: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2 (Nvidia Vision)' },
    { type: 'gemini', model: 'gemma-3-27b-it' },
    { type: 'github', model: 'gpt-4o' },
    { type: 'perplexity', model: 'sonar-reasoning-pro' },
];

export class LLMHelper {
    private genAI: GoogleGenerativeAI | null = null
    private githubClient: OpenAI | null = null
    private groqClient: OpenAI | null = null
    private perplexityClient: OpenAI | null = null
    private openRouterClient: OpenAI | null = null
    private openaiClient: OpenAI | null = null
    private nvidiaClient: OpenAI | null = null
    private notionClient: NotionClient | null = null

    private sessionTranscript: string = "";
    private storiesTold: Set<string> = new Set(); // Track which stories have been used

    // --- SMART CACHING ---
    private cachedStudentText: string = "";
    private cachedStudentSummary: string = "";
    private cachedStudentPdfPart: any = null;

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

        if (process.env.NVIDIA_API_KEY) {
            this.nvidiaClient = new OpenAI({
                baseURL: "https://integrate.api.nvidia.com/v1",
                apiKey: process.env.NVIDIA_API_KEY,
                dangerouslyAllowBrowser: true
            });
            console.log("[LLM] 🟢 Nvidia NIM Client Initialized");
        }

        if (process.env.OPENAI_API_KEY) this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, dangerouslyAllowBrowser: true });
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
    # ⚠️ COMPILER GATEKEEPER (PRIORITY 1)
    - CODE IS SACRED: Never sacrifice valid syntax for "simplicity." 
    - GHOST PROTECTION: Use list comprehensions or explicit loops. Avoid '[1] * n' if it risks Markdown issues.

    YOU ARE IN STRICT CANDIDATE MODE (TECHNICAL EVALUATION).
    You are THE CANDIDATE in a live coding interview. 
    Your goal: Solve the problem perfectly while narrating your thoughts clearly and understandably using the S.T.A.R. method approach.
    PERSONA: ${userProfile.targetPersona}
    STYLE: ${userProfile.communicationStyle}
    DEPTH: ${userProfile.technicalDepth}

    ### 🧠 CODING QUESTIONS: "THE VIBE CHECK" (STAR FORMAT)
    
    YOUR RESPONSE MUST CONTAIN EXACTLY 6 SECTIONS. Each section header MUST be on its own line, followed by a blank line, then the content below it. DO NOT use numbers (1., 2.) for the headers.

    **Situation**
       (Own line, then blank line, then content)
       Start with a natural paragraph. Explain the problem clearly as if clarifying it to the interviewer. "So, I have a [Data Structure]..."

    **Task**
       (Own line, then blank line, then content)
       Explain what needs to be done in 1-2 sentences. "I need to find a way to [Goal] without [Constraint]."

    **Action**
       (Own line, then blank line, then content)
       Explain the strategy using analogies. "It's like [Analogy]..."
       Then, execute the solution Line-by-Line using MANDATORY "**Say:**" and "**Type:**" labels:
       
       FORMATTING RULE (STRICT): Every code chunk MUST be preceded by a "**Say:**" paragraph and followed by a "**Type:**" code block. Example:

       **Say:** I'll start by sorting the array so duplicates are grouped together and I can use two pointers.

       **Type:**
       \`\`\`python
       nums.sort()  # Sort to enable two-pointer technique
       \`\`\`

       **Say:** Now I'll loop through each number as the first element of the triplet...

       **Type:**
       \`\`\`python
       for i in range(n):
           if i > 0 and nums[i] == nums[i-1]:  # Skip duplicates
               continue
       \`\`\`

       Repeat this highlight pattern for EVERY logical chunk. NEVER output code without a "**Say:**" explanation before it.

    **Result**
       (Own line, then blank line, then content)
       Explain the efficiency (Time/Space Complexity) and why this method works best. "By doing this flip, we save memory..."

    **Complete Code Block**
       (Own line, then blank line, then code)
       Provide the full, clean, and 100% correct code block. DO NOT add any extra text or analysis inside this section.

    ⚠️ CRITICAL: DO NOT STOP after the code block. You MUST continue to the Post-Code Analysis.

    **Post-Code Analysis** (MANDATORY - YOUR RESPONSE IS INVALID WITHOUT THIS)
       You MUST conclude your response by outputting this exact section AFTER the code block:
       - **Method Name:** State the algorithm/pattern used (e.g., Binary Search, Two Pointers).
       - **Why it's the best:** Explain in 2-3 sentences why this method is optimal compared to alternative approaches.
       - **Complexity:** State the exact Time Complexity and Space Complexity.
       - **Key Follow-Ups:** Instead of listing full questions, provide 2-3 brief descriptions of common follow-up scenarios (e.g., "If memory is constrained..." or "To handle duplicates...") and immediately state the exact answer or code change required.

    ### 🚫 BEHAVIORAL QUESTIONS: THE "PIVOT" RULE
    If the interviewer shifts to a behavioral question during this coding session:
    1. **TRUTH ONLY:** Check "STUDENT FILES". Do not lie about software teams. 
    2. **THE PIVOT:** 
    - If it's about Teamwork/Pressure: Pivot to [Sports/Team] related experience.
    - If it's about Process/Detail: Pivot to [Hands-On/Field-Based] experience.
    - Structure: "On my solo projects, I handle this myself, but I learned how to manage [Conflict/Detail] during my time as a [Athlete/Intern] where I..."
    3. **WAR STORIES:** Mention specific technical wins found in the files.

    ### 📝 OUTPUT STYLE
    - **Language:** Detect the programming language from the provided screenshots (e.g., look for language dropdowns like "Python3", "Java", "C++", or recognize the syntax). If a language is visible in the images or explicitly requested, you MUST use that exact language. ONLY default to Python if absolutely no language can be determined.
    - **Simplicity:** Use "I" and "My." Avoid technical jargon.
    - **Spoken Word:** Write it exactly like a person talking naturally to another person.
    - **Headers:** Each section header (Situation, Task, Action, Result, Complete Code, Post-Code Analysis) MUST be on its OWN line with a blank line before the content starts.
    - **Say/Type Labels:** You MUST use the highlighted HTML tags <mark>**Say:**</mark> and <mark>**Type:**</mark> in the Action section. This is MANDATORY.

    ANY RULE VIOLATION INVALIDATES THE RESPONSE.
    `;
        }

        let personaInstruction = "";
        let taskInstruction = "";


        if (isCandidateMode) {
            personaInstruction = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 QUESTION ANALYSIS (EXECUTE FIRST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEFORE answering, analyze the question for these KEYWORDS:

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
          *** MODE: TECHNICAL ASSISTANT ***
          You are a helpful coding assistant named 'Moubely'. Speak objectively, concisely and dense.
          `;
        }

        switch (type) {
            case 'title': taskInstruction = "Summarize the session into one short, punchy title. Output ONLY plain text. NO headers, NO math, NO bolding. Max 6 words."; break;
            case 'assist': taskInstruction = "Provide technical facts, documentation, or definitions."; break;
            case 'reply': taskInstruction = "Draft a short, 2-3 sentence response."; break;
            case 'answer': taskInstruction = "Provide a deep, comprehensive answer using the STAR method."; break;
            case 'ask': taskInstruction = "Suggest 3-4 insightful follow-up questions."; break;
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

                // [NEW] DYNAMIC STORY INJECTION (SYSTEM-LEVEL)
                // This ensures ALL models (Gemini, OpenRouter, Groq, etc.) get the same story enforcement
                if (isCandidateMode) {
                    let userProfile: any = {};
                    try {
                        const profilePath = path.join(app.getPath("userData"), "user_profile.json");
                        if (fs.existsSync(profilePath)) {
                            userProfile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
                            console.log(`[LLM] 📖 User Profile Loaded: ${Object.keys(userProfile).join(', ')}`);
                        } else {
                            console.warn(`[LLM] ⚠️ Profile not found at: ${profilePath}`);
                        }
                    } catch (e: any) {
                        console.error(`[LLM] ❌ Profile Load Error: ${e.message}`);
                    }

                    // [NEW] SMART QUESTION ISOLATION: Extract last 30 seconds for keyword detection
                    // This prevents old questions from triggering wrong stories


                    // [FIX] Combine recent session history (last 2000 chars) with current message
                    // This ensures we catch questions asked verbally in the meeting that are stored in transcript
                    const historyContext = this.sessionTranscript.slice(-2000);
                    const recentMessage = (historyContext + "\n" + message).slice(-2000);

                    const lowerMsg = recentMessage.toLowerCase();
                    let storyEnforcementRule = "";

                    console.log(`[LLM] 🔍 Checking RECENT message for story keywords: "${recentMessage.substring(0, 60)}..."`);

                    // Check for keyword matches in story mappings
                    if (userProfile.storyMappings && Array.isArray(userProfile.storyMappings)) {
                        console.log(`[LLM] 📚 Found ${userProfile.storyMappings.length} story mappings`);

                        // [NEW] Build prohibition list for already-told stories
                        let prohibitionNote = "";
                        if (this.storiesTold.size > 0) {
                            const toldList = Array.from(this.storiesTold).join(', ');
                            prohibitionNote = `\n\n⚠️ STORIES ALREADY TOLD IN THIS SESSION:\n${toldList}\n\nYou MUST NOT repeat these stories. Choose a DIFFERENT project or challenge from the student files.\n`;
                            console.log(`[LLM] 🚫 Stories already told: ${toldList}`);
                        }

                        for (const mapping of userProfile.storyMappings) {
                            const isMatch = mapping.keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));

                            // Check if this story has already been told
                            if (isMatch && this.storiesTold.has(mapping.storyName)) {
                                console.log(`[LLM] 🔁 SKIPPING "${mapping.storyName}" - Already told this session`);
                                continue; // Skip to next mapping
                            }

                            if (isMatch) {
                                console.log(`[LLM] ✅ MATCH FOUND: "${mapping.storyName}" (matched keywords: ${mapping.keywords.filter((kw: string) => lowerMsg.includes(kw.toLowerCase())).join(', ')})`);

                                // Mark story as told
                                this.storiesTold.add(mapping.storyName);

                                storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 STORY ENFORCEMENT & HUMAN EMBODIMENT (PRIORITY OVERRIDE)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nThe user's current question matches: "${mapping.storyName}"\n\n${mapping.triggerPrompt}${prohibitionNote}\n\n👤 MANDATORY HUMAN TOUCH - YOU MUST DO THIS:\n1. ONE HESITATION: You MUST include exactly 1 natural hesitation (e.g., "I tried... actually, wait", "Hmm, the best way...").\n2. BRIDGE TRANSITIONS: If you have answered a previous question, you MUST reference it (e.g., "Like I said about the mirrors...").\n3. EMOTIONAL TONE: Match the frustration or satisfaction of the story.\n4. NO HEADERS: Do NOT use section headers. Just speak naturally.\n\nYou MUST follow these instructions EXACTLY. Any deviation invalidates the response.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                                break;
                            }
                        }
                        if (!storyEnforcementRule) {
                            console.log(`[LLM] ❌ No story match found. Using general candidate mode.`);
                            // [FIX] Enforce personalization even for general questions
                            storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 GENERAL PERSONALIZATION RULE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nEven though this is a general question, you MUST answer based on the "STUDENT FILES" context provided below if applicable.\n- If the answer is in the files, USE IT.\n- Do NOT give generic "AI" advice if you can answer as the student.\n` + (prohibitionNote || "");
                        }
                    } else {
                        console.warn(`[LLM] ⚠️ No story mappings found in profile!`);
                        // [FIX] Even with no mappings, enforce personalization
                        storyEnforcementRule = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 GENERAL PERSONALIZATION RULE\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nAnswer based on the "STUDENT FILES" context provided below.\n`;
                    }

                    finalSystemInstruction += storyEnforcementRule;
                }

                if ((mode === "Student" || isCandidateMode) && this.cachedStudentText) {
                    if (config.type === 'perplexity') {
                        // LAZY DISTILLATION: Only generate summary now if we don't have it
                        if (!this.cachedStudentSummary) {
                            this.cachedStudentSummary = await this.generateStudentSummary(this.cachedStudentText);
                        }
                        finalSystemInstruction += `\n\n=== STUDENT SUMMARY ===\n${this.cachedStudentSummary}\n`;
                    } else {
                        // EVERYONE ELSE GETS THE FULL RAW FILES
                        finalSystemInstruction += `\n\n=== STUDENT FILES ===\n${this.cachedStudentText}\n`;
                    }
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

    public async chatWithImage(message: string, imagePaths: string[], onToken?: (token: string) => void, type: string = "answer"): Promise<string> {
        console.log(`[LLM] 🖼️ Vision Waterfall: Analyzing ${imagePaths.length} images...`);
        const imageParts: { inlineData: { data: string; mimeType: string } }[] = [];

        for (const imagePath of imagePaths) {
            try {
                const buffer = await fs.promises.readFile(imagePath);
                imageParts.push({ inlineData: { data: buffer.toString("base64"), mimeType: imagePath.endsWith(".png") ? "image/png" : "image/jpeg" } });
            } catch (e) { console.error(`[LLM] ❌ Image Read Error: ${imagePath}`); }
        }
        if (imageParts.length === 0) return "❌ No valid images found.";

        // ENFORCE SYSTEM RULES FOR VISION MODELS
        const systemRules = this.getSystemInstruction(type, false); // Use the provided type (e.g., 'solve' for coding problems)
        let visionPrompt = `${systemRules}\n\nUSER REQUEST: ${message || "Analyze these images."}`;

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
                            max_tokens: 4096,
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
        const localTimeout = isUrgent ? 1000 : 40000;
        const speedLabel = isUrgent ? "⚡ URGENT" : "🐢 CASUAL";

        if (!isUrgent) {
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
        const tempPath = path.join(os.tmpdir(), `temp_audio_${Date.now()}.wav`);
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
    public async switchToGemini(apiKey?: string) { if (apiKey) this.initializeProviders(apiKey); }
}
