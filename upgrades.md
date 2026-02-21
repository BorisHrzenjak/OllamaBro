# Feature Proposals for OllamaBro

## High Impact / Quick Wins

**1. Message Editing + Regeneration** (IMPLEMENTED)
Allow editing any past user message to "branch" the conversation from that point, discarding everything after. Also add a "Regenerate" button on the last AI response. The abort controller infrastructure is already there.

**2. Prompt History Navigation** (IMPLEMENTED)
Press `↑`/`↓` in the input box to cycle through previously sent messages, like a terminal. Already have draft persistence — prompt history is a natural extension.

**3. Auto-naming Conversations**
After the first exchange, silently ask the model (short, non-streaming call) to generate a 4-6 word title for the conversation. Replace "New Conversation" in the sidebar. Could also do heuristic naming from the first user message.

**4. Context Menu Integration**
Add a Chrome context menu item: **"Ask OllamaBro about this"** — right-clicking selected text on any webpage opens the chat with that text pre-quoted as context. Uses `chrome.contextMenus` API.

**5. Summarize Current Tab**
A button (or context menu option) that injects the current page's `document.body.innerText` as context and asks the model to summarize it. Very powerful for local privacy-preserving summarization.

---

## Model Management

**6. Model Parameter Controls**
Expose `temperature`, `top_p`, `top_k`, `seed`, `repeat_penalty`, and `num_predict` sliders/inputs in the settings modal per-conversation. The proxy already forwards to Ollama — just need to pass these in the request body.

**7. Persona / System Prompt Presets** (IMPLEMENTED)
Save named system prompts (e.g., "Code Reviewer", "Translator", "ELI5") as presets. One-click to apply. Stored in `chrome.storage.local`.

**8. Model Comparison Mode**
Send the same message to 2+ models simultaneously and display responses side-by-side. Great for evaluating local models. Would open multiple streaming connections in parallel.

**9. Ollama Model Manager**
A panel showing locally installed models (`/api/tags`) with size, and a pull interface (`/api/pull`) to download new ones — with a progress stream. Lets users manage Ollama without touching the terminal.

---

## Conversation Organization

**10. Conversation Search**
A search bar in the sidebar that filters conversations by title or searches through message content stored in `chrome.storage.local`. Already have the data structure — needs a search UI.

**11. Conversation Pinning & Tagging**
Pin important conversations to the top of the sidebar. Optionally add color tags or emoji labels to organize chats by topic.

**12. Export Formats**
Extend exports to: **Markdown** (with code blocks preserved), **JSON** (full structure with metadata), and a clean **plain text** transcript. Add a "Copy as Markdown" button per message.

---

## Input Experience

**13. Slash Command Prompts**
Type `/` in the input to get a popup of saved prompt templates. e.g., `/translate`, `/summarize`, `/fix-code`. Saves common workflows.

**14. Clipboard Context Button**
A small button (or keyboard shortcut) that pastes clipboard content wrapped in a context block — useful for quickly asking about code snippets or error messages.

**15. Token Counter While Typing**
Show an estimated token count below the input box as the user types (using a rough `chars/4` approximation or a lightweight tokenizer). Helps manage context awareness proactively.

---

## Notification & Background

**16. Background Processing + Notifications** 
Send a message, close the tab, and get a Chrome notification when the response completes. Uses `chrome.notifications` API and the service worker in `background.js`. Big UX win for slow local models.

**17. Server Status Indicator**
A persistent indicator showing whether the proxy server and Ollama are reachable (green/yellow/red dot in the header). Polls `/api/tags` periodically. Reduces confusion when things break silently.

---

## Accessibility & Polish

**18. Keyboard Shortcuts Panel** (IMPLEMENTED)
A `?` button or `Shift+?` shortcut showing all available keyboard shortcuts. Also add shortcuts for: `Ctrl+N` (new chat), `Ctrl+K` (search conversations), `Ctrl+Enter` (send), `Esc` (abort generation).

**19. Theme System**
Add a light mode and 1-2 accent color options in settings. The CSS already uses custom properties (`--bg-primary`, `--accent`, etc.), making this straightforward to implement.

**20. Font Size Preference**
A small A-/A+ control in settings. Saves to `chrome.storage.local`. Applies via a CSS custom property override on `--font-size-md`.

---

## Most Impactful to Implement First

| Priority | Feature | Effort |
|---|---|---|
| 1 | Message editing + regeneration | Medium |
| 2 | Context menu / page summarize | Low |
| 3 | Auto-naming conversations | Low |
| 4 | Model parameter controls | Low |
| 5 | Background processing + notifications | Medium |
| 6 | Server status indicator | Low |
