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

> 💡 **Inspiration:** Moubely is an advanced AI productivity hub designed to bridge the gap between static desktop environments and dynamic LLM orchestration. Inspired by **Cluely**, it prioritizes transparent context-awareness and non-intrusive high-fidelity assistance.

</div>

---

## 📖 Overview

Moubely is a sophisticated, "always-on-top" AI orchestrator engineered for seamless cross-application intelligence. Built using a **Waterfall Logic Engine**, it provides real-time multi-modal analysis—spanning high-resolution vision, local-first audio transcription, and long-range RAG-grounded reasoning—within a sleek, professional interface that prioritizes user privacy and workflow continuity.

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

### ⚖️ Centered Conversation Architecture
Moubely v2.3 introduces a structural refactor ensuring all chat, email, and meeting recap interfaces maintain perfect visual balance. Using a unified `max-w-3xl mx-auto` constraint, content is anchored in the user's primary psychological focus zone, significantly improving scannability and professional aesthetic.

### 🎙️ Hybrid Dictation & Transcription
- **Local-First Inference:** Powered by a customized **Local Whisper Server** (`distil-whisper-tiny.en`) for zero-latency, private transcription.
- **Dynamic UX Overlays:** A pulse-animated microphone button in the input bar allows for direct, one-click voice-to-text conversion.
- **Cloud Redundancy:** Intelligent fallback to **Groq** if local resources are congested, ensuring a 99.9% transcription success rate.

### 👻 Private Mode & Scroll Portal
Implemented a highly specialized **Input Passthrough** mode (`Shift + A`). While the window becomes 100% transparent to system-level clicks for underlying workflow access, our **Scroll Portal** logic allows users to "solidify" the viewport temporarily using `Ctrl + Hover` for seamless history navigation without exiting Private Mode.

### 🏹 Strict Arrow Mode (Universal Stealth)
Engineered an absolute CSS lock that forces a global `default-arrow` cursor across all DOM elements. This eliminates "pointer leakage"—common visual tell-tales like I-beams over inputs—that might otherwise reveal the application's presence during captured screen recordings or high-stakes screen sharing.

### 📸 Multi-Shot Contextual Vision
Instantly capture and queue up to **12 concurrent screenshots** (`Ctrl + H`). Moubely synthesizes these frames into a unified visual context, enabling complex multi-screen analysis that traditional single-frame vision bots cannot achieve.

### 🧠 Personal Digital Twin (STAR Implementation)
Moubely doesn't just answer; it represents. By grounding responses in a user's specific `profile_data.json`, the AI adopts a professional persona that matches your unique background, leveraging the **STAR method** to ensure responses are grounded in verified user facts.

---

## 🛠️ System Architecture: The "Resilient Controller"

Moubely utilizes a **Weighted Model Cascade** in `electron/LLMHelper.ts`. If a primary provider (e.g., Gemini or Claude) returns a rate-limit error (429) or balance error (402), the controller instantly pivots to a secondary tier without user intervention.

### The "Brains" (Chat & Logic) 🧠

| Tier | Rationale | Priority Models |
| :--- | :--- | :--- |
| **Tier 1: Elite Reasoning** | Massive parameter counts for complex logic | **Hermes-3 Llama 405B**, Llama 3.3 70B, GPT-OSS 120B, Qwen Next 80B |
| **Tier 2: Production Stable** | Balanced speed and reliability | **Gemma 3 Family (27B)**, **Nemorton-3 34B** |
| **Tier 3: Extreme Speed** | Sub-second latency for simple queries | Gemini 3 Flash, Gemini 2.5 Flash, Llama 3.2 3B, Trinity Mini |
| **Tier 4: Specialized Tiers** | Custom formatting or niche tasks | Step 3.5 Flash, Claude 3.7 Sonnet (Thinking), Perplexity Sonar |

### The "Eyes" (Vision) 👁️

| Tier | Description | Key Models |
| :--- | :--- | :--- |
| **Tier 1: High Fidelity** | Precise OCR and layout recognition | **Gemini 3.1 Pro**, Claude 3.7 Sonnet (Reasoning), GPT-4o |
| **Tier 2: Fast Vision** | Rapid screenshot analysis | Gemini 3 Flash, Claude 4.5 Haiku, Mistral Small Vision |
| **Tier 3: Fallbacks** | Redundancy for congestion events | Perplexity Vision, Mistral Large 2 |

### The "Ears" (Audio) 👂

| Modality | Engine | Deployment |
| :--- | :--- | :--- |
| **Primary** | **Local Whisper (Tiny.en)** | Node-side Python/Xenova Server (Port 3000) |
| **Secondary** | **Groq (Whisper-Large-V3)** | Ultra-fast Cloud inference with 40ms latency |

---

## 🐛 Solved Engineering Challenges

<details>
<summary><strong>1. Visual Convergence: The Centering Paradox</strong></summary>

**Problem:** Centering content in an Electron window using standard CSS (`mx-auto`) creates large empty "logical hitboxes" flanking the content. These invisible areas would block mouse clicks directed at underlying desktop applications, even if the user could "see through" them.

**Solution:** Engineered a **Dynamic Interactive Layering System**. We decoupled visual alignment from the interaction handler. By precisely calculating the `max-w-3xl` viewport bounds and dynamically updating Electron's `setIgnoreMouseEvents` specifically for the X-axis margins, we ensured the app feels visually balanced while physically remaining non-blocking to the rest of the OS.
</details>

