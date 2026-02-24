<p align="center">
  <img src="renderer/public/Moubely_icon.png" width="120" alt="Moubely Logo" />
</p>

<h1 align="center">Moubely ✨</h1>

<p align="center">
  <i>A privacy-first, always-on-top AI orchestrator for high-performance workflows</i>
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

Moubely is an advanced, always-on-top AI productivity hub designed for seamless desktop integration. It provides real-time meeting assistance, high-fidelity screen analysis, and secure local-first context management in a sleek, non-intrusive interface.

### Key Highlights

- 👁️ **Privacy-Centric Workspace** - Minimized background processing with deep system tray integration
- 📸 **Visual Language Detection** - Automatically detects programming languages from screenshots (LeetCode, IDEs) or defaults to Python
- 🧠 **6-Section STAR Reasoning** - Standardized 6-part output format (Situation, Task, Action, Result, Complete Code, Post-Code Analysis)
- 📸 **Contextual Vision (Multi-Shot)** - Queue up to **12 screenshots** (`Ctrl + H`) for deep multi-context analysis
- 🎙️ **Local-First Meeting Copilot** - Privacy-first Local Whisper usage with optional Cloud redundancy
- ✨ **Dynamic Highlighting Engine** - Native UI highlighting for `Say:` and `Type:` labels for high technical scannability
- ⚡ **RAG-based Personal Knowledge Management** - Context-aware responses grounded in your specific professional documentation

---

## ✅ Version Comparison: What's New in v2.3?

We have shifted from a static, premium-first architecture to a universal, open-model-first engine with enhanced visual output.

| Feature | v2.2 (Old) | **v2.3 (Current)** |
| :--- | :--- | :--- |
| **Model Roster** | 18-Model Waterfall | **20+ Model Waterfall** (Llama 405B, GPT-OSS 120B) |
| **Output Style** | Standard Markdown | **6-Section STAR Reasoning** + Yellow Highlights |
| **Vision Logic** | Hardcoded Python | **Visual Context Language Detection** |
| **Initial Boot** | Stealth Mode (Invisible) | **Interactive Mode (Visible)** |
| **Context Engine** | Dynamic Profile Loader | **Direct RAG Injection fallback** |
| **Smart Mode** | Variance-Based Selection | **Enhanced Waveform Analysis** |

---

## 🚀 Core Features

### 👁️ Privacy-Centric Workspace
Toggle instantly between **Background Mode** (system tray/minimized) and **Active Workspace** (standard window), ensuring the tool is available for high-velocity workflows but strictly non-intrusive when focus is required.

### 📸 Contextual Vision (Multi-Shot)
Instantly snap screenshots (`Ctrl + H`). Repeated presses **queue up to 12 screenshots** for multi-context analysis. Moubely "sees" your screen using a multi-model approach.

### 🧠 Resilient Multi-Provider LLM Controller
Our custom orchestration engine manages 18+ models. If one provider hits a rate limit or API error (e.g., 402 or 429), the controller automatically routes the request to the next available tier, ensuring business continuity.

### 🎙️ Hybrid Meeting Copilot
- **Local-First Transcription** - Powered by a custom **Local Whisper Server** (Tiny.en) running directly on your machine
- **Cloud Fallback** - Automatically switches to **Groq** if the local server gets too busy or if **Smart Mode** is enabled
- **Universal Digital Twin** - Uses the **STAR method** to provide spoken-word answers based on *your* specific profile data
- **Automated Workflow** - Single command (`npm start`) launches Frontend, Backend, and Local Whisper Server simultaneously

### ⚡ RAG-based Personal Knowledge Management
- **Context Grounding** - The system strictly adheres to the user's provided knowledge base (Technical Documentation, Project Notes).
- **Hallucination Reduction** -  Forces the AI to ALWAYS validate answers against your provided context files (RAG), significantly reducing generic AI responses in favor of project-specific accuracy.


---

## 🛠️ System Architecture: The "Resilient Controller"

Moubely uses a **Smart Routing Engine** in `electron/LLMHelper.ts` that prioritizes elite reasoning models before falling back to faster or local resources.

### The "Brains" (Chat & Logic) 🧠

**New in v2.3:** We now prioritize elite, massive-parameter reasoning models (405B+) to ensure the highest possible logical accuracy before falling back to fast efficiency models.

| Tier | Models |
| :--- | :--- |
| **Tier 1: Heavy Lifters** | **Hermes 3 Llama 405B**, Llama 3.3 70B, **GPT-OSS 120B**, **Qwen 3 Next 80B**, Cosmos Nemotron 34B |
| **Tier 2: Fast Multi-Model** | **Gemma 3 Family (27B - 1B)** |
| **Tier 3: Google Performance** | Gemini 3.0 Pro, Gemini 3 Flash, Gemini 2.5 Flash, Nemotron 3 Nano |
| **Tier 4: Specialized Tiers** | **Step 3.5 Flash**, Solar Pro 3, Claude 4.5 Haiku, Claude 3.7 Sonnet (Thinking) |
| **Tier 5: Deep Safety Net** | Llama 3.2 3B, Trinity Mini, Liquid LFM 1.2B, Perplexity Sonar |

### The "Eyes" (Vision) 👁️

