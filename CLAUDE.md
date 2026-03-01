# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OllamaBro is a Chrome extension that enables users to chat with local Ollama models directly in their browser. The project consists of two main components:

1. **Chrome Extension** (`chrome_extension/`) - The frontend that runs in the browser
2. **Proxy Server** (`proxy_server/`) - A CORS proxy server that facilitates communication between the extension and Ollama API

## Architecture

The application follows a client-proxy-server architecture:
- Chrome extension UI communicates with the proxy server on `http://localhost:3000`
- Proxy server forwards requests to Ollama API on `http://localhost:11434`
- All chat conversations are stored locally using Chrome's storage API
- Multiple model support with conversation history per model

## Common Commands

### Start the Proxy Server
```bash
cd proxy_server
npm start
```

### Load the Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `chrome_extension/` directory

### Install Dependencies
```bash
cd proxy_server
npm install
```

### Start with PM2 (Recommended for Development)
```bash
cd proxy_server
pm2 start server.js --name ollama-proxy
pm2 save
```

### Check Server Status
```bash
pm2 list
pm2 logs ollama-proxy
```

## Key Components

### Chrome Extension Structure
- `popup.html/js` - Extension popup for model selection
- `chat.html/js` - Main chat interface with streaming support
- `background.js` - Service worker for tab management
- `manifest.json` - Extension configuration

### Proxy Server
- `server.js` - Express server with CORS handling and request filtering
- Only allows requests to specific Ollama API endpoints (`/api/tags`, `/api/chat`, `/api/generate`)
- Enforces localhost-only connections for security
- Automatically enables streaming for chat requests

### Storage System
- Conversations are stored per-model using Chrome storage API
- Storage key format: `ollamaBroChat_{sanitized_model_name}`
- Each model maintains independent conversation history and active conversation state

## Prerequisites

Before development, ensure you have:
- [Ollama](https://ollama.com/) running locally on port 11434
- [Node.js](https://nodejs.org/) installed
- Chrome browser for extension testing

## Multimodal Support

OllamaBro now supports vision models that can process images alongside text:

### Supported Vision Models
- LLaVA (all variants: 7b, 13b, 34b, v1.6)
- Llama 3.2-Vision (11b, 90b)
- BakLLaVA
- Moondream

### Image Features
- **Automatic detection** - Image upload UI appears only for vision-capable models
- **Multiple formats** - Supports JPEG, PNG, GIF, WebP up to 20MB
- **Drag & drop** - Drop images anywhere in the chat interface
- **Image preview** - Review images before sending with removal option
- **Auto-compression** - Large images are automatically compressed
- **Chat history** - Images are stored and displayed in conversation history

### Implementation Details
- Images are base64-encoded for Ollama API compatibility
- Smart capability detection queries Ollama API for model metadata
- Image data is stored in conversation history alongside text
- Automatic cleanup of image preview URLs to prevent memory leaks

## Model Capability Indicators

Visual indicators help identify model capabilities using intelligent detection:

### Vision Models 👁️
- **Green eye icon** appears next to vision-capable models
- Shown in model dropdown and chat header
- Indicates support for image input (LLaVA, Llama 3.2-Vision, Gemma3, etc.)

### Reasoning Models 🧠  
- **Purple brain icon** appears next to reasoning-optimized models
- Displayed alongside model names in dropdown and header
- Indicates models optimized for complex thinking (Qwen2.5, CodeLlama, DeepSeek, etc.)

### Smart Detection System
- **API-based**: Queries Ollama `/api/show` endpoint for model metadata
- **Template Analysis**: Examines model templates for vision/reasoning keywords
- **Architecture Detection**: Checks for CLIP components (vision models)
- **Intelligent Fallback**: Uses improved pattern matching with flexible name handling
- **Caching**: Stores detected capabilities to avoid repeated API calls
- **Auto-refresh**: Updates UI when capabilities are detected asynchronously

### Detection Criteria
- **Vision**: Looks for image/vision keywords, CLIP architecture, multimodal templates
- **Reasoning**: Checks for think/reason/code keywords, large parameter counts (>7B), coding-specific templates
- **Flexible Matching**: Handles model name variations and custom tags

## Release Process

After every feature implementation, feature update, or major change:

1. **Bump the version** in `chrome_extension/manifest.json` using patch increments (e.g. `1.0.4` → `1.0.5`). Do not bump for minor fixes, typos, or refactors.
2. **Update `README.md`** — add a description of the new feature under the appropriate section (or create a new section). Include setup steps if the feature requires configuration.

Do not bump the version or update the README for bug fixes or internal refactors unless they significantly change user-facing behaviour.

## Development Notes

- The proxy server runs on port 3000 and expects Ollama on port 11434
- Extension uses Manifest V3 with host permissions for `http://localhost:3000/*`
- Chat interface supports streaming responses and conversation management
- All messages support `<think>` tag parsing for reasoning display
- Image upload UI is dynamically shown/hidden based on model capabilities
- Vision models receive images in the `images` array as base64 strings