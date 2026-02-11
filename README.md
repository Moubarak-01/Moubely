<p align="center">
  <img src="renderer/public/Moubely_icon.png" width="120" alt="Moubely Logo" />
</p>

<h1 align="center">Moubely ✨</h1>

<p align="center">
  <i>An intelligent, stealthy, always-on-top AI assistant for your desktop</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.3-yellow?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
</p>

<div align="center">

[Features](#-core-features) • [Architecture](#️-engineering-architecture-the-waterfall-system) • [Tech Stack](#-tech-stack) • [Installation](#-how-to-run-locally) • [Contributing](#-contributing)

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

</div>

---

## 📖 Overview

Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

### Key Highlights

- 👻 **Stealth & Visibility Control** - Toggle between invisible mode and standard window
- 📸 **Contextual Vision (Multi-Shot)** - Queue up to **12 screenshots** (`Ctrl + H`) for deep multi-context analysis
- 🧠 **18-Model AI Waterfall** - Prioritizes open/free models (Llama 3.3, Qwen 2.5) with premium fallback
- 🎙️ **Hybrid Meeting Copilot** - Local Whisper + Cloud Groq transcription
- ⚡ **Instant Digital Twin** - Universal Persona Engine that adapts to your profile

---

## ✅ Version Comparison: What's New in v2.3?

We have shifted from a static, premium-first architecture to a universal, open-model-first engine.

| Feature | v2.2 (Old) | **v2.3 (Current)** |
| :--- | :--- | :--- |
| **Screenshot Engine** | Limited to 6 Screens | **Expanded to 12 Screens** (Deep Context) |
| **AI Positioning** | Premium First (Gemini Pro/Claude Opus) | **Open Efficiency First** (Llama 3.3 70B, Nemotron 12B, GLM 4.5 Air) |
| **Story Engine** | Hardcoded Stories in TypeScript | **Universal Story Editor** (Dynamic JSON Injection) |
| **Persona Logic** | "Prompt-Only" Suggestions | **Mandatory Human Embodiment** (Hesitations, Emotion, No Jargon) |
| **Solve Engine** | Standard Code Output | **S.T.A.R. Method Enforced** (Situation, Task, Action, Result) |
| **Smart Mode** | Fixed Timer (2.5s) | **Variance-Based Selection** (Wait for >3s Silence) |

---

## 🚀 Core Features

### 👻 Stealth & Visibility Control
Toggle instantly between **Stealth Mode** (invisible to screen sharing/recording) and **Visible Mode** (standard window for debugging or presentations) directly from the UI.

### 📸 Contextual Vision (Multi-Shot)
Instantly snap screenshots (`Ctrl + H`). Repeated presses **queue up to 12 screenshots** for multi-context analysis. Moubely "sees" your screen using a multi-model approach.

### 🧠 Robust AI Waterfall
Our Expanded AI engine supports 18+ models. If one model hits a rate limit or API error (e.g., 402 or 429), Moubely automatically switches to the next available one.

### 🎙️ Hybrid Meeting Copilot
- **Local-First Transcription** - Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine
- **Cloud Fallback** - Automatically switches to **Groq** if the local server gets too busy or if **Smart Mode** is enabled
- **Universal Digital Twin** - Uses the **STAR method** to provide spoken-word answers based on *your* specific profile data
- **Automated Workflow** - Single command (`npm start`) launches Frontend, Backend, and Local Whisper Server simultaneously

### 🎭 Strict Personalization (Student Mode)
- **Identity Override** - When in "Student Mode", the AI strictly enforces the user's persona (First-person "I/Me", Name, Major)
- **Mandatory File Usage** -  Forces the AI to ALWAYS check "STUDENT FILES" for answers, even for general questions, preventing generic AI responses


---

## 🛠️ Engineering Architecture: The "Waterfall" System

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes elite reasoning models before falling back to faster or local resources.

### The "Brains" (Chat & Logic) 🧠

**New in v2.3:** We now prioritize high-performance free/open models in Tier 1 to reduce costs while maintaining 70B+ parameter intelligence.

| Tier | Models |
| :--- | :--- |
| **Tier 1: Open Elite** | **Llama 3.3 70B**, Arcee Trinity Large, Nvidia Nemotron 3 Nano, Cosmos Nemotron 34B |
| **Tier 2: Open Efficiency** | Gemma 3 27B, **Gemma 3 12B/4B/2B/1B**, Gemini 2.0 Flash (Free) |
| **Tier 3: Google Premium** | Gemini 3.0 Pro, Gemini 3 Flash, Gemini 2.5 Flash |
| **Tier 4: Specialized** | Claude 4.5 Haiku, Mistral Small 3.1, Claude 3.7 Sonnet (Thinking) |
| **Tier 5: Research** | Perplexity Sonar (Reasoning), Mistral Large 2 (Nvidia) |

### The "Eyes" (Vision) 👁️

| Tier | Models |
| :--- | :--- |
| **Tier 1: Elite Vision** | **Gemini 3 Pro Image**, Claude 4.5 Opus, Qwen 2.5 VL 72B |
| **Tier 2: Fast & Reliable** | Gemini 3 Flash, Claude 3.5 Sonnet |
| **Tier 3: Backups** | Mistral Large 2 (Nvidia), GPT-4o, Perplexity Vision |

### The "Ears" (Audio) 👂

| Type | Description |
| :--- | :--- |
| **Local Whisper** | Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000 |
| **Groq (Whisper-Large-V3)** | Instant cloud fallback if the local queue times out or fails |

---

## 🐛 Solved Engineering Challenges

<details>
<summary><strong>1. The "First Message" API Crash (Gemini/Perplexity)</strong></summary>

**Problem:** Gemini 3.0 and Perplexity APIs strictly require the first message in the chat history to be from the `user`. Our app sometimes started history with an AI greeting (`role: model`), causing 100% failure rates.

**Solution:** Implemented **History Sanitization** in `LLMHelper.ts`. Before sending any request, the code scans the history array, finds the index of the first `user` message, and slices everything before it.
</details>

<details>
<summary><strong>2. The "Blind" Solve Button</strong></summary>

**Problem:** The "Solve" button was blindly sending requests to the `gemini-chat` (Text) endpoint, even when screenshots were attached.

**Solution:** Implemented **Split Routing** in `Queue.tsx`. The function now checks `if (hasImages)` and routes to the correct endpoint.
</details>

<details>
<summary><strong>3. Deep Stealth Mouse Control</strong></summary>

**Problem:** Even with `setContentProtection`, the mouse pointer was visible to screen recorders when interacting with the window.

**Solution:** Implemented synchronized, time-gated control with `win.setIgnoreMouseEvents` and `cursor: none` CSS.
</details>

<details>
<summary><strong>4. The Transcript "Race Condition"</strong></summary>

**Problem:** Groq (Cloud) processed faster than Local Whisper, causing transcripts to appear out of order.

**Solution:** Implemented a **Ticket System** with timestamps to ensure perfect chronological order.
</details>

<details>
<summary><strong>5. The "Tesla" Persona Hallucination</strong></summary>

**Problem:** The AI sounded too high-level and invented fake software teams for behavioral questions.

**Solution:** Added a **Simple Voice Filter** with a "Pivot Rule" to use real experience from student files.
</details>

<details>
<summary><strong>6. The Ghost Window (Critical Visibility Crash)</strong></summary>

**Problem:** The app would start with no window visible at all due to Electron transparency bugs.

**Solution:** Implemented an aggressive `ready-to-show` callback with explicit `win.focus()`.
</details>

<details>
<summary><strong>7. The "Silent Crash" (Circular Dependency)</strong></summary>

**Problem:** The app would hang on startup because `Main` and `IPC Handlers` were importing each other.

**Solution:** Refactored the architecture to use **Type-Only Imports** (`import type`).
</details>

<details>
<summary><strong>8. "Thinking" Process Clean-Up</strong></summary>

**Problem:** Reasoning models output their internal monologue (`<think>...`), cluttering the chat.

**Solution:** Implemented a **Universal Response Cleaner** to filter out thought tags in real-time.
</details>

<details>
<summary><strong>9. The "Persona Drift" (Hardcoded Logic)</strong></summary>

**Problem:** Models would ignore "soft" instructions to be normal human beings and revert to "AI Assistant mode".

**Solution:** Injected **5 Mandatory Rules** (Hetitations, References, Emotion) directly into the `storyEnforcement` block, making them mathematically weighted higher than the system prompt.
</details>

<details>
<summary><strong>10. "Smart Mode" Latency & Sync</strong></summary>

**Problem:** Fixed 2.5s chunks were too short for context, and 10s chunks were too slow for conversation.

**Solution:** Implemented **Variance-Based Silence Detection**. The app analyzes the audio waveform; if it detects silence >3s, it forces an early transcription.
</details>

<details>
<summary><strong>11. The "Hardcoded" Prompt Myth</strong></summary>

**Problem:** The prompts appeared static, limiting the app to one user.

**Solution:** Architecture refactor to use **Dynamic Profile Loading**. The prompt in code is just a template; the content is loaded from `user_profile.json` at runtime.
</details>

<details>
<summary><strong>12. The Multi-Process Startup</strong></summary>

**Problem:** Developers had to manually open multiple terminals to start the Vite server, Electron app, and Local Whisper server.

**Solution:** Automated the workflow in `package.json` using `concurrently`. Now, a single `npm start` command launches all three services in parallel.
</details>
</details>

---

## 📦 Installation & Setup

### Prerequisites

- Node.js v18 or higher
- npm or yarn

### 1. Clone the Repository

```bash
git clone https://github.com/Moubarak-01/Moubely.git
cd Moubely
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

### Required API Keys

| Service | Variable Name | Get Key Here |
| :--- | :--- | :--- |
| **Google Gemini** | `GEMINI_API_KEY` | [Get Key](https://aistudio.google.com/app/apikey) |
| **GitHub** | `GITHUB_TOKEN` | [Get Token](https://github.com/settings/tokens) |
| **Groq** | `GROQ_API_KEY` | [Get Key](https://console.groq.com/keys) |
| **Perplexity** | `PERPLEXITY_API_KEY` | [Get Key](https://www.perplexity.ai/settings/api) |
| **OpenRouter** | `OPENROUTER_API_KEY` | [Get Key](https://openrouter.ai/keys) |
| **NVIDIA NIM** | `NVIDIA_API_KEY` | [Get Key](https://build.nvidia.com) |
| **OCR Space** | `OCR_SPACE_API_KEY` | [Get Key](https://ocr.space/ocrapi) |

Create a `.env` file in the root directory and paste the following:

```env
# 1. THE BRAINS & EYES (Primary Chat + Vision)
GEMINI_API_KEY=your_key_here

# 2. THE LOGIC & BACKUP (DeepSeek + GPT-4o)
GITHUB_TOKEN=your_token_here

# 3. THE CLOUD EARS (Audio Backup)
GROQ_API_KEY=your_key_here

# 4. THE RESEARCHER & REASONER (Search + Claude)
PERPLEXITY_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here

# 5. NVIDIA NIM (New Tier 1)
NVIDIA_API_KEY=your_key_here

# 6. PDF RECOVERY (Scanned Docs)
OCR_SPACE_API_KEY=your_key_here
```

### 4. Start the Application

```bash
npm start
```
*This command automatically launches the Vite Dev Server, Electron Backend, and Local Whisper Server.*


---

## 📂 Project Structure

```
Moubely/
├── package.json
├── .env                        # Contains API Keys
├── local-whisper-server.mjs    # Local AI Audio Engine
│
├── electron/
│   ├── main.ts                 # App Entry Point
│   ├── LLMHelper.ts            # The "Waterfall" Logic & Smart Router
│   ├── ProcessingHelper.ts     # Automation Workflow
│   └── ipcHandlers.ts          # Logs & Communication
│
├── src/
│   ├── App.tsx                 # Main UI Entry
│   ├── _pages/
│   │   ├── Queue.tsx           # Main Chat Interface (Streaming Logic)
│   │   └── ProfileSettings.tsx # Universal Story Editor
│   ├── components/
│   │   └── AIResponse.tsx      # Markdown & LaTeX Rendering Logic
│   └── index.css               # Glassmorphism Styles
│
└── index.html
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.

### 🛡️ Mandatory Attribution

If you clone, fork, or use any logic from this repository (especially the **Waterfall Routing** or **Stealth Systems**), you are **legally required** to:
- Retain the original copyright notice in the `LICENSE` file
- Provide a visible link back to this [Moubely Repository](https://github.com/Moubarak-01/Moubely)
- Acknowledge **Moubarak-01** as the original author

---

## 👨‍💻 Author

**Moubarak**
- GitHub: [@Moubarak-01](https://github.com/Moubarak-01)

---

Made with ❤️ for seamless desktop productivity

**Moubely - Your Invisible AI Companion**