| Tier | Models |
| :--- | :--- |
| **Tier 1: Elite Vision** | **Gemini 3 Pro**, Claude 4.5 Opus, Claude 3.7 Sonnet (Reasoning) |
| **Tier 2: Fast & Reliable** | Gemini 3 Flash, Gemini 2.5 Flash, Claude 4.5 Haiku, Mistral Small Vision |
| **Tier 3: Backups** | Mistral Large 2 (Nvidia), GPT-4o, Perplexity Vision |

### The "Ears" (Audio) 👂

| Type | Description |
| :--- | :--- |
| **Local Whisper** | Primary. Uses `Xenova/whisper-tiny.en` running locally on port 3000 |
| **Groq (Whisper-Large-V3)** | Instant cloud fallback if the local queue times out or fails |

---

## 🐛 Solved Engineering Challenges

<details>
<summary><strong>1. The Missing "Post-Code Analysis" (Prompt Routing)</strong></summary>

**Problem:** The AI was reliably generating code but skipping the crucial final analysis step for image-based submissions because the "Solve" system prompt was never actually being sent to the vision endpoint.

**Solution:** Updated the IPC pipeline and `LLMHelper.ts` to explicitly route a `type='solve'` parameter for screenshot-based coding problems, mapping it to a strict 6-section STAR prompt.
</details>

<details>
<summary><strong>2. Markdown Rendering vs. Raw HTML Tags</strong></summary>

**Problem:** Strict prompt instructions to output `<mark>` tags for yellow highlighting were being neutralized by React Markdown's secure sanitization, resulting in literal, unstyled HTML tags appearing on the UI.

**Solution:** Built a **Custom Render Interceptor** in `AIResponse.tsx` that identifies specific target phrases (e.g., `**Say:**`, `**Type:**`) at the DOM generation level and dynamically wraps them in custom Tailwind background utility classes (`bg-yellow-500/20`), preserving strict XSS security while achieving native aesthetic highlighting.
</details>

<details>
<summary><strong>3. The "Python First" Monolingual Myth</strong></summary>

**Problem:** By defaulting all output to Python, users submitting Java, C++, or TypeScript screenshots experienced high friction having to manually translate the solution.

**Solution:** Implemented **Visual Context Language Detection**. The vision prompt now instructs the model to scan the UI (e.g., dropdowns, syntax structures) in the provided screenshot to automatically infer the target language, falling back to Python only when fully ambiguous.
</details>

<details>
<summary><strong>4. The "First Message" API Crash (Gemini/Perplexity)</strong></summary>

**Problem:** Gemini 3.0 and Perplexity APIs strictly require the first message in the chat history to be from the `user`. Our app sometimes started history with an AI greeting (`role: model`), causing 100% failure rates.

**Solution:** Implemented **History Sanitization** in `LLMHelper.ts`. Before sending any request, the code scans the history array, finds the index of the first `user` message, and slices everything before it.
</details>

<details>
<summary><strong>5. The "Blind" Solve Button</strong></summary>

**Problem:** The "Solve" button was blindly sending requests to the `gemini-chat` (Text) endpoint, even when screenshots were attached.

**Solution:** Implemented **Split Routing** in `Queue.tsx`. The function now checks `if (hasImages)` and routes to the correct endpoint.
</details>

<details>
<summary><strong>3. Advanced Window Layering (UX)</strong></summary>

**Problem:** Standard Electron windows capture mouse events even when transparent, interfering with underlying applications.

**Solution:** Implemented synchronized, time-gated control with `win.setIgnoreMouseEvents` to allow seamless interaction with the desktop while maintaining the assistant's visual presence.
</details>

<details>
<summary><strong>4. The Transcript "Race Condition"</strong></summary>

**Problem:** Groq (Cloud) processed faster than Local Whisper, causing transcripts to appear out of order.

**Solution:** Implemented a **Ticket System** with timestamps to ensure perfect chronological order.
</details>

<details>
<summary><strong>5. Consolidating Context Consistency</strong></summary>

**Problem:** Large Language Models often drift into generic or hallucinated answers when asked specific domain questions.

**Solution:** Added a **"Pivot Rule" RAG Layer** that forces the model to ground its answers in the provided knowledge base files.
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
<summary><strong>9. Addressing "Context Drift"</strong></summary>

**Problem:** Models would ignore "soft" instructions to use specific formatting and revert to standard outputs.

**Solution:** Injected **5 Contextual Anchors** (Tone, References, Format) directly into the `systemContext` block, making them strictly adhered to by the model.
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
<summary><strong>13. The Output Formatting Fade</strong></summary>

**Problem:** Smaller models often ignore "soft" instructions to use specific markdown bolding for Scannability, leading to plain, "blank-looking" answers.

**Solution:** Implemented a **Regex-Based Auto-Highlighter** fallback. The system now post-processes every response, automatically wrapping project keywords, technical terms, and percentage values in `**` if the model fails to do so.
</details>

<details>
<summary><strong>14. Startup "Ghosting" vs. Visibility</strong></summary>

**Problem:** To prioritize stealth, the app used to boot invisibly, which often led users to believe the application had failed to launch.

**Solution:** Inverted the initial boot logic. Moubely now spawns in a **Visible State** by default, allowing the user to confirm system readiness before manually toggling into **Stealth Mode** using the integrated hotkey.
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

If you clone, fork, or use any logic from this repository (especially the **Resilient Controller** or **Window Management Systems**), you are **legally required** to:
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