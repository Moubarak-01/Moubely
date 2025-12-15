# Moubely - Intelligent Desktop Assistant

**Moubely** is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

---

## ✨ Latest Updates (v2.0)

We have just deployed major engineering improvements to stability and visibility:

* **Smart "Thinking" UI**: A new adaptive loader that only appears if the AI takes longer than **2 seconds**. This prevents UI flickering on fast responses (like Groq) while reassuring you during complex tasks (like DeepSeek reasoning).
* **Live Terminal Telemetry**: We've added a comprehensive logging system. Watch your terminal to see the app's brain in action:
    * `[IPC]`: User actions (Clicks, Inputs).
    * `[Processing]`: Internal logic and data movement.
    * `[LLM]`: External API calls, model switching, and fallback decisions.
* **OCR Auto-Recovery**: If a PDF is scanned (image-only) and local parsing fails, Moubely now automatically detects the error and switches to **OCR Space API** to read the document visually.
* **Expanded Model Support**: Added support for **Gemini 2.5 Flash**, **Gemma 3 (Open Models)**, and **DeepSeek R1**.

---

## 🚀 Core Features

-   **👻 Stealth & Visibility Control**: Toggle instantly between **Stealth Mode** (invisible to screen sharing/recording) and **Visible Mode** (standard window for debugging or presentations) directly from the UI.
-   **📸 Contextual Vision**: Instantly snap screenshots (`Ctrl + H`) of code errors, complex charts, or emails. Moubely "sees" your screen using a multi-model approach (Gemini, Perplexity, or GPT-4o) depending on the content.
-   **🧠 Robust AI Waterfall**: We have expanded our AI engine to support a wide range of models. If one model hits a rate limit, Moubely automatically switches to the next available one to ensure reliability.
-   **🎙️ Hybrid Meeting Copilot**:
    -   **Local-First Transcription**: Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine. It features a smart **Queue System** to handle fast speakers without overwhelming your laptop.
    -   **Cloud Fallback**: Automatically switches to **Groq** if the local server gets too busy.
    -   **Smart Assists**: One-click buttons to generate suggestions, follow-up questions, or instant recaps.
-   **⚡ Smart Modes**: Switch between **Developer** (DeepSeek Logic), **Student** (Explanatory), and **General** modes to tailor the AI's personality.

---

## 🛠️ Engineering Architecture: The "Waterfall" System

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes free, local resources before falling back to cloud APIs.

### 1. The "Brains" (Chat & Logic) 🧠
The app tries these models in order until one succeeds:
1.  **Gemini 2.5 Family** (Flash & Lite - Primary High-Speed)
2.  **Gemini 2.0 Family** (Standard Fallback)
3.  **Gemma 3** (Open Models: 27B, 12B, 4B)
4.  **Perplexity Pro** (Research & Real-time Web Search)
5.  **GPT-4o** (Reliable Backup via GitHub Models)
6.  **DeepSeek R1** (Logic Specialist)
7.  **Groq Llama 3.3** (Ultimate Speed Fallback)

### 2. The "Eyes" (Vision) 👁️
1.  **Gemini 2.5 Flash**: The primary vision model.
2.  **Perplexity Vision**: Automatically used for research-heavy images.
3.  **GPT-4o Vision**: The fallback for critical coding screenshots.

### 3. The "Ears" (Audio) 👂
1.  **Local Whisper (Queue-Optimized)**: Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000.
2.  **Groq (Whisper-Large-V3)**: Instant cloud fallback if the local queue times out or fails.

### 4. Smart PDF Handling 📄
-   **Primary:** Sends PDFs natively to Gemini for perfect chart/text understanding.
-   **Fallback:** Uses a local `pdf-parse` library to extract text on your CPU if Gemini is down.
-   **OCR Backup:** Uses `OCR Space` API if the PDF is an image scan.

---

## 🐛 Solved Engineering Challenges

### 1. The "2-Second Delay" Loader
* **The Problem:** Showing a "Thinking..." spinner instantly caused flickering for fast models, but hiding it made slow models look broken.
* **The Fix:** We implemented a `setTimeout` logic in the UI. The spinner *only* appears if the request takes longer than 2 seconds. The moment the first streaming token arrives, the timer is killed and the spinner vanishes.

### 2. The "Silent Crash" (Circular Dependency)
* **The Problem:** The app would hang on startup because `Main` and `IPC Handlers` were importing each other.
* **The Fix:** We refactored the architecture to use **Type-Only Imports** (`import type`). This broke the dependency loop, allowing the backend to initialize instantly.

### 3. "Thinking" Process Clean-Up
* **The Problem:** Reasoning models (like DeepSeek) output their internal monologue (`<think>...`), cluttering the chat.
* **The Fix:** We implemented a **Universal Response Cleaner** in the backend. It intercepts the AI's raw stream, filters out thought tags and citation numbers (`[1]`) in real-time, delivering only the final answer.

### 4. Strict Formula Standardization
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