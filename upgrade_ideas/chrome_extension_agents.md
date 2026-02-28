# Adding Agent Mode to Your Ollama Chrome Extension

Integrating an "agent mode" into your existing Chrome extension is a fantastic way to leverage your local and cloud Ollama models. Based on current research, here are the top recommendations for existing projects, SDKs, and the optimal Manifest V3 architecture.

---

## 1. Top 3 Existing Open-Source AI Agents/Projects

If you want to incorporate an existing agent framework directly into your extension, these are the most compatible open-source projects:

1. **BrowserAgent**
   - **Overview:** A privacy-first, fully local automation framework specifically designed for Chrome extensions.
   - **Why it fits:** It enables scriptable multi-agent workflows in JavaScript/TypeScript without cloud dependencies. Since it runs entirely in Chrome, it pairs perfectly with your local Ollama models.
2. **Nanobrowser**
   - **Overview:** An open-source Chrome extension that already demonstrates the architecture you are building.
   - **Why it fits:** It supports flexible LLM API keys and multi-agent workflows. You can study its implementation, fork it, or extract its agent orchestration logic to plug into your own extension.
3. **Browser Use**
   - **Overview:** One of the most popular open-source frameworks for building AI browser agents.
   - **Why it fits:** While it has a strong Python presence, it explicitly supports Chrome extensions and local models. It excels at navigating the DOM and making autonomous decisions based on LLM outputs.

---

## 2. Top 3 JS/TS SDKs/Frameworks for Custom Agents

If you prefer to build your own agents from scratch (similar to using Agent SDK), these JavaScript/TypeScript frameworks are the best fit for a browser environment:

1. **Browser Use (TypeScript SDK)**
   - **Why it fits:** It is optimized for AI-powered browser automation with LLM-driven decision-making. It supports session management for persistent state (e.g., across tabs) and is highly compatible with local models like Ollama. It requires no external infrastructure, making it ideal for a local-first extension.
2. **Stagehand (by Browserbase)**
   - **Why it fits:** A TypeScript-first framework that combines Playwright predictability with AI reasoning for natural language web actions (`act()`, `extract()`, `observe()`). It uses semantic element targeting via accessibility trees (avoiding brittle CSS selectors) and features self-healing for dynamic sites. It's perfect for continuous agent loops.
3. **LangChain.js**
   - **Why it fits:** A mature JS/TS framework for agentic systems, enabling tool-calling, memory, and ReAct loops. It excels in extensions due to its modular, no-server design—it runs fully client-side. It has strong TypeScript typing, browser polyfills for Web APIs, and built-in wrappers for Ollama.

---

## 3. Best Lightweight Architecture for Chrome Extensions (Manifest V3)

To keep your agents available at all times and running continuous loops (like polling Ollama or maintaining state), **Offscreen Documents** are the superior choice over Background Service Workers.

### Why Offscreen Documents?

| Feature | Background Service Workers | Offscreen Documents (Recommended) |
| :--- | :--- | :--- |
| **Persistence** | Ephemeral; terminates on inactivity (~5min idle). | Persistent until explicitly closed; survives tab closes/navigation. |
| **Compute** | Event-driven only; limited for continuous LLM inference. | Full document context (HTML/JS/CSS); supports long-running loops and WebSockets. |
| **API Access** | Restarts disrupt stateful agents. | Excellent for sustained localhost calls (Ollama); isolated from tabs for security. |

### Implementation Strategy

1. **Manifest Declaration:** Declare `"offscreen"` in your `manifest.json`.
2. **Initialization:** Use your background script to create the offscreen document when the extension loads:
   ```javascript
   chrome.offscreen.createDocument({
     url: 'offscreen.html',
     reasons: ['DOM_PARSER', 'WORKERS'],
     justification: 'Agent LLM loops and state management'
   });
   ```
3. **Agent Hosting:** Host your agent logic (e.g., LangChain.js chains, Ollama fetch requests) inside `offscreen.html` and its associated JavaScript file.
4. **Keep-Alive:** Offscreen documents auto-terminate after 10 minutes of inactivity. Set up a ping every 9 minutes via `chrome.runtime.sendMessage` from your background script to keep the agent loop alive indefinitely.
5. **Communication:** Use Chrome's messaging API to pass instructions from your popup or content scripts to the offscreen agent, and have the agent execute DOM manipulations by sending messages back to the active tab's content script.
