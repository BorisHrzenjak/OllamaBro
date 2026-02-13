# OllamaBar Feature Plan

## TOP 3 Product/UX Opportunities

### 1. **Hardcoded Server URLs - No Configuration System**

**What's Missing:** Both the proxy server URL (`localhost:3000`) and Ollama API URL (`localhost:11434`) are hardcoded in the extension and proxy server code. There's no way for users to configure these.

**Why It Matters:** This is a fundamental blocker for many real use cases:
- Users running Ollama on non-standard ports
- Users wanting to access Ollama on a different machine (LAN/remote access)
- Users with multiple Ollama instances
- Future-proofing for different deployment scenarios

**Concrete Changes:**
- Add configuration storage in `chrome.storage.local` for proxy URL and Ollama API URL
- Create a settings panel (gear icon in popup or chat header) to configure:
  - Proxy Server URL (default: `http://localhost:3000`)
  - Ollama API URL (default: `http://localhost:11434`)
- Update `proxy_server/server.js` to accept OLLAMA_API_BASE_URL via environment variable for the same flexibility
- The extension should gracefully handle connection failures with actionable error messages suggesting to check settings

---

### 2. **Model Capability Intelligence - Auto-Detection & Filtering**

**What's Missing:** Users see a flat list of models with no indication of capabilities. They must manually test or look elsewhere to know which models support images (vision), coding, or reasoning. The `/api/show` endpoint is already in the proxy but unused for this purpose.

**Why It Matters:** With dozens of models available, users waste significant time guessing which model to use. The vision model error message (`"Try a vision model like LLaVA"`) is reactive rather than proactive.

**Concrete Changes:**
- On model list load, parallel-query `/api/show` for each model to fetch metadata
- Cache capability data in `chrome.storage.local` to avoid repeated API calls
- Add filter buttons in model dropdown: "All" | "Vision" | "Coding" | "Reasoning"
- Display capability badges next to model names (eye icon for vision, brain icon for reasoning)
- Store detected capabilities in a `modelCapabilities` key for instant UI updates on subsequent loads

---

### 3. **Conversation Context Control - System Prompt + Window Management**

**What's Missing:** No way to set a system prompt to guide model behavior. The app naively sends all conversation history without any context management or limits.

**Why It Matters:** 
- Different use cases need different system instructions (e.g., "Act as a code reviewer" vs "Be concise")
- Unbounded context accumulates and can hit token limits, causing API failures mid-conversation
- Users have no visibility into conversation size or token usage

**Concrete Changes:**
- Add a "System Prompt" input field accessible via a settings/cog icon in the chat header
- Persist the system prompt per-model in storage
- Prepend system prompt as the first message in the API request payload
- Add a conversation token/message count indicator in the sidebar
- Implement a "Clear Context" button to start fresh while keeping the system prompt
- Warn users when approaching typical context limits (e.g., 4000+ messages or estimated tokens)

---

## Honorable Mentions (Not in Top 3)

- **Code syntax highlighting** - Would help with coding models, but lower impact than the three above
- **Keyboard shortcuts** (Ctrl+Enter to send, etc.) - Nice to have but not a blocker
- **Markdown rendering** - Currently displays raw markdown; rendering would improve readability
- **Export full conversation** - Individual message export exists, but full chat export is missing
