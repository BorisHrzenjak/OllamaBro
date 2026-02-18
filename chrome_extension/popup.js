
// Apply saved theme immediately so popup matches the chat window
chrome.storage.local.get(['activeTheme'], (result) => {
    const themeId = result.activeTheme || 'default-dark';
    if (themeId !== 'default-dark') {
        document.documentElement.setAttribute('data-theme', themeId);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const modelListElement = document.getElementById('modelList');
    const loadingMessageElement = document.getElementById('loadingMessage');
    const errorMessageElement = document.getElementById('errorMessage');
    const proxyUrl = 'http://localhost:3000/proxy/api/tags';

    async function fetchAndDisplayModels() {
        loadingMessageElement.style.display = 'block';
        errorMessageElement.style.display = 'none';
        modelListElement.innerHTML = ''; // Clear previous list

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                let errorMsg = `Error fetching models: ${response.status} ${response.statusText}`;
                try {
                    // Try to get more specific error from proxy/Ollama
                    const errorBody = await response.text(); // Use text() first to avoid JSON parse error if not JSON
                    let errorData;
                    try {
                        errorData = JSON.parse(errorBody);
                    } catch (e) {
                        // If not JSON, use the raw text if it's not too long
                        errorMsg += ` - Server response: ${errorBody.substring(0, 200)}`; 
                        throw new Error(errorMsg);
                    }
                    if (errorData && errorData.error) { // Ollama's error format
                        errorMsg += ` - ${errorData.error}`;
                    } else if (typeof errorData === 'string') { // Simple string error from proxy
                         errorMsg += ` - ${errorData}`;
                    }
                } catch (e) {
                    // If parsing error response fails, stick with the original errorMsg or add to it
                    if (!errorMsg.includes(e.message)) errorMsg = e.message.startsWith('Error fetching models:') ? e.message : errorMsg + " " + e.message;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data && data.models && data.models.length > 0) {
                data.models.forEach(model => {
                    const listItem = document.createElement('li');
                    listItem.className = 'model-item';
                    
                    const modelInfoDiv = document.createElement('div');
                    modelInfoDiv.className = 'model-info';
                    
                    const modelNameSpan = document.createElement('span');
                    modelNameSpan.className = 'model-name';
                    modelNameSpan.textContent = model.name;
                    
                    const modelSizeSpan = document.createElement('span');
                    modelSizeSpan.className = 'model-size';
                    // Convert bytes to GB and format
                    const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(2);
                    modelSizeSpan.textContent = `${sizeGB} GB`;

                    modelInfoDiv.appendChild(modelNameSpan);
                    modelInfoDiv.appendChild(modelSizeSpan);
                    
                    const arrowIcon = document.createElement('i');
                    arrowIcon.setAttribute('data-lucide', 'chevron-right');
                    arrowIcon.className = 'model-arrow';
                    
                    listItem.appendChild(modelInfoDiv);
                    listItem.appendChild(arrowIcon);
                    
                    listItem.addEventListener('click', () => {
                        // Send message to background script to open chat tab
                        chrome.runtime.sendMessage({
                            action: "openChatTab",
                            modelName: model.name
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('Error sending message to background:', chrome.runtime.lastError.message);
                                displayError('Could not open chat tab. ' + chrome.runtime.lastError.message);
                            } else if (response && response.status === "success") {
                                console.log('Chat tab opened for model:', model.name);
                                window.close(); // Close popup after selection
                            } else {
                                console.error('Failed to open chat tab, background script response:', response);
                                displayError('Failed to open chat tab. Check background script logs.');
                            }
                        });
                    });
                    modelListElement.appendChild(listItem);
                });
                
                // Initialize Lucide icons after creating all model items
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } else {
                displayError('No models found. Ensure Ollama is running and has models installed.');
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            // Ensure error.message is a string before using .includes
            const errorMessageString = error.message || "An unknown error occurred.";
            displayError(`Failed to load models. <br><small>Is the proxy server (port 3000) and Ollama running? <br>Details: ${errorMessageString}</small>`);
        } finally {
            loadingMessageElement.style.display = 'none';
        }
    }

    function displayError(message) {
        errorMessageElement.innerHTML = message; // Use innerHTML to render <br>
        errorMessageElement.style.display = 'block';
        loadingMessageElement.style.display = 'none';
    }

    // Fetch models when the popup is opened
    fetchAndDisplayModels();
});