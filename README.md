# Moubely - Intelligent Desktop Assistant

**Moubely** is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

---

## ✨ Latest Updates (v2.1)

We have just deployed major engineering improvements to intelligence, stability, and visibility:

* **Expanded 14-Model "Brain"**: Integrated a massive waterfall of models including **Gemini 3.0 Flash**, **Gemini Robotics**, **Gemma 3 Open Models**, and the full **Perplexity Sonar Suite**.
* **"Read Once" Smart Caching**: The app now reads and OCRs your student profile/resume only **once** on startup and caches it in RAM. Subsequent chat responses are instant, saving massive amounts of CPU and API quota.
* **Context Distillation**: For search-based models like **Perplexity**, the app automatically generates a **condensed summary** of your profile to prevent context overload, while sending the full deep-dive context to Gemini/GPT-4o.
* **Universal Context**: The Notion Workspace bridge now works in **all modes** (Student, Developer, General), ensuring the AI always knows your current project context.
* **Smart "Thinking" UI**: A new adaptive loader that only appears if the AI takes longer than **2 seconds**. This prevents UI flickering on fast responses.
* **Live Terminal Telemetry**: Comprehensive logging system (`[IPC]`, `[LLM]`, `[Processing]`) lets you watch the app's decision-making in real-time.

---

## 🚀 Core Features

-   **👻 Stealth & Visibility Control**: Toggle instantly between **Stealth Mode** (invisible to screen sharing/recording) and **Visible Mode** (standard window for debugging or presentations) directly from the UI.
-   **📸 Contextual Vision (Multi-Shot)**: Instantly snap screenshots (`Ctrl + H`). Repeated presses **queue up to 6 screenshots** for multi-context analysis. Moubely "sees" your screen using a multi-model approach (Gemini, Perplexity, or GPT-4o) depending on the content.
-   **🧠 Robust AI Waterfall**: Our Expanded AI engine supports a wide range of models. If one model hits a rate limit, Moubely automatically switches to the next available one to ensure reliability.
-   **🎙️ Hybrid Meeting Copilot**:
    * **Local-First Transcription**: Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine.
    * **Cloud Fallback**: Automatically switches to **Groq** if the local server gets too busy.
    * **Smart Assists**: One-click buttons to generate suggestions, follow-up questions, or instant recaps.
    * **Post-Meeting Reliability**: The email generation waits a **minimum of 15 seconds** after the session ends to ensure all final audio chunks have been processed.
-   **⚡ Smart Modes**: Switch between **Developer** (DeepSeek Logic), **Student** (Explanatory), and **General** modes to tailor the AI's personality.

---

## 🛠️ Engineering Architecture: The "Waterfall" System

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes free, local resources before falling back to cloud APIs.

### 1. The "Brains" (Chat & Logic) 🧠
The app utilizes a massive **14-Model Waterfall** to ensure you always get an answer:
1.  **Gemini 2.5 Family** (Flash & Lite) - Primary High-Speed.
2.  **Gemini 3.0 Series** (Flash & Robotics) - Next-Gen Preview Models.
3.  **Gemma 3** (Open Models: 27B, 12B, 4B) - Local-style logic.
4.  **Perplexity Sonar** (Reasoning Pro, Deep Research, Pro) - Live Web Search (Uses Distilled Context).
5.  **GPT-4o & DeepSeek R1** (via GitHub Models) - Reliable Backups.
6.  **Groq Llama 3.3** - Ultimate Speed Fallback.

### 2. The "Eyes" (Vision) 👁️
1.  **Gemini 2.5 Flash**: The primary vision model.
2.  **Gemini 2.0 Flash**: Standard stable vision.
3.  **Perplexity Vision**: Automatically used for research-heavy images.
4.  **GPT-4o Vision**: The fallback for critical coding screenshots.

### 3. The "Ears" (Audio) 👂
1.  **Local Whisper (Queue-Optimized)**: Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000.
2.  **Groq (Whisper-Large-V3)**: Instant cloud fallback if the local queue times out or fails.

