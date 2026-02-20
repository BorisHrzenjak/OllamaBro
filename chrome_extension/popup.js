
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
    const statusPill = document.getElementById('statusPill');
    const statusLabel = document.getElementById('statusLabel');
    const proxyUrl = 'http://localhost:3000/proxy/api/tags';

    function setStatus(state, label) {
        if (!statusPill || !statusLabel) return;
        statusPill.className = 'status-pill ' + state;
        statusLabel.textContent = label;
    }

    async function fetchAndDisplayModels() {
        loadingMessageElement.style.display = 'block';
        errorMessageElement.style.display = 'none';
        modelListElement.innerHTML = '';
        setStatus('loading', 'loading');

        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                let errorMsg = `Error fetching models: ${response.status} ${response.statusText}`;
                try {
                    const errorBody = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorBody);
                    } catch (e) {
                        errorMsg += ` - Server response: ${errorBody.substring(0, 200)}`;
                        throw new Error(errorMsg);
                    }
                    if (errorData && errorData.error) {
                        errorMsg += ` - ${errorData.error}`;
                    } else if (typeof errorData === 'string') {
                        errorMsg += ` - ${errorData}`;
                    }
                } catch (e) {
                    if (!errorMsg.includes(e.message)) errorMsg = e.message.startsWith('Error fetching models:') ? e.message : errorMsg + " " + e.message;
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data && data.models && data.models.length > 0) {
                const count = data.models.length;
                setStatus('ready', count + (count === 1 ? ' model' : ' models'));

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
                        chrome.runtime.sendMessage({
                            action: "openChatTab",
                            modelName: model.name
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error('Error sending message to background:', chrome.runtime.lastError.message);
                                displayError('Could not open chat tab. ' + chrome.runtime.lastError.message);
                            } else if (response && response.status === "success") {
                                console.log('Chat tab opened for model:', model.name);
                                window.close();
                            } else {
                                console.error('Failed to open chat tab, background script response:', response);
                                displayError('Failed to open chat tab. Check background script logs.');
                            }
                        });
                    });
                    modelListElement.appendChild(listItem);
                });

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            } else {
                setStatus('error-state', 'no models');
                displayError('No models found. Ensure Ollama is running and has models installed.');
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            setStatus('error-state', 'offline');
            const errorMessageString = error.message || "An unknown error occurred.";
            displayError(`Failed to load models. <br><small>Is the proxy server (port 3000) and Ollama running? <br>Details: ${errorMessageString}</small>`);
        } finally {
            loadingMessageElement.style.display = 'none';
        }
    }

    function displayError(message) {
        errorMessageElement.innerHTML = message;
        errorMessageElement.style.display = 'block';
        loadingMessageElement.style.display = 'none';
    }

    fetchAndDisplayModels();
});
