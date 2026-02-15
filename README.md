# OllamaBro

![image](https://github.com/user-attachments/assets/58803a45-c3b4-4edf-8035-131f66751247)


OllamaBro is a Chrome extension that provides a convenient interface to interact with your local Ollama models. It allows you to quickly switch between models, manage multiple conversations, and chat directly from your browser.

## Features

- **Model Management**: View and switch between all your available Ollama models directly from the extension popup.
- **Multi-Conversation Chat**:
    - Chat with your models in a dedicated browser tab.
    - Keep multiple conversations organized per model.
    - A collapsible sidebar lists all your conversations for easy navigation.
- **Persistent History**: Your chat history is saved locally, so you can pick up where you left off.
- **Message Actions**: Easily copy messages or download conversations as `.txt` or `.md` files.
- **Modern UI**: A clean, dark-themed, and responsive user interface.
- **Real-time Responses**: See the model's response stream in as it's generated.
- **Usability**:
    - Auto-focus on the input field for a seamless chat experience.

## UX Improvements

We've implemented several professional UX patterns to make your chat experience smooth and polished:

### Smart Auto-Scrolling
The chat intelligently manages scrolling during streaming responses:
- **Auto-scroll to bottom** while the model is generating text (if you're already at the bottom)
- **Pause auto-scroll** when you manually scroll up to read previous messages
- **Resume auto-scroll** when you scroll back down to the bottom
- **Scroll-to-bottom button** appears when you've scrolled up during streaming
- Smooth scrolling animations for a polished feel

### Input Draft Persistence
Never lose your work-in-progress:
- **Auto-saves** what you type in the input field (debounced, saves 500ms after you stop typing)
- **Per-conversation drafts** - each conversation remembers its own unsent text
- **Automatic restore** when you switch back to a conversation
- **Draft cleared** when you send the message
- Perfect for when you need to check another conversation mid-thought

### Gap-Filling Loading State
No more flashing or jarring transitions:
- Shows "Waiting for response..." immediately when you send a message
- **Stays visible** during the initial delay before the first token arrives
- **Hides automatically** when the model starts responding
- Prevents the empty-content flash that happens with basic loading indicators

### Consistent Visual Design
- User messages aligned on the **left** (same side as AI responses) for natural reading flow
- User message bubbles use the **same accent color** as the Send button for visual consistency
- Clean, minimal design that keeps focus on the conversation

## Prerequisites

Before you begin, ensure you have the following installed:
- [Ollama](https://ollama.com/) running locally.
- [Node.js](https://nodejs.org/) (which includes npm).

## Setup and Installation

The extension consists of two main parts: a local proxy server to handle CORS requests to Ollama, and the Chrome extension itself.

### 1. The Proxy Server

The proxy server is necessary to bypass Cross-Origin Resource Sharing (CORS) restrictions when the extension communicates with the local Ollama API.

#### Manual Setup & Execution

1.  Navigate to the `proxy_server` directory:
    ```bash
    cd path/to/OllamaBro/proxy_server
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`. You need to keep this terminal window open while using the extension.

#### Automatic Startup with PM2 (Recommended)

To avoid having to manually start the server every time, you can use PM2, a process manager for Node.js applications.

1.  **Install PM2 globally**:
    ```bash
    npm install pm2 -g
    ```
2.  **Navigate to the proxy server directory**:
    ```bash
    cd path/to/OllamaBro/proxy_server
    ```
3.  **Start the server with PM2**:
    ```bash
    pm2 start server.js --name ollama-proxy
    ```
4.  **Enable PM2 to start on system boot**:
    ```bash
    pm2 startup
    ```
    This command will generate another command that you need to run. It may require administrator privileges.
5.  **Save the current process list**:
    ```bash
    pm2 save
    ```
    Now, the proxy server will automatically start whenever you restart your system.

You can manage the process with these commands:
- `pm2 list`: List all running processes.
- `pm2 logs ollama-proxy`: View logs for the proxy.
- `pm2 stop ollama-proxy`: Stop the proxy.
- `pm2 restart ollama-proxy`: Restart the proxy.
- `pm2 delete ollama-proxy`: Remove the proxy from PM2's list.

### 2. The Chrome Extension

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** using the toggle in the top-right corner.
3.  Click the **Load unpacked** button.
4.  Select the `chrome_extension` folder from the project directory.

The OllamaBro icon should now appear in your Chrome toolbar. Click it to see your available models and start chatting!
