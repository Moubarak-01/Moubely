# Moubely - Intelligent Desktop Assistant

**Moubely** is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

---

## ✨ Latest Updates (v2.2)

We have just deployed major engineering improvements to intelligence, stability, and visibility:

* **⚡ The "Solve" Button**: A new dedicated coding tool (Terminal Icon).
    Moubely uses its Vision Brain to debug code from screenshots or listens to meeting transcripts to solve verbal problems when no screen is captured. It explains solutions line-by-line using a simple persona that relies on analogies and avoids technical jargon.
* **Expanded 18-Model "Brain"**: Integrated a massive Tier-1 logic engine including **Gemini 3.0 Pro**, **Gemini 3 Deep Think**, **Claude 3.7 Sonnet (Thinking)**, and **Claude 4.5 Opus**.
* **Critical Crash Fix (History Sanitization)**: Implemented a smart history slicer that prevents API rejections by ensuring conversation history *always* starts with a user message, unlocking strict APIs like Gemini and Perplexity.
* **"Blind Vision" Patch**: Fixed a routing logic error where the "Solve" button was sending images to the Text Brain. It now intelligently routes traffic to the correct Vision or Text model based on payload content.
* **"Read Once" Smart Caching**: The app now reads and OCRs your student profile/resume only **once** on startup and caches it in RAM. Subsequent chat responses are instant.
* **Live Terminal Telemetry**: Comprehensive logging system (`[IPC]`, `[LLM]`, `[Processing]`) lets you watch the app's decision-making in real-time.

---

## 🚀 Core Features

-   **👻 Stealth & Visibility Control**: Toggle instantly between **Stealth Mode** (invisible to screen sharing/recording) and **Visible Mode** (standard window for debugging or presentations) directly from the UI.
-   **📸 Contextual Vision (Multi-Shot)**: Instantly snap screenshots (`Ctrl + H`). Repeated presses **queue up to 6 screenshots** for multi-context analysis. Moubely "sees" your screen using a multi-model approach (Gemini, Claude Vision, or GPT-4o).
-   **🧠 Robust AI Waterfall**: Our Expanded AI engine supports 18+ models. If one model hits a rate limit or API error (e.g., 402 or 429), Moubely automatically switches to the next available one.
-   **🎙️ Hybrid Meeting Copilot**:
    * **Local-First Transcription**: Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine.
    * **Cloud Fallback**: Automatically switches to **Groq** if the local server gets too busy or if **Smart Mode** is enabled (1000ms timeout logic).
    * **Instant Digital Twin**: Uses the **STAR method** to provide spoken-word answers based on your actual project "war stories," strictly adhering to a **"Pivot Rule"** (never lies about teams, pivots to individual research experience).
    * **Post-Meeting Reliability**: The email generation uses your Student Mode persona to ensure follow-ups are authentic to your experience.

---

## 🛠️ Engineering Architecture: The "Waterfall" System

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes elite reasoning models before falling back to faster or local resources.

### 1. The "Brains" (Chat & Logic) 🧠
The app utilizes a massive **18-Model Waterfall** to ensure you always get an answer:
1.  **Tier 1: Supreme Reasoning** - Gemini 3.0 Pro, Gemini 3 Deep Think, Claude 3.7 Sonnet (Thinking), Claude 4.5 Opus.
2.  **Tier 2: High-Speed** - Gemini 3.0 Flash, Claude 4.5 Sonnet.
3.  **Tier 3: Efficiency** - Claude 4.5 Haiku, Gemini 2.5 Flash Lite.
4.  **Tier 4: Open Source** - Gemma 3 Family (27B, 12B, 4B).
5.  **Tier 5: Research** - Perplexity Sonar (Reasoning Pro) - Live Web Search.
6.  **Tier 6: Backup** - GPT-4o, DeepSeek R1, Groq Llama 3.3.

### 2. The "Eyes" (Vision) 👁️
1.  **Tier 1**: Nano Banana Pro (Gemini 3 Image Preview), Claude 3.7 Sonnet (Reasoning Vision).
2.  **Tier 2**: Gemini 2.5 Flash (The reliable workhorse).
3.  **Tier 3**: Perplexity Vision & GPT-4o Vision.

### 3. The "Ears" (Audio) 👂
1.  **Local Whisper (Queue-Optimized)**: Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000.
2.  **Groq (Whisper-Large-V3)**: Instant cloud fallback if the local queue times out or fails.

