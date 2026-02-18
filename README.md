# OllamaBro

![Screenshot_2](https://github.com/user-attachments/assets/b3e0d3ad-6415-4f04-aff5-dd0929d54458)


OllamaBro is a Chrome extension that provides a full-featured chat interface for your local Ollama models — directly in the browser, no cloud required.

## Features

### Model Management
- Switch between all available Ollama models from the extension popup
- **Model capability indicators** next to every model name:
  - 👁️ Green eye icon — vision-capable models (LLaVA, Llama 3.2-Vision, Gemma3, etc.)
  - 🧠 Purple brain icon — reasoning-optimised models (Qwen2.5, DeepSeek, CodeLlama, etc.)
- Smart capability detection via Ollama API (`/api/show`), template analysis, and architecture inspection, with caching to avoid repeated calls

### Chat Interface
- Dedicated browser tab chat window with a collapsible conversation sidebar
- Multiple independent conversations per model, each with its own history
- **Streaming responses** with a stop-generation button
- **Markdown rendering** with syntax highlighting (via Highlight.js) and per-block copy buttons
- **`<think>` tag support** — reasoning traces rendered in a collapsible "thinking" block
- **Message actions** (appear on hover): copy, regenerate, text-to-speech
- **Message metadata** (appear on hover): token count, generation speed, timing

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

## Setup

### Quick setup (recommended)

Run the one-time setup script from the project root:

```
setup.bat
```

This single script will:
1. Install proxy server npm dependencies
2. Install PM2 globally (if not already present) and start the proxy server as a managed background process that survives reboots
3. Register the native messaging host required by Kokoro TTS

> **Note:** If you ever move the project folder, re-run `setup.bat` to update the paths.

### Load the Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `chrome_extension/` folder

The OllamaBro icon will appear in the toolbar. Click it to pick a model and start chatting.

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
pm2 startup   # follow the printed instructions
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

Writes a manifest to `proxy_server/` and adds a registry entry under `HKCU` (no administrator rights needed).

</details>