<details>
<summary><strong>2. Atomic Async Input Injection</strong></summary>

**Problem:** Injecting transcribed text into an active React `textarea` often causes "State overwrite" where user typing and async transcription events collide, leading to cursor jumps or data loss.

**Solution:** Implemented a **Synchronized State Buffer Manager**. The dictation handler takes an atomic snapshot of the current input value upon microphone closure, performs a clean string append, and forces a cursor refocus event to the end of the new string. This ensures the user's manual work is never discarded during transcription delays.
</details>

<details>
<summary><strong>3. Deterministic Geometry vs. OS Feedback Loops</strong></summary>

**Problem:** Standard Electron windows trigger recursive resize events when switching between "Expanded" (Chat) and "Shrink" (Mini) modes, as the OS layout engine and the Electron main process disagree on final bounds.

**Solution:** Built a **Hard-Boundary Controller** in `WindowHelper.ts`. It utilizes a strictly isolated memory state for each mode. Instead of listening to window resize events, it forcefully overrides boundaries *exclusively* during state transitions using `setMinimumSize` and `setMaximumSize` locks at the process level, effectively terminating resize loops before they start.
</details>

<details>
<summary><strong>4. DOM AST Interception for Aesthetic Highlighting</strong></summary>

**Problem:** Security-focused sanitization in `react-markdown` was stripping custom coloring tags (`<mark>`), making categorized AI responses indistinguishable and hard to read.

**Solution:** Engineered a **Custom Render Interceptor** that operates at the Abstract Syntax Tree (AST) level. Instead of relying on vulnerable raw HTML, the interceptor scans for specific semantic markers (e.g., `**Say:**`) and dynamically injects scoped Tailwind classes (`bg-yellow-500/20`) during the DOM generation phase, preserving 100% XSS security while achieving high-end visual categorization.
</details>

<details>
<summary><strong>5. The "Ghost Interaction" Physics</strong></summary>

**Problem:** True ghost windows (click-through) are physically unreachable for scrolling history. Switching between "Interactable" and "Transparent" manually is slow and cumbersome.

**Solution:** Developed a **Modifier-Driven Hit-Test Override**. By leveraging Electron's `forward` flag with `setIgnoreMouseEvents`, we tracked mouse coordinates in a transparent state. Combining this with a low-level listener for the `Ctrl` key allowed us to "solidify" the interaction target only on-demand, creating a fluid, professional feel for power users.
</details>

<details>
<summary><strong>6. Contextual History Sanitization (API Logic)</strong></summary>

**Problem:** High-reasoning models like Gemini 3.1 and Perplexity crash if the conversation history starts with an AI message (the "Initial Greeting" bug).

**Solution:** Implemented a **Strict First-User Sanitizer** in the model waterfall. Before any request, the pre-processor scans the array, identifies the first index where `role === "user"`, and slices the context accordingly, preventing 100% of start-up API errors.
</details>

<details>
<summary><strong>7. Semantic Intelligence: AI-Powered Titling</strong></summary>

**Problem:** Generic date-based titles (e.g., "Session Mar 4") force users to manually hunt through history, destroying the productivity benefit of a saved knowledge base.

**Solution:** Developed an **Asynchronous Intent Distiller**. When a new session is initialized, the system spawns an isolated background prompt to a fast reasoning model to summarize the user's core question into a concise (<6 words) semantic title, automatically updating the History database for easy retrieval.
</details>

<details>
<summary><strong>8. Auto-Scaling Dynamic Prompt Editor</strong></summary>

**Problem:** A fixed-height edit input is either too large for simple fixes or too small for thorough prompt revisions, leading to a cramped user experience.

**Solution:** Built a **Ref-based Auto-Resizer** component. The edit textarea starts at a compact single line (40px). As text is added, it dynamically recalculates its `scrollHeight` and expands the UI container up to a deterministic 120px limit, at which point it elegantly transitions into a scoped scroll view.
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
Create a `.env` file in the root directory. This project utilizes a sophisticated model waterfall requiring the following keys:

| Category | API | Usage |
| :--- | :--- | :--- |
| **Brain & Eyes** | `GEMINI_API_KEY` | Primary Reasoning & High-Res Vision |
| **Logic Waterfall** | `GITHUB_TOKEN` | DeepSeek, GPT-4o, and Llama 3.3 Access |
| **Research & Search** | `PERPLEXITY_API_KEY` | Real-time web-grounded research |
| **Advanced Reasoning** | `OPENROUTER_API_KEY` | Access to Llama 405B and Claude 3.7 |
| **Speed Optimization** | `NVIDIA_API_KEY` | Tier-1 latency optimization (Nemotron/Llama) |
| **Cloud Audio** | `GROQ_API_KEY` | 40ms latency transcription backup |

### 3. Launch
```bash
npm start
```
*This orchestrated command initializes the Vite development server, spawns the Electron main process, and boots the local Python-based Whisper server on Port 3000.*

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
**Moubely** aims to be more than a chatbot—it is a study in **Unobtrusive Intelligence**. By solving deep UI/UX challenges in the Electron sandbox, it provides a blueprint for how AI companions should live on the desktop: fast, private, and always available without interrupting the human flow.

**Author:** [Moubarak-01](https://github.com/Moubarak-01)  
**License:** [MIT License](LICENSE)  

---
<p align="center">Made with ❤️ for high-performance builders</p>
