# Moubely - Intelligent Desktop Assistant

Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

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

## 📂 Project Structure

```text
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