# Moubely - Intelligent Desktop Assistant

Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

## 🚀 Core Features

- **👻 Stealth Overlay**: A fully transparent, click-through window that floats on top of your applications. It stays invisible until you need it, ensuring you never break flow.
- **📸 Contextual Vision**: Instantly snap screenshots (`Ctrl + H`) of code errors, complex charts, or emails. Moubely "sees" your screen and provides specific, context-aware solutions.
- **🎙️ Live Meeting Copilot**:
  - **Ultra-Fast Transcription**: Now powered by **Groq (Whisper-Large-V3)** for near-instant, verbatim speech-to-text.
  - **Smart Assists**: One-click buttons to generate suggestions, follow-up questions, or instant recaps.
  - **Auto-Summaries & Titles**: Automatically detects when a meeting ends, drafts a professional follow-up email, and generates a smart, concise title for the session.
- **🧠 Hybrid AI Engine**: A "Three-Brain" architecture optimized for speed and stability:
  - **Ears:** **Groq** for high-speed audio processing.
  - **Brain:** **GitHub Models (DeepSeek-V3 & GPT-4o)** for complex logic and chat.
  - **Eyes:** **GPT-4o Vision** (via GitHub) with **Gemini** as a fallback.
- **⚡ Smart Modes**: Switch between **Developer** (code-focused), **Student** (explanatory), and **General** modes to tailor the AI's personality to your current task.

---

## 🛠️ Engineering Challenges & Architecture Overhaul

We recently rebuilt the backend to solve critical stability issues. Here is a breakdown of the problems we faced and the solutions we implemented:

### 1. The "Loop of Death" (Rate Limits & 404s)
* **The Problem:** Relying solely on the free tier of a single provider (Gemini) caused frequent `429 Too Many Requests` errors during long sessions. Additionally, specific experimental models would occasionally return `404 Model Not Found` depending on region or availability.
* **The Fix:** We implemented a **Cascading Fallback System**.
    * **Primary:** The app now defaults to **DeepSeek-V3** (via GitHub Models) for chat.
    * **Fallback:** If that fails, it instantly switches to **GPT-4o**.
    * **Safety Net:** If both fail, it gracefully falls back to **Gemini 1.5 Flash**.

### 2. Azure Content Filters (400 Bad Request)
* **The Problem:** When we attempted to use GitHub Models for everything, sending raw audio binary data to the text completion endpoint triggered Azure's "Content Filters," crashing the app with `400` errors.
* **The Fix:** We built a **Smart Routing Engine** in `LLMHelper.ts`. The app now identifies the data type before sending:
    * **Text** → Routes to **GitHub Models** (Logic).
    * **Audio** → Routes to **Groq** (Whisper).
    * **Images** → Routes to **GitHub Vision** or **Gemini**.

### 3. Transcription Latency
* **The Problem:** Standard API transcription was too slow for real-time conversation feedback.
* **The Fix:** We integrated **Groq**, which processes audio ~10x faster than real-time, eliminating the "freeze" during dictation.

---

## 💻 How to Run Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js) or **yarn**

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
    Create a `.env` file in the root directory. You need **three keys** for the full hybrid experience.

    ```env
    # 1. For Vision & Safety Net Fallback (Get at aistudio.google.com)
    GEMINI_API_KEY=your_google_key_here

    # 2. For Logic, Chat, & Vision (Get at [github.com/marketplace/models](https://github.com/marketplace/models))
    # This single token powers BOTH DeepSeek-V3 and GPT-4o
    GITHUB_TOKEN=your_github_token_here

    # 3. For Ultra-Fast Speech-to-Text (Get at console.groq.com)
    GROQ_API_KEY=your_groq_key_here
    ```

4.  **Run the App**
    Start the development server and Electron app simultaneously:
    ```bash
    npm start
    ```

### Building for Production
To create an executable file (e.g., `.dmg`, `.exe`, or `.AppImage`) for your operating system:
```bash
npm run dist
📂 Project Structure
/ (root)
├── package.json
├── tsconfig.json
├── .env                <-- Contains GEMINI, GITHUB, and GROQ keys
├── electron/
│   ├── main.ts
│   ├── ipcHandlers.ts  <-- Backend logic & IPC routing
│   ├── LLMHelper.ts    <-- The Hybrid Brain (Manages Smart Routing & Fallbacks)
│   ├── WindowHelper.ts <-- Window management
│   └── preload.ts      <-- Bridge
├── src/
│   ├── App.tsx         <-- Main Entry
│   ├── _pages/
│   │   └── Queue.tsx   <-- Core UI (Chat, Transcript, Visualizer)
│   └── index.css       <-- Glassmorphism Styles
└── index.html