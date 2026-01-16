<div align="center">

# Moubely ✨

![Version](https://img.shields.io/badge/VERSION-2.2-blue?style=flat-square)
![Electron](https://img.shields.io/badge/⚡_ELECTRON-33-47848F?style=flat-square)
![React](https://img.shields.io/badge/⚛_REACT-18-61DAFB?style=flat-square)
![TypeScript](https://img.shields.io/badge/📘_TYPESCRIPT-5.0-3178C6?style=flat-square)
![Vite](https://img.shields.io/badge/⚡_VITE-5.0-646CFF?style=flat-square)

**An intelligent, stealthy, always-on-top AI assistant for your desktop**

[Features](#-core-features) • [Architecture](#️-engineering-architecture-the-waterfall-system) • [Tech Stack](#-tech-stack) • [Installation](#-how-to-run-locally) • [Contributing](#-contributing)

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

</div>

---

## 📖 Overview

Moubely is a stealthy, transparent, always-on-top AI assistant for your desktop. It provides real-time meeting assistance, screen analysis, and chat capabilities in a sleek, non-intrusive interface.

### Key Highlights

- 👻 **Stealth & Visibility Control** - Toggle between invisible mode and standard window
- 📸 **Contextual Vision (Multi-Shot)** - Queue up to 6 screenshots for multi-context analysis
- 🧠 **18-Model AI Waterfall** - Automatic fallback across Gemini, Claude, GPT-4o, and more
- 🎙️ **Hybrid Meeting Copilot** - Local Whisper + Cloud Groq transcription
- ⚡ **Instant Digital Twin** - Uses STAR method with your real project experiences

---

## ✅ Project Status: Latest Updates (v2.2)

We have just deployed major engineering improvements to intelligence, stability, and visibility:

### 1. The "Solve" Button
A new dedicated coding tool (Terminal Icon). Moubely uses its Vision Brain to debug code from screenshots or listens to meeting transcripts to solve verbal problems when no screen is captured. It explains solutions line-by-line using a simple persona that relies on analogies and avoids technical jargon.

### 2. Expanded 18-Model "Brain"
Integrated a massive Tier-1 logic engine including **Gemini 3.0 Pro**, **Gemini 3 Deep Think**, **Claude 3.7 Sonnet (Thinking)**, and **Claude 4.5 Opus**.

### 3. Critical Fixes
- **History Sanitization** - Prevents API rejections by ensuring conversation history always starts with a user message
- **"Blind Vision" Patch** - Fixed routing logic to send images to the correct Vision model
- **"Read Once" Smart Caching** - Resume/profile read only once on startup and cached in RAM
- **Live Terminal Telemetry** - Comprehensive logging system (`[IPC]`, `[LLM]`, `[Processing]`)

---

## 🚀 Core Features

### 👻 Stealth & Visibility Control
Toggle instantly between **Stealth Mode** (invisible to screen sharing/recording) and **Visible Mode** (standard window for debugging or presentations) directly from the UI.

### 📸 Contextual Vision (Multi-Shot)
Instantly snap screenshots (`Ctrl + H`). Repeated presses **queue up to 6 screenshots** for multi-context analysis. Moubely "sees" your screen using a multi-model approach (Gemini, Claude Vision, or GPT-4o).

### 🧠 Robust AI Waterfall
Our Expanded AI engine supports 18+ models. If one model hits a rate limit or API error (e.g., 402 or 429), Moubely automatically switches to the next available one.

### 🎙️ Hybrid Meeting Copilot
- **Local-First Transcription** - Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine
- **Cloud Fallback** - Automatically switches to **Groq** if the local server gets too busy or if **Smart Mode** is enabled (1000ms timeout logic)
- **Instant Digital Twin** - Uses the **STAR method** to provide spoken-word answers based on your actual project "war stories"
- **Post-Meeting Reliability** - The email generation uses your Student Mode persona to ensure follow-ups are authentic

---

## 🛠️ Engineering Architecture: The "Waterfall" System

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes elite reasoning models before falling back to faster or local resources.

### The "Brains" (Chat & Logic) 🧠

The app utilizes a massive **18-Model Waterfall** to ensure you always get an answer:

| Tier | Models |
| :--- | :--- |
| **Tier 1: Supreme Reasoning** | Gemini 3.0 Pro, Gemini 3 Deep Think, Claude 3.7 Sonnet (Thinking), Claude 4.5 Opus |
| **Tier 2: High-Speed** | Gemini 3.0 Flash, Claude 4.5 Sonnet |
| **Tier 3: Efficiency** | Claude 4.5 Haiku, Gemini 2.5 Flash Lite |
| **Tier 4: Open Source** | Gemma 3 Family (27B, 12B, 4B) |
| **Tier 5: Research** | Perplexity Sonar (Reasoning Pro) - Live Web Search |
| **Tier 6: Backup** | GPT-4o, DeepSeek R1, Groq Llama 3.3 |

### The "Eyes" (Vision) 👁️

| Tier | Models |
| :--- | :--- |
| **Tier 1** | Nano Banana Pro (Gemini 3 Image Preview), Claude 3.7 Sonnet (Reasoning Vision) |
| **Tier 2** | Gemini 2.5 Flash (The reliable workhorse) |
| **Tier 3** | Perplexity Vision & GPT-4o Vision |

### The "Ears" (Audio) 👂

| Type | Description |
| :--- | :--- |
| **Local Whisper** | Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000 |
| **Groq (Whisper-Large-V3)** | Instant cloud fallback if the local queue times out or fails |

### Smart PDF Handling 📄

- **Primary:** Uses a local `pdf-parse` library to extract text on your CPU
- **Fallback (OCR Backup):** Uses `OCR Space` API if the PDF is an image scan

---

## ⚡ Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Desktop Framework** | Electron | Cross-platform desktop application shell |
| **Frontend** | React & TypeScript | User Interface and application logic |
| **Styling** | Tailwind CSS | Utility-first CSS framework |
| **Bundling/Dev** | Vite | Fast development server and build tool |
| **AI/Logic Core** | Gemini, Claude, GPT-4o, DeepSeek | Multi-Model AI Waterfall for chat and reasoning |
| **Local Services** | Local Whisper Server | Fast, local audio transcription |
| **Display** | KaTeX, Highlight.js | LaTeX formulas and code syntax highlighting |

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

**Solution:** Added a **Simple Voice Filter** with a "Pivot Rule" to use real experience.
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

Create a `.env` file in the root directory:

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

### 4. Run the Local Whisper Server

```bash
node local-whisper-server.mjs
```

### 5. Start the Application

```bash
npm start
```

### Building for Production

```bash
npm run dist
```

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
│   │   └── Queue.tsx           # Main Chat Interface (Streaming Logic)
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