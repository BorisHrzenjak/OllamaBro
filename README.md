# OllamaBro `v1.0.5`

![Screenshot_2](https://github.com/user-attachments/assets/b3e0d3ad-6415-4f04-aff5-dd0929d54458)


OllamaBro is a Chrome extension that provides a full-featured chat interface for your local Ollama models — directly in the browser, no cloud required. It also supports **llama.cpp** as a second backend, letting you run any GGUF model alongside your Ollama models without touching a terminal.

## Features

### Model Management
- Switch between all available Ollama models from the extension popup
- **Model capability indicators** next to every model name:
  - 👁️ Green eye icon — vision-capable models (LLaVA, Llama 3.2-Vision, Gemma3, etc.)
  - 🧠 Purple brain icon — reasoning-optimised models (Qwen2.5, DeepSeek, CodeLlama, etc.)
- Smart capability detection via Ollama API (`/api/show`), template analysis, and architecture inspection, with caching to avoid repeated calls
- **Hardware Recommendations** — Settings → Model Management → *View Recommended Models* opens a popup powered by [llmfit](https://github.com/notBradPitt/llmfit) that analyses your GPU/CPU and lists every model from a curated catalogue, grouped by fit level:
  - 🟢 **Perfect** — fully fits in VRAM at the recommended quantisation
  - 🟡 **Good** — runs well with minor tradeoffs
  - 🟠 **Marginal** — fits but tight
  - 🔴 **Too Large** — won't fit on current hardware
  - Each card shows estimated speed (t/s), VRAM usage %, best quantisation, run mode, and a **Pull** button that pre-fills the model name in the Pull Model input
  - Requires llmfit to be installed (optional — the rest of the extension works fine without it)

### ⚡ llama.cpp Support *(new in v1.0.2)*
- Run any **GGUF model** directly via llama.cpp alongside your Ollama models — no config file editing required
- The model switcher shows a dedicated **⚡ llama.cpp** section listing every `.gguf` file found in your configured models directory
- Clicking a GGUF model loads it automatically — the proxy starts and manages the `llama-server` process, polls until it is ready, and then enables the input
- Switching to a different GGUF model kills the old process and starts a fresh one, all from inside OllamaBro
- **Thinking model support** — `reasoning_content` tokens stream directly into the collapsible thinking box in real time (identical behaviour to Ollama reasoning models)
- **Generation stats** — token count, prompt tokens, tokens/second, and generation time appear after each response, same as Ollama
- Configure everything from Settings → **⚡ llama.cpp**: binary path, models directory, GPU layers (`-1` = all), and server port

### Prompt Templates (Slash Commands) *(new in v1.0.5)*
- Type `/` at the start of the message box to open a **command palette** of saved prompt templates
- Filter in real time as you type (e.g. `/sum` narrows to `/summarize`)
- Navigate with **↑ ↓**, insert with **Enter** or **Tab**, dismiss with **Esc**, or click any item
- Eight built-in templates: `/translate`, `/summarize`, `/fix-code`, `/explain`, `/improve`, `/eli5`, `/brainstorm`, `/proofread`
- Fully customisable — **Settings → Prompt Templates** to add, edit, or delete templates

### Chat Interface
- Dedicated browser tab chat window with a collapsible conversation sidebar
- Multiple independent conversations per model, each with its own history
- **Streaming responses** with a stop-generation button
- **Markdown rendering** with syntax highlighting (via Highlight.js) and per-block copy buttons
- **`<think>` tag support** — reasoning traces rendered in a collapsible "thinking" block
- **Message actions** (appear on hover): copy, regenerate, text-to-speech
- **Message metadata** (appear on hover): token count, generation speed, timing

### Web Search
- **Globe button** in the input bar toggles web search on/off for the current message
- **Auto-trigger** — search fires automatically when your message contains temporal or news-related keywords (`today`, `latest`, `newest`, `breaking`, `news about`, year mentions, etc.)
- **Live URL fetching** — any `http(s)://` URL you include in a message is automatically fetched and its live content injected into context (no toggle needed)
- Two complementary backends:
  - *Jina Reader* — free, no API key, fetches and extracts any URL as clean text in real time
  - *Tavily* — AI-optimised web search with full page content extraction (free tier: 1,000 searches/month, no credit card)
- Search results are injected into the model's context before the request is sent — works with every local model, no tool-calling support required
- Configure your Tavily key in `proxy_server/.env` (see Setup)

### Multimodal / Vision
- Image upload UI appears automatically for vision-capable models
- Drag-and-drop images anywhere in the chat window
- Multiple images per message (JPEG, PNG, GIF, WebP up to 20 MB)
- Image preview before sending with individual removal
- Auto-compression for oversized images
- Images stored in conversation history and displayed inline

### Voice
- **Voice input** — dictate messages with the microphone button (Web Speech API), with animated recording indicator
- **Text-to-speech** — read any AI response aloud:
  - *Browser engine* — uses the system's built-in Web Speech API with voice selection
  - *Kokoro engine* — local neural TTS with model status indicator and voice selection
- `Ctrl+R` to read the last response without touching the mouse

### System Prompt & Persona Presets
- Per-model system prompt, saved and restored automatically
- **Persona presets** — save, name, edit, and one-click apply reusable system prompts
- Live token counter on the system prompt textarea

### Model Parameters
- Adjust generation parameters per model without leaving the chat:
  - Temperature, Top P, Top K, Repeat Penalty, Max Tokens, Seed
- Sliders and numeric inputs stay in sync
- Reset to defaults button
- Quick access via the **⊟ parameters button** in the chat header (opens directly to the parameters section)

### Context Window
- Visual context usage indicator in the sidebar (tokens used / limit)
- Warning and critical states as the context fills
- Override the context window size per model, or let it auto-detect

### Themes
Six built-in themes selectable from Settings → Appearance:

| Theme | Style |
|---|---|
| Default Dark | Dark minimal (default) |
| Dracula | Dark — purple accent |
| Tokyo Night | Dark — blue-violet accent |
| GitHub Light | Light — GitHub blue |
| Solarized Light | Light — warm beige |
| Catppuccin Latte | Light — pastel blue |

Theme is applied instantly and persisted across sessions. Code blocks automatically switch between a matching dark or light syntax-highlighting stylesheet.

### UX & Polish
- **Smart auto-scrolling** — follows new tokens automatically; pauses when you scroll up; scroll-to-bottom button reappears during streaming
- **Input draft persistence** — unsent text is saved per conversation and restored when you return
- **Prompt history navigation** — press ↑/↓ in the input to cycle through previously sent messages
- **Export conversation** as Markdown with the download button in the header
- **Keyboard shortcuts**:

| Action | Shortcut |
|---|---|
| Send message | `Enter` / `Ctrl+Enter` |
| New chat | `Alt+N` |
| Delete current conversation | `Ctrl+D` |
| Read last response aloud | `Ctrl+R` |
| Abort generation | `Esc` |
| Browse message history | `↑` / `↓` |
| Show shortcuts panel | `Alt+H` |

## Prerequisites

- [Ollama](https://ollama.com/) running locally on port 11434
- [Node.js](https://nodejs.org/) (includes npm)
- Google Chrome
- *(Optional)* [Tavily](https://tavily.com/) free API key for web search (1,000 searches/month, no credit card)
- *(Optional)* [llmfit](https://github.com/notBradPitt/llmfit) for hardware-aware model recommendations
- *(Optional)* [llama.cpp](https://github.com/ggerganov/llama.cpp/releases) — `llama-server` binary for running GGUF models

## Setup

### 1. Run the setup script

Double-click **`setup.bat`** (or run it in a terminal) from the project root. That's it — no command-line flags, no manual steps.

It will automatically:

1. **Check Node.js** — exits with a clear error and download link if Node isn't found
2. **Install dependencies** — runs `npm install` inside `proxy_server/`
3. **Install PM2** — installs the process manager globally if it isn't already present
4. **Start the proxy server** — launches it under PM2 so it runs in the background and restarts automatically after a reboot
5. **Register the native messaging host** — runs `install.js`, which:
   - Writes `proxy_server/com.ollamabro.proxy.json` with the **correct absolute path** for your machine (no hardcoded paths)
   - Adds a registry entry under `HKCU` for both **Chrome** and **Edge** — no administrator rights required

> **Moved the folder?** Just re-run `setup.bat` to update the paths.
> **Only need to re-register the native host?** Run `install-native-host.bat` instead — it skips the npm/PM2 steps.

---

### 2. Load the Chrome extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `chrome_extension/` folder

The OllamaBro icon will appear in the toolbar. Click it to pick a model and start chatting.

---

### Web Search (optional)

To enable Tavily-powered search, create `proxy_server/.env` and add your API key:

```
TAVILY_API_KEY=your_key_here
```

Get a free key at [tavily.com](https://tavily.com) — no credit card required. URL fetching via Jina Reader works without any key.

Restart the proxy after adding the key:

```bash
pm2 restart ollama-proxy
```

### Hardware Recommendations (optional)

Install [llmfit](https://github.com/notBradPitt/llmfit) to enable the *Recommended for Your Hardware* popup in Settings → Model Management:

```bash
cargo install llmfit
```

> Requires the [Rust toolchain](https://rustup.rs/). Once installed, no further configuration is needed — OllamaBro detects it automatically via the proxy server.

---

### ⚡ llama.cpp (optional)

1. Download the latest `llama-server` binary from the [llama.cpp releases page](https://github.com/ggerganov/llama.cpp/releases) and place it alongside your GGUF models (or anywhere you like).

2. In OllamaBro, open **Settings → ⚡ llama.cpp** and set:
   - **Binary path** — full path to `llama-server.exe` (e.g. `C:\llama.cpp\llama-server.exe`)
   - **Models directory** — folder containing your `.gguf` files (e.g. `C:\llama.cpp`)
   - **GPU layers** — `-1` to offload all layers to GPU, or a specific number for partial offload
   - **Port** — defaults to `8080`; change if something else is already using it

3. Click **Save**. Your GGUF files will appear under **⚡ llama.cpp** in the model switcher. Click any model to load it — OllamaBro handles starting and stopping `llama-server` automatically.

> Settings are saved across sessions. The proxy server must be running (`pm2 restart ollama-proxy` once after any proxy update).

---

### Manual setup (advanced)

<details>
<summary>Expand for manual steps</summary>

#### Proxy server

```bash
cd proxy_server
npm install
npm start
```

The server runs on `http://localhost:3000`. Keep the terminal open while using the extension.

#### Auto-start with PM2

```bash
npm install pm2 -g
cd proxy_server
pm2 start server.js --name ollama-proxy
pm2 save
```

Useful PM2 commands:

```bash
pm2 list
pm2 logs ollama-proxy
pm2 stop ollama-proxy
pm2 restart ollama-proxy
pm2 delete ollama-proxy
```

#### Kokoro TTS — Native Messaging Host

```
install-native-host.bat
```

Runs `install.js`, which writes `proxy_server/com.ollamabro.proxy.json` with the correct absolute path for your machine and registers it in the Windows registry under `HKCU` for both Chrome and Edge (no administrator rights needed).

</details>
