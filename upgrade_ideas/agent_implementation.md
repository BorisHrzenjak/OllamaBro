# Agent Implementation Research & Recommendations

> Research conducted February 2026. Based on live GitHub data, npm package versions, and real-world testing reports.

---

## Reality Check: Which Frameworks Actually Exist

Both research docs in this folder mix real frameworks with fabricated ones.

| Framework | Real? | Stars | Notes |
|---|---|---|---|
| **OpenClaw** | Yes | 239k | System daemon, NOT embeddable in MV3 |
| **ZeroClaw** | Yes | 20.9k | Already integrated — Rust binary, backend only |
| **AgentZero** | Yes | 15.5k | Python/Docker, backend only |
| **Nanobrowser** | Yes | 12.3k | Chrome extension, most similar to OllamaBar |
| **Browser Use** | Yes | 79.2k | Python + Playwright — **wrong paradigm entirely** |
| **Stagehand** | Yes | 21.3k | Node.js + Playwright — **wrong paradigm** |
| **LangChain.js** | Yes | 17.1k | Partially browser-compatible |
| **Vercel AI SDK** | Yes | 22.2k | Browser-native, best in-extension pick |
| **OpenAI Agents SDK** | Yes | 2.4k | Known Ollama bugs, not MV3-ready |
| **BrowserAgent** | **No** | — | **Hallucinated name — does not exist** |
| **Page Assist** | Yes | 7.6k | Real Chrome extension doing same thing as OllamaBar, worth studying |

**Key insight:** Browser Use, Stagehand, and BrowserAgent should be dropped from all consideration. The first two control a browser from the outside via Playwright (completely different paradigm from being an MV3 extension). BrowserAgent is not a real project.

---

## Top 3 Recommendations

### #1 — Vercel AI SDK + `ollama-ai-provider` (in-extension)

