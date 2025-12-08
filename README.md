Moubely - Intelligent Desktop Assistant
Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

🚀 Core Features
👻 Stealth Overlay: A fully transparent, click-through window that floats on top of your applications. It stays invisible until you need it, ensuring you never break flow.

📸 Contextual Vision: Instantly snap screenshots (Ctrl + H) of code errors, complex charts, or emails. Moubely "sees" your screen and provides specific, context-aware solutions using Google Gemini.

🎙️ Live Meeting Copilot:

Ultra-Fast Transcription: Powered by Groq (Whisper-Large-V3) for near-instant, verbatim speech-to-text.

Smart Assists: One-click buttons to generate suggestions, follow-up questions, or instant recaps.

🧠 Hybrid AI Engine: Moubely now utilizes a specialized "Three-Brain" architecture:

Ears: Groq for audio processing.

Brain: GitHub Models (GPT-4o-mini) for logic and chat.

Eyes: Google Gemini for image analysis and fallback support.

⚡ Smart Modes: Switch between Developer (code-focused), Student (explanatory), and General modes to tailor the AI's personality to your current task.

🛠️ Latest Updates: The Hybrid Architecture
We have completely overhauled the backend to solve stability issues and maximize performance. Here is a breakdown of the recent changes and fixes:

1. Solved: The "429/404" Rate Limit Loop
The Issue: Relying solely on the free tier of Gemini resulted in frequent 429 Too Many Requests or 404 Model Not Found errors when models (like gemini-2.0-flash) were busy or experimental.

The Fix: We implemented a Cascading Fallback System.

Primary: The app now defaults to GitHub Models (GPT-4o-mini) via Azure, which provides robust, high-availability text processing.

Fallback: If GitHub fails, it automatically retries with a prioritized list of Gemini models (1.5-flash-8b -> 1.5-flash -> 1.5-pro).

2. Solved: Azure "Content Filter" & Audio Routing
The Issue: When we attempted to use GitHub Models as a drop-in replacement, we hit 400 Bad Request errors citing "Content Filters." This happened because we were sending raw audio/binary data to a text-completion endpoint.

The Fix: We implemented Smart Routing in the LLMHelper.

Text Requests are routed to GitHub.

Audio Requests are routed to Groq.

Image Requests (Multimodal) are routed to Gemini. This ensures every data type is handled by the model best suited for it, bypassing format errors.

3. Implemented: Groq for Real-Time Speed
The Upgrade: Previous transcription had latency. We integrated Groq's Whisper API, which processes audio 10x faster than real-time. This eliminates the "freezing" feeling during live transcription.

💻 How to Run Locally
Prerequisites
Node.js (v18 or higher recommended)

npm (comes with Node.js) or yarn

Installation Steps
Clone the Repository

Bash

git clone https://github.com/Moubarak-01/Moubely.git
cd Moubely
Install Dependencies

Bash

npm install
Setup Environment Variables (Crucial) Create a .env file in the root directory. You now need three keys for the full hybrid experience, though the app will work (with fallbacks) if you only have some.

Code snippet

# 1. For Vision & Fallback (Get at aistudio.google.com)
GEMINI_API_KEY=your_google_key_here

# 2. For Logic/Chat (Get at github.com/settings/tokens)
GITHUB_TOKEN=your_github_token_here

# 3. For Speech-to-Text (Get at console.groq.com)
GROQ_API_KEY=your_groq_key_here
Run the App Start the development server and Electron app simultaneously:

Bash

npm start
Building for Production
To create an executable file (e.g., .dmg, .exe, or .AppImage) for your operating system:

Bash

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
│   ├── ProcessingHelper.ts
│   └── WindowHelper.ts
├── src/
│   ├── App.tsx         <-- Main Entry
│   ├── _pages/
│   │   └── Queue.tsx   <-- Core UI (Chat, Transcript, Visualizer)
│   └── components/     <-- React Components
└── index.html