### 4. Smart PDF Handling 📄
-   **Primary:** Uses a local `pdf-parse` library to extract text on your CPU if Gemini is down.
-   **Fallback (OCR Backup):** Uses `OCR Space` API if the PDF is an image scan.

### 5. Context Intelligence ⚡
-   **"Read Once" Memory:** The app reads and OCRs your student profile/resume only **once** on startup and caches it in RAM. Subsequent chat responses are instant.
-   **Context Distillation:** For search-based models like **Perplexity**, the app automatically generates a **condensed summary** of your profile (using Gemini Flash) to prevent context overload, while sending the full deep-dive context to Gemini/GPT-4o.
-   **Universal Notion:** Connects to your workspace to fetch recent project context in **all modes**.

---

## ⚡ Tech Stack

Moubely is built using a modern, performant, and resilient full-stack JavaScript architecture.

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Desktop Framework** | **Electron** | Cross-platform desktop application shell and operating system integration. |
| **Frontend** | **React & TypeScript** | User Interface and application logic. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework for rapid, consistent styling. |
| **Bundling/Dev** | **Vite** | Fast development server and build tool. |
| **AI/Logic Core** | **Gemini, GPT-4o, Perplexity, DeepSeek, Groq** | Multi-Model AI Waterfall for chat, vision, and reasoning. |
| **Local Services** | **Local Whisper Server** | Fast, local audio transcription for meetings. |
| **Display** | **KaTeX, Highlight.js** | Rendering complex LaTeX formulas and providing syntax highlighting for code blocks. |

---

## 🐛 Solved Engineering Challenges

### 1. Deep Stealth Mouse Control (The Final Step in Invisibility)
* **The Problem:** Even with `setContentProtection` enabled, the user's mouse pointer was visible to screen recorders when interacting with the Moubely window, breaking the illusion of stealth.
* **The Fix:** We implemented synchronized, time-gated control:
    * The frontend (`App.tsx`) uses `onMouseMove` to detect if the cursor is **not** over an interactive button or input field (`.interactive`).
    * If non-interactive, it immediately sends an IPC call (`toggle-mouse-ignore`) to the main process.
    * The main process sets the window to **click-through** (`win.setIgnoreMouseEvents(true, { forward: true })`), while the frontend simultaneously applies a CSS class (`cursor: none !important`) to hide the pointer, making the window completely invisible and non-interactive to shared screens until the cursor moves over a button.

### 2. The Ghost Window (Critical Visibility Crash)
* **The Problem:** The app would start with no window visible at all (not even the frame) due to the combination of `show: false` and transparency in Electron, a known rendering bug on certain Windows/Linux systems.
* **The Fix:** In `electron/WindowHelper.ts`, we implemented an aggressive `ready-to-show` callback with an explicit `win.focus()`. This forces the OS compositor to render the window, solving the total invisibility issue.

### 3. The Inconsistent UI Crash (Race Condition)
* **The Problem:** In Dev mode, React crashed immediately (`TypeError: Cannot read properties of undefined`) because the UI tried to access `window.electronAPI` before the `preload.ts` script finished loading.
* **The Fix:** We implemented **critical safety checks** (`if (window.electronAPI)`) around all API calls in both `App.tsx` and `Queue.tsx`, preventing the race condition and ensuring stable app startup.

### 4. Multi-Shot & Failed Instant Send
* **The Problem:** The original flow had an instant-send shortcut that often failed to serialize the image paths correctly to the backend API. Additionally, the chat history only showed a preview of the *first* image, confusing the user.
* **The Fix:** We unified the shortcut: **`Ctrl + H`** is now the sole shortcut and **always** performs the "Take & Queue" action. The message object in `Queue.tsx` was updated to hold and correctly render a **gallery** of *all* queued screenshots in the chat history, ensuring the analysis API receives the full, verified array.