### 4. Smart PDF Handling 📄
-   **Primary:** Uses a local `pdf-parse` library to extract text on your CPU.
-   **Fallback (OCR Backup):** Uses `OCR Space` API if the PDF is an image scan and as fallback when local `pdf-parse` fails.

---

## ⚡ Tech Stack

Moubely is built using a modern, performant, and resilient full-stack JavaScript architecture.

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Desktop Framework** | **Electron** | Cross-platform desktop application shell. |
| **Frontend** | **React & TypeScript** | User Interface and application logic. |
| **Styling** | **Tailwind CSS** | Utility-first CSS framework. |
| **Bundling/Dev** | **Vite** | Fast development server and build tool. |
| **AI/Logic Core** | **Gemini, Claude, GPT-4o, DeepSeek** | Multi-Model AI Waterfall for chat and reasoning. |
| **Local Services** | **Local Whisper Server** | Fast, local audio transcription. |
| **Display** | **KaTeX, Highlight.js** | Latex formulas and code syntax highlighting. |

---

## 🐛 Solved Engineering Challenges

### 1. The "First Message" API Crash (Gemini/Perplexity)
* **The Problem:** Gemini 3.0 and Perplexity APIs strictly require the first message in the chat history to be from the `user`. Our app sometimes started history with an AI greeting (`role: model`), causing 100% failure rates.
* **The Fix:** We implemented **History Sanitization** in `LLMHelper.ts`. Before sending any request, the code scans the history array, finds the index of the first `user` message, and slices everything before it.

### 2. The "Blind" Solve Button
* **The Problem:** The "Solve" button was blindly sending requests to the `gemini-chat` (Text) endpoint, even when screenshots were attached. The AI would receive the text "Solve this image" but see absolute darkness.
* **The Fix:** We implemented **Split Routing** in `Queue.tsx`. The function now checks `if (hasImages)`:
    * *True:* Routes to `chatWithImage` and manually injects the "High School" persona prompt.
    * *False:* Routes to `gemini-chat` using the standard backend persona.

### 3. Deep Stealth Mouse Control
* **The Problem:** Even with `setContentProtection`, the mouse pointer was visible to screen recorders when interacting with the window.
* **The Fix:** We implemented synchronized, time-gated control. The main process sets the window to **click-through** (`win.setIgnoreMouseEvents`), while the frontend simultaneously applies a CSS class (`cursor: none`) to hide the pointer.

### 4. The Transcript "Race Condition"
* **The Problem:** Groq (Cloud) processed faster than Local Whisper, causing Sentence B to appear before Sentence A.
* **The Fix:** We implemented a **Ticket System**. Every audio chunk is timestamped in the frontend. The backend returns this ID, and the UI sorts the log by ID, ensuring perfect chronological order.

### 5. The "Tesla" Persona Hallucination
* **The Problem:** The AI sounded too high-level and invented fake software teams for behavioral questions.
* **The Fix:** We added a **Simple Voice Filter** in `LLMHelper.ts`. It explicitly bans corporate jargon and forces a "Pivot Rule" to use your real experience you have when software team context is missing.

### 6. The Ghost Window (Critical Visibility Crash)
* **The Problem:** The app would start with no window visible at all due to Electron transparency bugs.
* **The Fix:** In `electron/WindowHelper.ts`, we implemented an aggressive `ready-to-show` callback with an explicit `win.focus()` to force the OS compositor to render the window. (Faced a lot of those by the way).

### 7. The "Silent Crash" (Circular Dependency)
* **The Problem:** The app would hang on startup because `Main` and `IPC Handlers` were importing each other.
* **The Fix:** We refactored the architecture to use **Type-Only Imports** (`import type`) to break the dependency loop.

### 8. "Thinking" Process Clean-Up
* **The Problem:** Reasoning models (like DeepSeek) output their internal monologue (`<think>...`), cluttering the chat.
* **The Fix:** We implemented a **Universal Response Cleaner** in the backend that intercepts the raw stream and filters out thought tags in real-time.

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

    # 4. THE RESEARCHER & REASONER (Search + Claude)
    PERPLEXITY_API_KEY=your_perplexity_key_here
    OPENROUTER_API_KEY=your_openrouter_key_here

    # 5. PDF RECOVERY (Scanned Docs)
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
