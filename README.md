# Moubely - Intelligent Desktop Assistant

Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

## 🚀 Core Features

- **👻 Stealth Overlay**: A fully transparent, click-through window that floats on top of your applications. It stays invisible until you need it, ensuring you never break flow.
- **📸 Contextual Vision**: Instantly snap screenshots (`Ctrl + H`) of code errors, complex charts, or emails. Moubely "sees" your screen and provides specific, context-aware solutions.
- **🎙️ Live Meeting Copilot**:
  - **Real-time Transcription**: Captures system and microphone audio to transcribe meetings live.
  - **Smart Assists**: One-click buttons to generate "What to say?" suggestions, follow-up questions, or instant recaps during the call.
  - **Auto-Summaries**: Automatically detects when a meeting ends and drafts a professional follow-up email and summary.
- **🧠 Multi-Model AI Engine**: Powered by **Gemini 2.0 Flash** for blazing fast responses, with fallback to **Gemini 1.5**. Also supports **Ollama** for completely local, private AI processing.
- **⚡ Smart Modes**: Switch between **Developer** (code-focused), **Student** (explanatory), and **General** modes to tailor the AI's personality to your current task.

## 🌟 Latest Updates (Stability & Features)

### 🎙️ **Robust Live Transcription**
- **Restart Loop Engine:** We completely rewrote the recording logic. Moubely now processes audio in smart 5-second chunks with a seamless restart loop. This eliminates `400 Bad Request` and `429 Too Many Requests` errors, ensuring your transcript **never freezes** during long meetings.
- **Smart Fallback:** The AI now automatically switches between `gemini-2.0-flash-exp` and `gemini-1.5-flash`. If one model is down or rate-limited, Moubely instantly swaps to the other to keep your assistant running.
- **Audio Visualizer:** A new real-time waveform visualizer in the Transcript tab lets you confirm instantly that Moubely is hearing you (and your system audio).

### 🛠️ **UI & UX Polish**
- **Copy Code Fixed:** The "Copy" button on code blocks now works perfectly (no more `[object Object]` errors).
- **Auto-Expanding Input:** The chat bar smoothly expands as you type and scrolls automatically, so you never lose sight of your prompt.
- **New Shortcuts:**
  - **`Ctrl + N`**: Start a fresh chat session instantly.
  - **`Ctrl + R`**: Full reset (clears chat, transcript, and memory).
  - **`Ctrl + H`**: Snap a screenshot and attach it to the chat.

## 💻 How to Run Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js) or **yarn**

### Installation Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/Moubarak-01/Moubely.git
    cd Moubely
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment Variables**
    Create a `.env` file in the root directory and add your Google Gemini API key:
    ```bash
    GEMINI_API_KEY=your_actual_api_key_here
    ```
    *(You can get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey))*

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
├── .env                <-- You need to create this (GEMINI_API_KEY=...)
├── electron/
│   ├── main.ts
│   ├── ipcHandlers.ts  <-- Backend logic (Resizing, AI calls)
│   ├── LLMHelper.ts    <-- AI Brain (Gemini/Ollama with Fallback Logic)
│   ├── WindowHelper.ts <-- Window management
│   └── preload.ts      <-- Bridge
├── src/
│   ├── App.tsx         <-- Main Entry
│   ├── _pages/
│   │   └── Queue.tsx   <-- The Core UI (Chat, Transcript, Visualizer)
│   └── index.css       <-- Glassmorphism Styles
└── index.html