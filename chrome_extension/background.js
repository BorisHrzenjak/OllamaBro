
// Listen for messages from other parts of the extension (e.g., popup.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "openChatTab" && message.modelName) {
        const chatPageUrl = chrome.runtime.getURL('chat.html');
        const urlWithModel = `${chatPageUrl}?model=${encodeURIComponent(message.modelName)}`;

        // Open chat.html in a new tab
        chrome.tabs.create({ url: urlWithModel }, (tab) => {
            if (chrome.runtime.lastError) {
                console.error('Error creating tab:', chrome.runtime.lastError.message);
                sendResponse({ status: "error", message: chrome.runtime.lastError.message });
            } else {
                console.log(`Opened chat tab for model ${message.modelName}: ${tab.id}`);
                sendResponse({ status: "success", tabId: tab.id });
            }
        });

        // Return true to indicate that sendResponse will be called asynchronously
        return true;
    } else if (message.action === "getTabModel") {
        // This part is for chat.js to get its model if needed,
        // though chat.js will primarily get it from URL params.
        // This is more of a fallback or alternative.
        if (sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                const modelName = url.searchParams.get("model");
                if (modelName) {
                    sendResponse({ status: "success", modelName: modelName });
                } else {
                    sendResponse({ status: "error", message: "Model name not found in tab URL." });
                }
            } catch (e) {
                console.error("Error parsing tab URL in background:", e);
                sendResponse({ status: "error", message: "Could not parse tab URL." });
            }
        } else {
            sendResponse({ status: "error", message: "No sender tab information." });
        }
        return true; // For async response
    }
    // Proxy server management via Native Messaging
    if (message.action === 'proxyControl') {
        const NM_HOST = 'com.ollamabro.proxy';
        chrome.runtime.sendNativeMessage(
            NM_HOST,
            { action: message.command || 'start' },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Native messaging error:', chrome.runtime.lastError.message);
                    sendResponse({
                        status: 'error',
                        error: chrome.runtime.lastError.message,
                        needsSetup: true
                    });
                } else {
                    console.log('Native messaging response:', response);
                    sendResponse(response || { status: 'no_response' });
                }
            }
        );
        return true;
    }
});

// Optional: Log when the extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install") {
        console.log("OllamaBro extension installed.");
    } else if (details.reason === "update") {
        const previousVersion = details.previousVersion;
        const newVersion = chrome.runtime.getManifest().version;
        console.log(`OllamaBro extension updated from ${previousVersion} to ${newVersion}.`);
    }
});

console.log("OllamaBro background script loaded.");