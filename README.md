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
  - **Ears:** **Groq** for audio processing.
  - **Brain:** **GitHub Models (GPT-4o-mini)** for logic and chat.
  - **Eyes:** **Google Gemini** for image analysis and fallback support.
- **⚡ Smart Modes**: Switch between **Developer** (code-focused), **Student** (explanatory), and **General** modes to tailor the AI's personality to your current task.

## 🌟 Latest Updates (Stability & Features)

### 🛠️ **Architecture Overhaul: Solving the "Loop of Death"**
We encountered significant stability issues with the single-model approach. Here is how we fixed them:

1.  **Issue: Rate Limits (429) & Model Not Found (404)**
    * **The Problem:** Relying solely on the free tier of Gemini caused frequent `429 Too Many Requests` errors during long sessions, and some models returned `404` depending on region.
    * **The Fix:** We implemented a **Cascading Fallback System**. The app now prioritizes **GitHub Models (GPT-4o-mini)** for text. If that fails, it instantly falls back to a prioritized list of Gemini models (`1.5-flash-8b` -> `1.5-flash` -> `1.5-pro`).

2.  **Issue: Azure Content Filters (400 Errors)**
    * **The Problem:** When we tried using GitHub Models for everything, audio data triggered Azure's "Content Filters" because the text endpoint couldn't interpret binary audio, resulting in `400 Bad Request` crashes.
    * **The Fix:** We built a **Smart Routing Engine** in `LLMHelper.ts`:
        * **Text** → Routes to **GitHub Models** (Logic).
        * **Audio** → Routes to **Groq** (Whisper).
        * **Images** → Routes to **Gemini** (Vision).

3.  **Issue: Transcription Latency**
    * **The Problem:** Standard API transcription was too slow for real-time feedback.
    * **The Fix:** Integrated **Groq**, which processes audio ~10x faster than real-time, eliminating the "freeze" during dictation.

### ✨ **New Implementations**
- **Smart Meeting Titles**: No more "Meeting 12/07." Moubely now analyzes the transcript context to generate specific titles like "Marketing Strategy Sync" or "Q4 Budget Review."
- **User-Mimicking Prompts**: Clicking buttons like "What to say?" now inserts a user message (e.g., *"What should I say next?"*) into the chat history. This makes the interaction feel natural and keeps a record of your requests.
- **Robust Restart Loop**: The recording engine now processes audio in smart 5-second chunks with a seamless restart loop, ensuring the microphone never disconnects during hour-long meetings.

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
    Create a `.env` file in the root directory. You now need **three keys** for the full hybrid experience (though the app works with just one via fallbacks).

    ```bash
    # 1. For Vision & Fallback (Get at aistudio.google.com)
    GEMINI_API_KEY=your_google_key_here

    # 2. For Logic/Chat (Get at [github.com/settings/tokens](https://github.com/settings/tokens))
    GITHUB_TOKEN=your_github_token_here

    # 3. For Speech-to-Text (Get at console.groq.com)
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