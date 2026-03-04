<p align="center">
  <img src="assets/Moubely_icon.png" width="120" alt="Moubely Logo" />
</p>

<h1 align="center">Moubely ✨</h1>

<p align="center">
  <i>A privacy-first, ultra-low-latency AI orchestrator for high-performance desktop workflows</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.3-yellow?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.2-646CFF?style=for-the-badge&logo=vite" alt="Vite" />
</p>

<div align="center">

[Core Features](#-core-features) • [Engineering Challenges](#-solved-engineering-challenges) • [System Architecture](#️-system-architecture-the-resilient-controller) • [Tech Stack](#-tech-stack) • [Installation](#-how-to-run-locally)

> 💡 **Inspiration:** Moubely is inspired by the innovative **Cluely** app, aiming to bring similar transparent, context-aware AI capabilities to your desktop workflow.

</div>

---

## 📖 Overview

Moubely is a sophisticated, "always-on-top" AI orchestrator engineered for seamless cross-application intelligence. Built using a **Waterfall Logic Engine**, it provides real-time multi-modal analysis: spanning high-resolution vision, local-first audio transcription, and long-range RAG-grounded reasoning, within a sleek, professional interface that prioritizes user privacy and workflow continuity.

---

## ✅ Version Evolution: What's New in v2.3?

Version 2.3 represents a massive shift from static UI blocks to a **Fluid Centered Architecture** and **Hardware-Accelerated Local Inference**.

| Feature | v2.2 (Legacy) | **v2.3 (Current)** |
| :--- | :--- | :--- |
| **Orchestration Layer** | Static 18-Model Queue | **Dynamic 20+ Model Waterfall** (Llama 3.1 405B / GPT-OSS 120B) |
| **Privacy Engineering** | Entangled Stealth | **Decoupled Protection** (OBS hiding vs. Click Pass-through) |
| **Interaction Layer** | Manual Toggles | **Scroll Portal** (Atomic Ctrl+Hover Interaction) |
| **Layout Philosophy** | Left-Aligned Fluid | **Centered Communication Architecture** (Max-Width Unified) |
| **Input Modality** | Text-Centric | **Hybrid (Voice Dictation + Auto-Expansive Editor)** |
| **Geometry Logic** | Auto-Resize Loops | **Deterministic Persistence** (Mode-Independent Memory) |
| **Session Intelligence** | Chronological Titles | **Semantic AI-Generated Session Summaries** |

---

## 🚀 Core Features

- 🕵️ **Stealth vs. Private Separation**: Decoupled screen protection (OBS hiding) from interaction (click pass-through)
- 👻 **Scroll Portal (Ghost Interaction)**: Dynamic window "solidification" using Ctrl + Hover for seamless scrolling in Private Mode
- 🏹 **Strict Arrow Mode**: Global permanent CSS cursor lock ensuring I-beams and pointers never reveal the tool's presence
- 🎙️ **Hybrid Meeting Copilot**: Privacy-first Local Whisper usage with optional Cloud redundancy
- ⚖️ **Centered Conversation Architecture**: Structural UI refactor ensuring all chat, email, and history content maintains perfect visual balance with a unified max-width constraint for readability
- 🎤 **Direct Voice Dictation**: Integrated microphone button in the chat bar for instant, low-latency speech-to-text input
- 📏 **Persistent Window Geometry**: Intelligent window state management that remembers dimensions across expand/shrink transitions without layout loops
- 📸 **Multi-Shot Contextual Vision**: Instantly capture and queue up to **12 concurrent screenshots** (`Ctrl + H`). Moubely synthesizes these frames into a unified visual context, enabling complex multi-screen analysis that traditional single-frame vision bots cannot achieve.
- 🧠 **Personal Digital Twin (STAR Implementation)**: Moubely doesn't just answer; it represents. By grounding responses in a user's specific `profile_data.json`, the AI adopts a professional persona that matches your unique background, leveraging the **STAR method** to ensure responses are grounded in verified user facts.

---

## 🛠️ System Architecture: The "Resilient Controller"

Moubely utilizes a **Weighted Model Cascade** in `electron/LLMHelper.ts`. If a primary provider (e.g., Gemini or Claude) returns a rate-limit error (429) or balance error (402), the controller instantly pivots to a secondary tier without user intervention.

### The "Brains" (Chat & Logic) 🧠

| Tier | Rationale | Priority Models |
| :--- | :--- | :--- |
| **Tier 1: Elite Reasoning** | Massive parameter counts | **Hermes-3 Llama 405B**, Llama 3.3 70B, GPT-OSS 120B |
| **Tier 2: Production Stable** | Speed and reliability | **Gemma 3 Family (27B)**, **Nemorton-3 34B** |
| **Tier 3: Extreme Speed** | Sub-second latency | Gemini 3 Flash, Gemini 2.5 Flash, Llama 3.2 3B |
| **Tier 4: Specialized Tiers** | Custom formatting | Step 3.5 Flash, Claude 3.7 Sonnet (Thinking) |

### The "Eyes" (Vision) 👁️

| Tier | Description | Key Models |
| :--- | :--- | :--- |
| **Tier 1: High Fidelity** | Precise OCR and layout | **Gemini 3.1 Pro**, Claude 3.7 Sonnet (Reasoning) |
| **Tier 2: Fast Vision** | Rapid screenshot analysis | Gemini 3 Flash, Claude 4.5 Haiku |
| **Tier 3: Fallbacks** | Redundancy | Perplexity Vision, Mistral Large 2 |

### The "Ears" (Audio) 👂

| Modality | Engine | Deployment |
| :--- | :--- | :--- |
| **Primary** | **Local Whisper (Tiny.en)** | Xenova Server (Port 3000) |
| **Secondary** | **Groq (Whisper-Large-V3)** | Fast Cloud Fallback |

---

## 🐛 Solved Engineering Challenges

<details>
<summary><strong>1. Visual Convergence: The Centering Paradox</strong></summary>

**Problem:** Centering content in an Electron window using standard CSS (`mx-auto`) creates large empty logical hitboxes flanking the content. These invisible areas would block clicks directed at underlying apps.

**Solution:** Engineered a **Dynamic Interactive Layering System**. We decoupled visual alignment from the interaction handler. By precisely calculating viewport bounds and dynamically updating Electron's `setIgnoreMouseEvents` specifically for the X-axis margins, we ensured the app feels visually balanced while physically remaining non-blocking.
</details>

<details>
<summary><strong>2. Atomic Async Input Injection</strong></summary>

**Problem:** Injecting transcribed text into an active React `textarea` often causes state overwrites where user typing and async transcription collide, leading to cursor jumps.

**Solution:** Implemented a **Synchronized State Buffer Manager**. The dictation handler takes an atomic snapshot of current input upon microphone closure, performs a clean string append, and forces a cursor refocus event to the end of the new string.
</details>

<details>
<summary><strong>3. Deterministic Geometry vs. OS Feedback Loops</strong></summary>

**Problem:** Standard Electron windows trigger recursive resize events when switching between "Expanded" and "Shrink" modes, as the OS layout engine and the App disagree on final bounds.

**Solution:** Built a **Hard-Boundary Controller** in `WindowHelper.ts`. It utilizes isolated memory states. Instead of listening to resize events, it forcefully overrides boundaries during transitions using `setMinimumSize` and `setMaximumSize` locks at the process level.
</details>

<details>
<summary><strong>4. DOM AST Interception for Aesthetic Highlighting</strong></summary>

**Problem:** Security-focused sanitization in `react-markdown` was stripping custom coloring tags (`<mark>`), making categorized AI responses indistinguishable.

**Solution:** Engineered a **Custom Render Interceptor** that operates at the Abstract Syntax Tree (AST) level. Instead of relying on vulnerable raw HTML, the interceptor scans for specific semantic markers and dynamically injects scoped Tailwind classes during the DOM generation phase.
</details>

<details>
<summary><strong>5. The "Ghost Interaction" Physics</strong></summary>

**Problem:** True ghost windows (click-through) are physically unreachable for scrolling history.

**Solution:** Developed a **Modifier-Driven Hit-Test Override**. By leveraging Electron's `forward` flag with `setIgnoreMouseEvents`, we tracked mouse coordinates in a transparent state. Combining this with a low-level listener for the `Ctrl` key allowed us to "solidify" the interaction target only on-demand.
</details>

<details>
<summary><strong>6. Contextual History Sanitization</strong></summary>

**Problem:** High-reasoning models like Gemini 3.1 crash if the conversation history starts with an AI message (the "Initial Greeting" bug).

**Solution:** Implemented a **Strict First-User Sanitizer**. Before any request, the pre-processor scans the array, identifies the first index where `role === "user"`, and slices the context accordingly, preventing 100% of start-up API errors.
</details>

<details>
<summary><strong>7. Semantic Intelligence: AI-Powered Titling</strong></summary>

**Problem:** Generic date-based titles force users to hunt through history, destroying the productivity benefit of a saved knowledge base.

**Solution:** Developed an **Asynchronous Intent Distiller**. When a new session is initialized, the system spawns a background prompt to summarize the user's core question into a concise (<6 words) semantic title.
</details>

<details>
<summary><strong>8. Auto-Scaling Dynamic Prompt Editor</strong></summary>

**Problem:** A fixed-height edit input is either too large for simple fixes or too small for thorough prompt revisions.

**Solution:** Built a **Ref-based Auto-Resizer**. The edit textarea starts at a single line (40px). As text is added, it dynamically recalculates `scrollHeight` and expands the UI container up to a 120px limit before transitioning into a scroll view.
</details>

<details>
<summary><strong>9. Circular Dependency and Startup Failures</strong></summary>

**Problem:** The application would hang on boot because the `Main` process and `IPC Handlers` were importing each other, creating a deadlock.

**Solution:** Refactored the core architecture to use **Type-Only Imports** and decoupled lifecycle management from handler registration.
</details>

<details>
<summary><strong>10. The "Output Formatting Fade" Fallback</strong></summary>

**Problem:** Smaller models often ignore complex system instructions to use bolding or markdown.

**Solution:** Implemented a **Regex-Based Post-Processor**. The system scans model outputs for key project terms and automatically applies markdown bolding if the model failed to do so.
</details>

<details>
<summary><strong>11. Local-Cloud Audio Race Conditions</strong></summary>

**Problem:** Packet arrival order when falling back from Local Whisper to Groq could result in fragmented transcripts.

**Solution:** Engineered a **Chronological Ticket System** with synchronized timestamps, ensuring audio chunks are reassembled in perfect order.
</details>

<details>
<summary><strong>12. Steering Model Drift (Persona Persistence)</strong></summary>

**Problem:** Models would often "forget" their professional persona after 5-6 messages, reverting to generic behavior.

**Solution:** Injected **Contextual Anchors** (Tone, Reference, and Format) directly into every turn of the `systemContext` block.
</details>

<details>
<summary><strong>13. Smart Mode Variance Detection</strong></summary>

**Problem:** Static time-based audio chunks (e.g. every 5s) often cut the user off mid-sentence.

**Solution:** Implemented **Variance-Based Silence Detection**. The app analyzes waveform volume variance: if it detects a drop for >2s, it automatically triggers a transcription.
</details>

<details>
<summary><strong>14. The "Ghost Window" Visibility Crash</strong></summary>

**Problem:** Due to Electron transparency bugs, the app would sometimes spawn but remain completely invisible.

**Solution:** Implemented an aggressive **Visibility Callback** performing a hardware-level `show()` event only after the window has successfully registered its first paint.
</details>

<details>
<summary><strong>15. Strict Cursor Protection (Stealth Leakage)</strong></summary>

**Problem:** Native tooltips and cursor changes (like I-beams) are tell-tale signs captured by screen capture software.

**Solution:** Conducted a global audit to purge the `title` attribute and replaced it with custom non-native floating elements.
</details>

<details>
<summary><strong>16. Global Vision Buffer Sync</strong></summary>

**Problem:** Screenshot context was originally hardcoded to specific buttons, causing other actions to "go blind".

**Solution:** Unified the visual pipeline. All action handlers query a central **Vision Buffer**, automatically switching Modality if screenshots are detected.
</details>

<details>
<summary><strong>17. The Truncation UX Paradox</strong></summary>

**Problem:** Large prompts took up too much vertical space, but hidden overflow made copying impossible.

**Solution:** Engineered a `<CollapsiblePrompt />` component with `line-clamp-5` and floating chevron toggles.
</details>

<details>
<summary><strong>18. Reasoning Noise Filter (Thinking Tags)</strong></summary>

**Problem:** Deep Reasoning models output internal monologues which are visually distracting.

**Solution:** Integrated a **Universal Regex Thought Filter** into the response stream to hide internal reasoning tags.
</details>

<details>
<summary><strong>19. Multi-shot Synchronization</strong></summary>

**Problem:** Taking multiple screenshots in quick succession led to file-lock errors in the temporary cache.

**Solution:** Built a **Queued File Handler** with unique UUID naming and an automated cleanup worker.
</details>

<details>
<summary><strong>20. The Missing "Post-Code Analysis" Routing</strong></summary>

**Problem:** AI was skipping final analysis steps for image-based submissions because prompt logic was bypassed.

**Solution:** Updated the IPC pipeline to route a `type='solve'` parameter for visual coding problems, mapping it to a strict analysis prompt.
</details>

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js** (v18+)
- **npm** or **pnpm**
- **Git**

### 1. Clone & Install
```bash
git clone https://github.com/Moubarak-01/Moubely.git
cd Moubely
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory. This project requires correctly configured keys for the waterfall engine:

| Service | Key | Get Key Here |
| :--- | :--- | :--- |
| **Google Gemini** | `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| **GitHub** | `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) |
| **Groq** | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) |
| **Perplexity** | `PERPLEXITY_API_KEY` | [perplexity.ai](https://www.perplexity.ai/settings/api) |
| **OpenRouter** | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai/keys) |
| **NVIDIA NIM** | `NVIDIA_API_KEY` | [build.nvidia.com](https://build.nvidia.com) |
| **OCR Space** | `OCR_SPACE_API_KEY` | [ocr.space](https://ocr.space/ocrapi) |

### 3. Launch
```bash
npm start
```
*This command launches the Vite server, Electron application, and Local Whisper server simultaneously.*

---

## 📂 Project Structure

```
Moubely/
├── electron/
│   ├── main.ts             # Application Entry & Lifecycle
│   ├── WindowHelper.ts     # Stealth, Geometry & Persistence Logic
│   ├── LLMHelper.ts        # The " Waterfall" Router & Model Cascade
│   └── ipcHandlers.ts      # Bi-directional Communication Layer
│
├── src/
│   ├── App.tsx             # Root Context & Global State
│   ├── _pages/             # High-level View Controllers (Queue, Profile)
│   ├── components/         # Atomized UI components (AST Markdown, LATEX)
│   └── index.css           # Design System & Glassmorphism Tokens
│
├── local-whisper-server.mjs # Standalone Hardware-Accelerated Audio Engine
└── index.html               # Main Entry point
```

---

## 👨‍💻 Engineering Mission
**Moubely** aims to be more than a chatbot: it is a study in **Unobtrusive Intelligence**. By solving deep UI/UX challenges in the Electron sandbox, it provides a blueprint for how AI companions should live on the desktop: fast, private, and always available without interrupting the human flow.

**Author:** [Moubarak-01](https://github.com/Moubarak-01)  
**License:** [MIT License](LICENSE)  

---
<p align="center">Made with ❤️ for high-performance builders</p>