**GitHub:** [vercel/ai](https://github.com/vercel/ai) — 22.2k stars, Apache 2.0
**Ollama provider:** `ollama-ai-provider` v3.7.1 (community package, updated Feb 2026)

**Why it's the best fit:**
- Runs directly inside `chat.js` or a Side Panel — no server changes needed
- Proven working in Chrome MV3 extensions (Vercel Labs has an example repo)
- Point it at the existing proxy: `baseURL: 'http://localhost:3000/v1'` — zero changes to `server.js`
- Switching to OpenRouter is one line: change `baseURL` to `https://openrouter.ai/api/v1`
- The `maxSteps` parameter on `streamText`/`generateText` IS the agent loop — built in
- Far smaller bundle than LangChain.js
- Streams via ReadableStream, which MV3 service workers support natively

**Example:**
```js
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: 'http://localhost:3000/v1'
});

const result = streamText({
  model: ollama('qwen2.5:7b'),
  tools: { web_search: tavilyTool, read_page: jinaTool },
  maxSteps: 10,  // ← this IS the agent loop
  prompt: userMessage,
});

for await (const chunk of result.fullStream) {
  // stream to chat UI
}
```

**Background operation:** Run in a Chrome Side Panel (persistent across tab navigation, no 30-second idle timeout like service workers) or an Offscreen Document for fully background/autonomous tasks.

**Install:**
```bash
npm install ai @ai-sdk/openai-compatible ollama-ai-provider
```

---

### #2 — Custom ReAct Loop in `server.js` (in proxy, zero new dependencies)

**What it is:** ~80 lines of vanilla JS added as `POST /api/agent/run` in the existing Express proxy. No new npm packages. Uses already-existing Tavily and Jina tools.

**Why it's pragmatic:**
- Zero new dependencies — everything already exists in the proxy
- Agent runs autonomously even if the extension popup closes
- Streams SSE progress tokens back to the extension (same pattern as `/api/chat`)
- No MV3 bundling concerns at all
- Models like `qwen2.5:7b` and `llama3.1:8b` support native tool-calling through Ollama's `/api/chat`

**Core loop:**
```js
app.post('/api/agent/run', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const TOOLS = [
    {
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for current information',
        parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'read_page',
        description: 'Read the content of a web page',
        parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
      }
    }
  ];

  const messages = [
    { role: 'system', content: 'You are a helpful agent. Use tools when needed to answer accurately.' },
    { role: 'user', content: req.body.message }
  ];

  for (let i = 0; i < 10; i++) {
    const resp = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: req.body.model, messages, tools: TOOLS, stream: false })
    });
    const data = await resp.json();
    const msg = data.message;
    messages.push(msg);

    res.write(`data: ${JSON.stringify({ type: 'content', content: msg.content })}\n\n`);

    if (!msg.tool_calls?.length) break;

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = tc.function.arguments;
      res.write(`data: ${JSON.stringify({ type: 'tool', name })}\n\n`);

      let result;
      if (name === 'web_search') result = await fetchTavilyResults(args.query);
      else if (name === 'read_page') result = await fetchPageViaJina(args.url);
      else result = 'Unknown tool';

      messages.push({ role: 'tool', content: JSON.stringify(result) });
    }
  }

  res.write('data: [DONE]\n\n');
  res.end();
});
```

**This is the pragmatic starting point.** Deep research via Tavily, web search via Jina, and ZeroClaw agent integration are already built — this is the same pattern extended into a full loop.

---

### #3 — BeeAI Framework in `server.js` (when you need more power)

**GitHub:** [i-am-bee/beeai-framework](https://github.com/i-am-bee/beeai-framework) — 3.1k stars, Apache 2.0 (IBM)

**What it is:** TypeScript agent framework with a native `OllamaChatLLM` adapter, token-aware memory (auto-prunes when context window fills), built-in MCP server support, streaming, and ReAct loop. Designed for Node.js production — fits `server.js` perfectly.

**Why it's better than LangChain.js for the proxy:**
- Native `OllamaChatLLM` class (not an OpenAI shim with compatibility caveats)
- `TokenMemory` handles long multi-step agents without manual message pruning
- MCP support — connects to any MCP tool server
- Lighter and more focused than LangChain.js
- Simpler API than OpenAI Agents SDK with no Ollama-specific bugs

**Example:**
```js
import { BeeAgent } from "bee-agent-framework/agents/bee/agent";
import { OllamaChatLLM } from "bee-agent-framework/adapters/ollama/chat";
import { TokenMemory } from "bee-agent-framework/memory/tokenMemory";

const llm = new OllamaChatLLM({ modelId: "qwen2.5:7b" });
const agent = new BeeAgent({
  llm,
  memory: new TokenMemory({ llm }),
  tools: [tavilySearchTool, jinaReaderTool],
});

// In Express endpoint, stream back to extension:
await agent.run({ prompt: userMessage }).observe(emitter => {
  emitter.on("update", ({ data }) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
});
```

**Install:**
```bash
npm install bee-agent-framework
```

---

## Recommended Architecture

The cleanest split given OllamaBar's existing structure:

```
┌─────────────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                                      │
│                                                              │
│  ┌──────────────────────┐    ┌───────────────────────────┐  │
│  │ Side Panel / chat.html│    │ Offscreen Document        │  │
│  │ (Vercel AI SDK)       │←──→│ (background agent loop,   │  │
│  │ inline agent for      │    │  keepalive, autonomous    │  │
│  │ interactive tasks)    │    │  tasks)                   │  │
│  └──────────────────────┘    └───────────────────────────┘  │
│                  ↕ chrome.runtime.sendMessage                │
│              background.js (message router, thin)            │
└─────────────────────────────────────────────────────────────┘
                   ↕ HTTP (localhost:3000)
┌──────────────────────────────────────────────────────────────┐
│  Express Proxy (server.js)                                    │
│                                                               │
│  POST /api/agent/run  ← ReAct loop (#2 or #3), streams SSE   │
│  POST /proxy/api/chat ← existing bare Ollama forward          │
│  POST /api/search     ← existing Tavily                       │
│  GET  /api/agent/status ← existing ZeroClaw status           │
└──────────────────────────────────────────────────────────────┘
                   ↕ HTTP (localhost:11434)
              Ollama (native tool calling)
```

**Simple interactive tasks** → Vercel AI SDK in Side Panel, routed through existing proxy
**Autonomous/background tasks** → `POST /api/agent/run` on proxy, SSE stream back to extension
**Complex multi-agent, MCP** → BeeAI Framework in proxy when complexity demands it

---

## Background Persistence in MV3

Service workers terminate after **30 seconds of inactivity** — a hard constraint for agent loops.

| Context | Persistence | DOM | Best For |
|---|---|---|---|
| Service Worker | Needs keepalive | No | Message routing only — keep thin |
| Offscreen Document | Permanent (until closed) | Yes | Background agent loops |
| Side Panel | Persistent while open | Yes | Interactive agent UI + inline loops |

**Recommendation:** Use the Side Panel as the agent UI (persistent across tab navigation). Use an Offscreen Document for tasks the user kicks off and walks away from. The service worker stays as a message router only.

---

## Tool-Calling Model Recommendations

Not all Ollama models support native tool calling. These do:

| Model | Size | Quality |
|---|---|---|
| `qwen2.5:7b` | 4.7GB | Best lightweight pick |
| `qwen3:8b` | 5.2GB | Excellent, newer |
| `llama3.1:8b` | 4.7GB | Good, widely tested |
| `llama3.2:3b` | 2.0GB | Smallest viable option |
| `mistral-nemo` | 7.1GB | Strong tool calling |
| `phi4-mini` | 2.5GB | Fast, decent quality |

Models that do **not** support native tool calling: `gemma3`, `llama2`, most older models. These require prompt-based tool parsing which is unreliable — avoid for agent mode.

---

## Reference Codebases to Study

**Nanobrowser** — [github.com/nanobrowser/nanobrowser](https://github.com/nanobrowser/nanobrowser)
12.3k stars, Apache 2.0. Chrome MV3 extension with LangChain.js agents, Ollama support, side panel UI, multi-agent PlannerAgent/NavigatorAgent pattern. The most architecturally equivalent open-source project.
→ Read: `chrome-extension/background/agent/planner.ts` and `navigator.ts`

**Page Assist** — [github.com/n4ze3m/page-assist](https://github.com/n4ze3m/page-assist)
7.6k stars, MIT. Mature Chrome/Firefox extension doing exactly Ollama chat + sidebar + RAG. Built with WXT framework and TypeScript.
→ Study for UX patterns, streaming implementation, model switching

**Lumos** — [github.com/andrewnguonly/Lumos](https://github.com/andrewnguonly/Lumos)
~1.5k stars. Chrome extension using LangChain.js + Ollama for RAG web browsing. Reference for LangChain.js bundling in a Chrome extension context.

---

## Implementation Order

1. **Start with #2** (custom ReAct loop in `server.js`) — 80 lines, zero new packages, ships today
2. **Add #1** (Vercel AI SDK in `chat.js`) — for the interactive inline agent experience in the chat UI
3. **Upgrade to #3** (BeeAI) — only when multi-agent, MCP tools, or token memory management becomes a real need