### 5. Meeting Summary Delay (Reliability)
* **The Problem:** The post-meeting email summary could sometimes be incomplete if the local transcription server was slow, as the system only waited a minimal time for stability before drafting the email.
* **The Fix:** We modified the logic in `Queue.tsx` to enforce a **minimum 15-second waiting period** after the user clicks stop. The app then verifies 2 seconds of silence/stability, maximizing the chance that all transcribed audio chunks are included in the final summary.

### 6. The "2-Second Delay" Loader
* **The Problem:** Showing a "Thinking..." spinner instantly caused flickering for fast models, but hiding it made slow models look broken.
* **The Fix:** We implemented a `setTimeout` logic in the UI. The spinner *only* appears if the request takes longer than 2 seconds. The moment the first streaming token arrives, the timer is killed and the spinner vanishes.

### 7. The "Silent Crash" (Circular Dependency)
* **The Problem:** The app would hang on startup because `Main` and `IPC Handlers` were importing each other.
* **The Fix:** We refactored the architecture to use **Type-Only Imports** (`import type`). This broke the dependency loop, allowing the backend to initialize instantly.

### 8. "Thinking" Process Clean-Up
* **The Problem:** Reasoning models (like DeepSeek) output their internal monologue (`<think>...`), cluttering the chat.
* **The Fix:** We implemented a **Universal Response Cleaner** in the backend. It intercepts the AI's raw stream, filters out thought tags and citation numbers (`[1]`) in real-time, delivering only the final answer.

### 9. Strict Formula Standardization
* **The Problem:** Different AI models use different syntax for math (brackets `[...]` vs. dollar signs `$`), causing equations to break.
* **The Fix:** We enforced a **Strict System Prompt** that overrides individual model defaults. We now force every AI to use standard LaTeX formatting (`$$`), guaranteeing that equations render correctly.

---

## 💻 How to Run Locally

### Prerequisites
-   **Node.js** (v18 or higher recommended)
-   **npm** or **yarn**

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone [https://github.com/Moubarak-01/Moubely.git](https://github.com/Moubarak-01/Moubely.git)
    cd Moubely
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables (Crucial)**
    Create a `.env` file in the root directory.

    ```env
    # 1. THE BRAINS & EYES (Primary Chat + Vision)
    GEMINI_API_KEY=your_google_key_here

    # 2. THE LOGIC & BACKUP (DeepSeek + GPT-4o)
    GITHUB_TOKEN=your_github_token_here

    # 3. THE CLOUD EARS (Audio Backup)
    GROQ_API_KEY=your_groq_key_here

    # 4. THE RESEARCHER (Search + General Vision)
    PERPLEXITY_API_KEY=your_perplexity_key_here

    # 5. CONTEXT (Personalization)
    NOTION_TOKEN=your_notion_token_here

    # 6. PDF RECOVERY (Scanned Docs)
    OCR_SPACE_API_KEY=your_ocr_key_here
    ```

4.  **Run the Local Whisper Server**
    Open a terminal and start the audio engine:
    ```bash
    node local-whisper-server.mjs
    ```

5.  **Run the App**
    Open a second terminal and start the electron app:
    ```bash
    npm start
    ```

### Building for Production
To create an executable file (e.g., `.dmg`, `.exe`) for your OS:
```bash
npm run dist
📂 Project Structure
/ (root)
├── package.json
├── .env                        <-- Contains API Keys
├── local-whisper-server.mjs    <-- Local AI Audio Engine
├── electron/
│   ├── main.ts                 <-- App Entry Point
│   ├── LLMHelper.ts            <-- The "Waterfall" Logic & Smart Router
│   ├── ProcessingHelper.ts     <-- Automation Workflow
│   └── ipcHandlers.ts          <-- Logs & Communication
├── src/
│   ├── App.tsx                 <-- Main UI Entry
│   ├── _pages/
│   │   └── Queue.tsx           <-- Main Chat Interface (Streaming Logic)
│   ├── components/
│   │   └── AIResponse.tsx      <-- Markdown & LaTeX Rendering Logic
│   └── index.css               <-- Glassmorphism Styles
└── index.html
