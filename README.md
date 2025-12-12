# Moubely - Intelligent Desktop Assistant

**Moubely** is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

## 🚀 Core Features

- **👻 Stealth Overlay**: A fully transparent, click-through window that floats on top of your applications. It stays invisible until you need it, ensuring you never break flow.
- **📸 Contextual Vision**: Instantly snap screenshots (`Ctrl + H`) of code errors, complex charts, or emails. Moubely "sees" your screen using a multi-model approach (Gemini, Perplexity, or GPT-4o) depending on the content.
- **🎙️ Hybrid Meeting Copilot**:
  - **Local-First Transcription**: Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine. It features a smart **Queue System** to handle fast speakers without overwhelming your laptop.
  - **Cloud Fallback**: Automatically switches to **Groq** if the local server gets too busy, ensuring you never miss a word.
  - **Smart Assists**: One-click buttons to generate suggestions, follow-up questions, or instant recaps.
  - **Strict Title Generation**: Automatically detects when a meeting ends and generates a clean, concise title (e.g., "Kingdom Come Dimension Song Discussion").
- **🧠 5-Layer Waterfall AI**: A robust architecture that ensures you always get an answer, even if one provider is down.
- **⚡ Smart Modes**: Switch between **Developer** (DeepSeek Logic), **Student** (Explanatory), and **General** modes to tailor the AI's personality.

---

## 🛠️ Engineering Architecture: The "Waterfall" System

We recently rebuilt the backend to solve critical stability issues. Moubely now uses a **Smart Routing Engine** in `LLMHelper.ts` that prioritizes free, local resources before falling back to cloud APIs.

### 1. The "Brains" (Chat & Logic) 🧠
The app tries these models in order until one succeeds:
1.  **Gemini 2.5 Flash** (Primary - Fast & Multimodal)
2.  **DeepSeek R1** (Logic Specialist - Great for Math/Coding)
3.  **Perplexity Online** (Researcher - Real-time Web Search)
4.  **GPT-4o** (Reliable Backup)
5.  **Groq Llama 3.3** (Speed Fallback)

### 2. The "Eyes" (Vision) 👁️
How Moubely analyzes your screenshots:
1.  **Gemini 2.5 Flash**: The primary vision model.
2.  **Perplexity Vision**: Automatically used for **general images** (paintings, landscapes), but **automatically skipped** for coding/debugging tasks to ensure accuracy.
3.  **GPT-4o Vision**: The fallback for critical coding screenshots.

### 3. The "Ears" (Audio) 👂
1.  **Local Whisper (Queue-Optimized)**: Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000. We implemented a **Queue System** to prevent `ECONNRESET` crashes on laptops by processing audio chunks sequentially.
2.  **Groq (Whisper-Large-V3)**: Secondary. Instant cloud fallback if the local queue times out or fails.

### 4. Smart PDF Handling 📄
We removed dependencies on external OCR keys.
- **Primary:** Sends PDFs natively to Gemini for perfect chart/text understanding.
- **Fallback:** Uses a local `pdf-parse` library to extract text on your CPU if Gemini is down.

---

## 🚧 Known Issues & Roadmap

### Formula Rendering
While we have implemented LaTeX support (`$$x^2$$`) for mathematical formulas, **we are still refining the visual output.** Currently, complex equations may not always render with the crystal-clear formatting we aim for. We are actively working on improving the `rehype-katex` integration to fix this.

---

## 💻 How to Run Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

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
├── .env                  <-- Contains API Keys
├── local-whisper-server.mjs <-- The Local AI Audio Engine (Queue System)
├── electron/
│   ├── main.ts
│   ├── LLMHelper.ts      <-- The "Waterfall" Logic & Smart Router
│   ├── ProcessingHelper.ts
│   └── ScreenshotHelper.ts
├── src/
│   ├── App.tsx           <-- Main UI Entry
│   ├── components/
│   │   └── AIResponse.tsx <-- Markdown & LaTeX Rendering Logic
│   └── index.css         <-- Glassmorphism Styles
└── index.html