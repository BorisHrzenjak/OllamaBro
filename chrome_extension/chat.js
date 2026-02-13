document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // Ensure loading indicator is hidden on initialization
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
const clearChatButton = document.getElementById('clearChatButton');
    const exportChatButton = document.getElementById('exportChatButton');
    const modelSwitcherButton = document.getElementById('modelSwitcherButton');
    const modelSwitcherDropdown = document.getElementById('modelSwitcherDropdown');
    const conversationSidebar = document.getElementById('conversationSidebar');
    const newChatButton = document.getElementById('newChatButton');
    const collapseSidebarButton = document.getElementById('collapseSidebarButton');
    const conversationList = document.getElementById('conversationList');
    
    // Image upload elements
    const imageButton = document.getElementById('imageButton');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    const dragDropOverlay = document.getElementById('dragDropOverlay');

    let currentModelName = '';
    const storageKeyPrefix = 'ollamaBroChat_';
    const sidebarStateKey = 'ollamaBroSidebarState';
    // Store available models as objects with name and size
    let availableModels = [];
    let currentAbortController = null; // Track current request for aborting
    let selectedImages = []; // Store selected images for sending

    // Helper function to create Lucide icons
    function createLucideIcon(iconName, size = 16) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        icon.style.width = size + 'px';
        icon.style.height = size + 'px';
        icon.style.stroke = 'currentColor';
        icon.style.fill = 'none';
        return icon;
    }

    function toggleImageUploadUI(show) {
        if (imageButton) {
            imageButton.style.display = show ? 'flex' : 'none';
        }
    }

    function updateModelDisplay(modelName) {
        // Clear previous content
        modelNameDisplay.innerHTML = '';
        
        // Create container for text
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = 'var(--spacing-xs)';
        
        // Add model name text
        const textSpan = document.createElement('span');
        textSpan.textContent = `Chatting with: ${decodeURIComponent(modelName)}`;
        container.appendChild(textSpan);
        
        // Add cloud icon for cloud models
        if (modelName.includes('.cloud')) {
            const cloudIcon = document.createElement('span');
            cloudIcon.classList.add('cloud-icon');
            cloudIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/></svg>';
            cloudIcon.title = 'Cloud model';
            cloudIcon.style.color = '#3b82f6'; // Blue color for cloud icon
            container.appendChild(cloudIcon);
        }
        
        modelNameDisplay.appendChild(container);
    }

    function getModelStorageKey(model) {
        const key = `${storageKeyPrefix}${model.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        console.log('[OllamaBro] getModelStorageKey - Model:', model, 'Generated Key:', key);
        return key;
    }

    async function loadModelChatState(modelToLoad) {
        console.log('[OllamaBro] loadModelChatState - Attempting to load for model:', modelToLoad);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return { conversations: {}, activeConversationId: null };
        }
        try {
            const key = getModelStorageKey(modelToLoad); // Key generation will also log
            const storageResult = await chrome.storage.local.get(key);
            console.log('[OllamaBro] loadModelChatState - Key used:', key, 'Data loaded from storage:', storageResult);

            let modelSpecificData = storageResult[key];

            if (modelSpecificData && typeof modelSpecificData === 'object') {
                // Data exists and is an object, proceed with checks
                // Ensure a deep copy for logging to avoid showing mutated object if it's referenced elsewhere
                try {
                    console.log(`Raw chat state loaded for ${modelToLoad}:`, JSON.parse(JSON.stringify(modelSpecificData)));
                } catch (e) {
                    console.warn(`[OllamaBro] loadModelChatState - Could not stringify modelSpecificData for logging for model ${modelToLoad}:`, modelSpecificData);
                }

                if (typeof modelSpecificData.conversations !== 'object' || modelSpecificData.conversations === null) {
                    console.warn(`[OllamaBro] loadModelChatState - 'conversations' property missing or not an object for model ${modelToLoad}. Initializing.`);
                    modelSpecificData.conversations = {};
                }
                if (typeof modelSpecificData.activeConversationId === 'undefined') {
                    console.warn(`[OllamaBro] loadModelChatState - 'activeConversationId' property missing for model ${modelToLoad}. Initializing to null.`);
                    modelSpecificData.activeConversationId = null;
                }
                return modelSpecificData;
            } else if (modelSpecificData) {
                // Data exists but is NOT an object (e.g., string, number, boolean due to corruption)
                console.warn(`[OllamaBro] loadModelChatState - Data for model ${modelToLoad} is not an object:`, modelSpecificData, ". Resetting to default structure.");
                return { conversations: {}, activeConversationId: null }; // Return default structure
            }
            // modelSpecificData is null or undefined (no data for this key)
            console.log(`[OllamaBro] loadModelChatState - No data found for ${modelToLoad}. Returning default structure.`);
            return { conversations: {}, activeConversationId: null }; // Default if nothing stored
        } catch (error) {
            console.error('Error loading chat state:', error);
            return { conversations: {}, activeConversationId: null };
        }
    }

    async function saveModelChatState(modelToSave, modelData) {
        console.log('[OllamaBro] saveModelChatState - Attempting to save for model:', modelToSave, 'Data:', modelData);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return;
        }
        try {
            const key = getModelStorageKey(modelToSave); // Key generation will also log
            await chrome.storage.local.set({ [key]: modelData });
            console.log('[OllamaBro] saveModelChatState - Key used:', key, 'Save successful.');
            console.log(`Chat state saved for ${modelToSave}`);
        } catch (error) {
            console.error('Error saving chat state:', error);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function getConversationSummary(messages) {
        if (!messages || messages.length === 0) return 'New Chat';
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        return firstUserMessage ? firstUserMessage.content.substring(0, 40) : 'Chat'; // Max 40 chars for summary
    }

    function getCurrentConversationMessages(modelData) {
        if (modelData && modelData.activeConversationId && modelData.conversations && modelData.conversations[modelData.activeConversationId]) {
            return modelData.conversations[modelData.activeConversationId].messages || [];
        }
        return [];
    }

    function generateFilename(extension, modelName, messages) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const summary = getConversationSummary(messages).replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30) || 'chat';
        const cleanModelName = modelName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        return `${summary}_${cleanModelName}_${timestamp}.${extension}`;
    }

    async function copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Copied!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                    buttonElement.disabled = false;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Error';
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                }, 1500);
            }
        }
    }

    function downloadMessage(text, filename, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function exportConversation() {
        const modelData = await loadModelChatState(currentModelName);
        const messages = getCurrentConversationMessages(modelData);
        
        if (messages.length === 0) {
            alert('No messages to export.');
            return;
        }
        
        const lines = [];
        lines.push(`# Conversation with ${decodeURIComponent(currentModelName)}`);
        lines.push(`Exported: ${new Date().toLocaleString()}`);
        lines.push('');
        
        messages.forEach(msg => {
            const sender = msg.role === 'user' ? '## You' : `## ${decodeURIComponent(currentModelName)}`;
            lines.push(sender);
            lines.push('');
            lines.push(msg.content);
            lines.push('');
        });
        
        const markdownContent = lines.join('\n');
        const filename = generateFilename('md', currentModelName, messages);
        downloadMessage(markdownContent, filename, 'text/markdown;charset=utf-8');
    }

    function renderMarkdownWithThinking(text, isStreaming = false) {
        if (typeof text !== 'string' || text === null) text = '';
        
        // Parse think blocks - Deepseek R1 uses <think> tags
        // Support variations: <think>, <think >, </think>, </think >
        const thinkRegex = /<\s*think[^>]*>([\s\S]*?)<\/\s*think\s*>/gi;
        let thinkBlocks = [];
        
        // First, extract all think blocks and replace with placeholders
        let processedText = text.replace(thinkRegex, (match, content) => {
            const index = thinkBlocks.length;
            thinkBlocks.push(content.trim());
            console.log(`[Thinking] Found think block #${index}, length: ${content.length}`);
            // Use a special span that won't be affected by markdown/DOMPurify
            return `<span class="thinking-placeholder" data-index="${index}"></span>`;
        });
        
        console.log(`[Thinking] Total think blocks found: ${thinkBlocks.length}`);
        
        // Render markdown on the text (now without think blocks)
        let htmlContent;
        if (typeof marked !== 'undefined') {
            htmlContent = marked.parse(processedText, {
                breaks: true,
                gfm: true
            });
        } else {
            htmlContent = processedText;
        }
        
        // Sanitize - but keep our thinking-placeholder spans
        if (typeof DOMPurify !== 'undefined') {
            htmlContent = DOMPurify.sanitize(htmlContent, {
                ADD_ATTR: ['data-index'],
                ADD_TAGS: ['span']
            });
        }
        
        const container = document.createElement('div');
        container.innerHTML = htmlContent;
        
        // Replace thinking placeholders with actual thinking boxes
        const placeholders = container.querySelectorAll('.thinking-placeholder');
        console.log(`[Thinking] Placeholders found in DOM: ${placeholders.length}`);
        
        placeholders.forEach(placeholder => {
            const index = parseInt(placeholder.getAttribute('data-index'));
            if (thinkBlocks[index]) {
                console.log(`[Thinking] Creating box for block #${index}`);
                const thinkingBox = createThinkingBoxElement(thinkBlocks[index], isStreaming);
                placeholder.replaceWith(thinkingBox);
            } else {
                console.warn(`[Thinking] No content for block #${index}`);
            }
        });
        
        // Add copy buttons to code blocks
        container.querySelectorAll('pre').forEach(pre => {
            pre.style.position = 'relative';
            const code = pre.querySelector('code');
            
            if (code) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-copy-button';
                copyBtn.textContent = 'Copy';
                copyBtn.addEventListener('click', async () => {
                    await navigator.clipboard.writeText(code.textContent);
                    copyBtn.textContent = 'Copied!';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                });
                pre.appendChild(copyBtn);
            }
        });
        
        // Apply syntax highlighting (skip thinking boxes)
        if (typeof hljs !== 'undefined') {
            container.querySelectorAll('pre code').forEach(block => {
                // Skip if inside thinking box
                if (!block.closest('.thinking-content')) {
                    hljs.highlightElement(block);
                }
            });
        }
        
        const fragment = document.createDocumentFragment();
        fragment.appendChild(container);
        return fragment;
    }
    
    function createThinkingBoxElement(content, isStreaming = false) {
        const container = document.createElement('div');
        container.className = 'thinking-container';
        
        const toggle = document.createElement('div');
        toggle.className = 'thinking-toggle';
        
        const brainIcon = createLucideIcon('brain', 16);
        brainIcon.className = 'thinking-icon';
        
        const indicator = document.createElement('span');
        indicator.className = 'thinking-indicator';
        indicator.textContent = isStreaming ? 'Thinking...' : 'Show thinking';
        
        const chevronIcon = createLucideIcon('chevron-right', 14);
        chevronIcon.className = 'thinking-chevron';
        
        toggle.appendChild(brainIcon);
        toggle.appendChild(indicator);
        toggle.appendChild(chevronIcon);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'thinking-content';
        
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = content;
        pre.appendChild(code);
        contentDiv.appendChild(pre);
        
        // Auto-expand if streaming
        if (isStreaming) {
            contentDiv.classList.add('expanded');
            toggle.classList.add('expanded');
        }
        
        toggle.addEventListener('click', () => {
            const isExpanded = contentDiv.classList.contains('expanded');
            contentDiv.classList.toggle('expanded');
            toggle.classList.toggle('expanded');
            indicator.textContent = isExpanded ? 'Show thinking' : 'Hide thinking';
        });
        
        container.appendChild(toggle);
        container.appendChild(contentDiv);
        
        return container;
    }

    // Image processing functions
    function validateImageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 20 * 1024 * 1024; // 20MB limit
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error(`Unsupported file type: ${file.type}. Supported types: JPEG, PNG, GIF, WebP`);
        }
        
        if (file.size > maxSize) {
            throw new Error(`File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum size: 20MB`);
        }
        
        return true;
    }

    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data:image/...;base64, prefix
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = URL.createObjectURL(file);
        });
    }

    async function processImageForUpload(file) {
        try {
            validateImageFile(file);
            
            // Compress if the file is large
            let processedFile = file;
            if (file.size > 2 * 1024 * 1024) { // Compress files larger than 2MB
                processedFile = await compressImage(file);
            }
            
            const base64 = await fileToBase64(processedFile);
            const previewUrl = URL.createObjectURL(processedFile);
            
            return {
                base64,
                previewUrl,
                fileName: file.name,
                fileSize: processedFile.size,
                fileType: file.type
            };
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        }
    }

    function addImageToPreview(imageData, index) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        previewDiv.dataset.index = index;
        
        const img = document.createElement('img');
        img.src = imageData.previewUrl;
        img.alt = imageData.fileName;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-image';
        removeButton.innerHTML = '×';
        removeButton.title = 'Remove image';
        removeButton.addEventListener('click', () => removeImageFromPreview(index));
        
        previewDiv.appendChild(img);
        previewDiv.appendChild(removeButton);
        imagePreviewArea.appendChild(previewDiv);
        
        updatePreviewAreaVisibility();
    }

    function removeImageFromPreview(index) {
        // Clean up the preview URL to prevent memory leaks
        if (selectedImages[index] && selectedImages[index].previewUrl) {
            URL.revokeObjectURL(selectedImages[index].previewUrl);
        }
        
        selectedImages.splice(index, 1);
        refreshImagePreview();
    }

    function refreshImagePreview() {
        imagePreviewArea.innerHTML = '';
        selectedImages.forEach((imageData, index) => {
            addImageToPreview(imageData, index);
        });
        updatePreviewAreaVisibility();
    }

    function updatePreviewAreaVisibility() {
        if (selectedImages.length > 0) {
            imagePreviewArea.style.display = 'flex';
        } else {
            imagePreviewArea.style.display = 'none';
        }
    }

    function clearSelectedImages() {
        // Clean up preview URLs
        selectedImages.forEach(imageData => {
            if (imageData.previewUrl) {
                URL.revokeObjectURL(imageData.previewUrl);
            }
        });
        selectedImages = [];
        imagePreviewArea.innerHTML = '';
        updatePreviewAreaVisibility();
    }

    async function handleImageFiles(files) {
        for (const file of files) {
            try {
                const imageData = await processImageForUpload(file);
                selectedImages.push(imageData);
                addImageToPreview(imageData, selectedImages.length - 1);
            } catch (error) {
                alert(`Error processing image "${file.name}": ${error.message}`);
            }
        }
    }

    function addMessageToChatUI(sender, initialText, messageClass, modelDataForFilename, images = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', messageClass);

        // Sender name (You or Model Name)
        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;
        messageDiv.appendChild(senderDiv);

        // Add images if present (for user messages)
        if (images && images.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.classList.add('message-images');
            images.forEach(imageData => {
                const img = document.createElement('img');
                img.src = `data:${imageData.fileType};base64,${imageData.base64}`;
                img.alt = imageData.fileName || 'Uploaded image';
                img.classList.add('message-image');
                imagesContainer.appendChild(img);
            });
            messageDiv.appendChild(imagesContainer);
        }

        // Message text content wrapper
        const textContentDiv = document.createElement('div');
        textContentDiv.classList.add('message-text-content'); 
        if (messageClass === 'bot-message') {
            const textToParse = (initialText === null || typeof initialText === 'undefined') ? '' : String(initialText);
            const fragment = renderMarkdownWithThinking(textToParse);
            textContentDiv.appendChild(fragment);
            textContentDiv.dataset.fullMessage = textToParse;
        } else {
            textContentDiv.textContent = initialText;
        }
        messageDiv.appendChild(textContentDiv);

        if (messageClass === 'bot-message') {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('message-actions');

            // Copy Button
            const copyButton = document.createElement('button');
            copyButton.classList.add('action-button', 'copy-button');
            copyButton.title = 'Copy to clipboard';
            copyButton.appendChild(createLucideIcon('copy', 16));

            copyButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent message click if any
                copyToClipboard(textContentDiv.textContent, copyButton);
            });
            actionsDiv.appendChild(copyButton);

            // Download TXT Button
            const downloadTxtButton = document.createElement('button');
            downloadTxtButton.classList.add('action-button', 'download-txt-button');
            downloadTxtButton.title = 'Download as .txt';
            downloadTxtButton.appendChild(createLucideIcon('file-down', 16));

            downloadTxtButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('txt', currentModelName, currentMessages);
                downloadMessage(textContentDiv.textContent, filename, 'text/plain;charset=utf-8');
            });
            actionsDiv.appendChild(downloadTxtButton);

            // Download MD Button
            const downloadMdButton = document.createElement('button');
            downloadMdButton.classList.add('action-button', 'download-md-button');
            downloadMdButton.title = 'Download as .md';
            downloadMdButton.appendChild(createLucideIcon('file-code', 16));

            downloadMdButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('md', currentModelName, currentMessages);
                // Basic MD: just the text. Could be enhanced to include sender.
                const mdContent = `## ${sender}\n\n${textContentDiv.textContent}`;
                downloadMessage(mdContent, filename, 'text/markdown;charset=utf-utf-8');
            });
            actionsDiv.appendChild(downloadMdButton);

            // Stop Button (only show during streaming)
            const stopButton = document.createElement('button');
            stopButton.classList.add('action-button', 'stop-button');
            stopButton.title = 'Stop generation';
            stopButton.style.display = 'none'; // Hidden by default
            stopButton.appendChild(createLucideIcon('square', 16));

            stopButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentAbortController) {
                    currentAbortController.abort();
                    stopButton.style.display = 'none';
                }
            });
            actionsDiv.appendChild(stopButton);

            // Store reference to stop button for later use
            messageDiv.stopButton = stopButton;

            messageDiv.appendChild(actionsDiv);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return textContentDiv; // Return the element where text is displayed for streaming
    }

    function updateBotMessageInUI(botTextElement, newContentChunk, isStreaming = false) {
        const previousRawFullText = botTextElement.dataset.fullMessage || '';
        const currentRawFullText = previousRawFullText + newContentChunk;
        
        // Debug: Log if we see think tags in the content
        if (newContentChunk.includes('<think') || newContentChunk.includes('</think>')) {
            console.log('[Thinking] Received chunk with think tag:', newContentChunk.substring(0, 100));
        }
        
        botTextElement.innerHTML = '';
        const fragment = renderMarkdownWithThinking(currentRawFullText, isStreaming);
        botTextElement.appendChild(fragment);
        
        botTextElement.dataset.fullMessage = currentRawFullText;

        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function displayConversationMessages(modelData, conversationId) {
        chatContainer.innerHTML = ''; // Clear current messages
        if (modelData.conversations[conversationId] && modelData.conversations[conversationId].messages) {
            modelData.conversations[conversationId].messages.forEach(msg => {
                addMessageToChatUI(
                    msg.role === 'user' ? 'You' : currentModelName, 
                    msg.content, 
                    msg.role === 'user' ? 'user-message' : 'bot-message', 
                    modelData,
                    msg.images // Pass images if present
                );
            });
        } else {
             addMessageToChatUI(currentModelName, `Hello! Start a new conversation with ${decodeURIComponent(currentModelName)}.`, 'bot-message', modelData);
        }
        
        // Initialize Lucide icons for dynamically created message action buttons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async function startNewConversation(modelForNewChat = currentModelName) {
        console.log(`Starting new conversation for model: ${modelForNewChat}`);
        let modelData = await loadModelChatState(modelForNewChat);
        const newConversationId = generateUUID();
        modelData.conversations[newConversationId] = {
            id: newConversationId,
            messages: [],
            summary: 'New Chat',
            lastMessageTime: Date.now()
        };
        modelData.activeConversationId = newConversationId;
        await saveModelChatState(modelForNewChat, modelData);
        displayConversationMessages(modelData, newConversationId);
        populateConversationSidebar(modelForNewChat, modelData);
        messageInput.focus();
        return newConversationId;
    }

    async function switchActiveConversation(modelToSwitch, newConversationId) {
        console.log(`Switching to conversation ${newConversationId} for model ${modelToSwitch}`);
        let modelData = await loadModelChatState(modelToSwitch);
        if (modelData.conversations[newConversationId]) {
            modelData.activeConversationId = newConversationId;
            await saveModelChatState(modelToSwitch, modelData);
            displayConversationMessages(modelData, newConversationId);
            populateConversationSidebar(modelToSwitch, modelData); // Refresh sidebar to highlight active
        } else {
            console.warn(`Conversation ${newConversationId} not found for model ${modelToSwitch}. Starting new one.`);
            await startNewConversation(modelToSwitch);
        }
        messageInput.focus();
    }

    async function handleDeleteConversation(modelOfConversation, conversationIdToDelete) {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        console.log(`Deleting conversation ${conversationIdToDelete} for model ${modelOfConversation}`);
        let modelData = await loadModelChatState(modelOfConversation);
        if (modelData.conversations[conversationIdToDelete]) {
            delete modelData.conversations[conversationIdToDelete];
            if (modelData.activeConversationId === conversationIdToDelete) {
                modelData.activeConversationId = null;
                const remainingConvIds = Object.keys(modelData.conversations);
                if (remainingConvIds.length > 0) {
                    // Switch to the most recent remaining conversation
                    const sortedRemaining = remainingConvIds.map(id => modelData.conversations[id])
                                                      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                    modelData.activeConversationId = sortedRemaining[0].id;
                    await saveModelChatState(modelOfConversation, modelData);
                    switchActiveConversation(modelOfConversation, modelData.activeConversationId);
                } else {
                    await saveModelChatState(modelOfConversation, modelData); // Save cleared activeId
                    await startNewConversation(modelOfConversation); // No convs left, start a new one
                }
            } else {
                await saveModelChatState(modelOfConversation, modelData);
                populateConversationSidebar(modelOfConversation, modelData); // Just refresh sidebar if deleted conv wasn't active
            }
        } else {
            console.warn(`Conversation ${conversationIdToDelete} not found for deletion.`);
        }
    }

    function populateConversationSidebar(modelForSidebar, modelData) {
        conversationList.innerHTML = ''; // Clear existing items
        if (!modelData || !modelData.conversations) return;

        const sortedConversations = Object.values(modelData.conversations)
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime); // Newest first

        sortedConversations.forEach(conv => {
            const item = document.createElement('div');
            item.classList.add('conversation-item');
            item.dataset.conversationId = conv.id;
            if (conv.id === modelData.activeConversationId) {
                item.classList.add('active');
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('conversation-item-title');
            titleSpan.textContent = conv.summary || 'Chat';
            titleSpan.title = conv.summary || 'Chat'; // Tooltip for full title

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-conversation-button');
            deleteButton.appendChild(createLucideIcon('trash-2', 14));
            deleteButton.title = 'Delete chat';
            deleteButton.dataset.conversationId = conv.id;

            item.appendChild(titleSpan);
            item.appendChild(deleteButton);
            conversationList.appendChild(item);

            item.addEventListener('click', (e) => {
                if (e.target === deleteButton || deleteButton.contains(e.target)) return; // Don't switch if delete is clicked
                switchActiveConversation(modelForSidebar, conv.id);
            });
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent item click event
                handleDeleteConversation(modelForSidebar, conv.id);
            });
        });
        
        // Initialize Lucide icons for dynamically created elements
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async function sendMessageToOllama(prompt) {
        if (!prompt || prompt.trim() === '') return;



        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            console.warn('No active or valid conversation found, attempting to start a new one.');
            await startNewConversation(currentModelName);
            modelData = await loadModelChatState(currentModelName);
            if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
                console.error('Failed to start or find an active conversation after attempting to create one.');
                addMessageToChatUI('System', 'Error: Could not establish an active conversation. Please try refreshing or creating a new chat manually.', 'error-message', modelData);
                return;
            }
        }
        const activeConvId = modelData.activeConversationId;
        const currentConversation = modelData.conversations[activeConvId];

        // Prepare user message with images if any
        const userMessage = { role: 'user', content: prompt };
        if (selectedImages.length > 0) {
            userMessage.images = selectedImages.map(img => ({
                base64: img.base64,
                fileName: img.fileName,
                fileType: img.fileType
            }));
        }

        // Add user message to UI and save state
        addMessageToChatUI('You', prompt, 'user-message', modelData, userMessage.images);
        currentConversation.messages.push(userMessage);
        currentConversation.summary = getConversationSummary(currentConversation.messages);
        currentConversation.lastMessageTime = Date.now();
        // Do not save yet, save after bot response or error

        messageInput.value = '';
        clearSelectedImages(); // Clear images after sending
        // Only show loading indicator when actually sending a request
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        messageInput.disabled = true;
        sendButton.disabled = true;

        const botTextElement = addMessageToChatUI(currentModelName, '', 'bot-message', modelData);
        const botMessageDiv = botTextElement.parentElement;
        const stopButton = botMessageDiv.stopButton;

        // Create AbortController for this request
        currentAbortController = new AbortController();
        
        // Show stop button during streaming
        if (stopButton) {
            stopButton.style.display = 'flex';
        }

        try {
            console.log(`Sending to /proxy/api/chat with model: ${currentModelName} for streaming.`);
            
            // Prepare messages for API - convert image data for Ollama format
            const apiMessages = currentConversation.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(message => {
                    const apiMessage = {
                        role: message.role,
                        content: message.content
                    };
                    
                    // Add images if present (only for user messages)
                    if (message.role === 'user' && message.images && message.images.length > 0) {
                        apiMessage.images = message.images.map(img => img.base64);
                    }
                    
                    return apiMessage;
                });

            const requestBody = {
                model: currentModelName,
                messages: apiMessages,
                stream: true
            };

            console.log('Request body for Ollama:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('http://localhost:3000/proxy/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: currentAbortController.signal // Add abort signal
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to get error text from non-OK response.');
                console.error('Ollama API Error (stream):', response.status, errorText);
                throw new Error(`Ollama API Error: ${response.status} ${errorText || response.statusText}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not available in response body.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            console.log('Starting to read stream...');
            let accumulatedThinking = '';
            let accumulatedContent = '';
            let hasThinking = false;
            
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    console.log('Raw chunk from stream:', chunk); // Log raw chunk
                    const jsonResponses = chunk.split('\n').filter(Boolean);
                    jsonResponses.forEach(jsonStr => {
                        console.log('Processing JSON string:', jsonStr); // Log JSON string before parsing
                        try {
                            const jsonResponse = JSON.parse(jsonStr);
                            console.log('Parsed JSON response:', jsonResponse); // Log parsed object

                            // Handle thinking content (Deepseek R1 style)
                            if (jsonResponse.message && typeof jsonResponse.message.thinking === 'string') {
                                accumulatedThinking += jsonResponse.message.thinking;
                                hasThinking = true;
                                console.log('Accumulated thinking:', accumulatedThinking.substring(0, 100) + '...');
                            }
                            
                            // Handle regular content
                            if (jsonResponse.message && typeof jsonResponse.message.content === 'string') {
                                accumulatedContent += jsonResponse.message.content;
                                console.log('Accumulated content:', accumulatedContent.substring(0, 100) + '...');
                            }
                            
                            // Update UI with combined content
                            if (jsonResponse.message && (typeof jsonResponse.message.content === 'string' || typeof jsonResponse.message.thinking === 'string')) {
                                // Combine thinking and content with think tags for display
                                let displayText = '';
                                if (hasThinking && accumulatedThinking) {
                                    displayText += `<think>\n${accumulatedThinking}\n</think>\n\n`;
                                }
                                displayText += accumulatedContent;
                                
                                botTextElement.innerHTML = '';
                                // Pass true for isStreaming to auto-expand the thinking box
                                const fragment = renderMarkdownWithThinking(displayText, true);
                                botTextElement.appendChild(fragment);
                                botTextElement.dataset.fullMessage = displayText;
                                
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                            } else {
                                console.log('jsonResponse.message.content/thinking is missing or not a string.');
                                // It's possible for 'done' messages to have no content, which is fine.
                                if (!jsonResponse.done) {
                                     console.warn('Received a non-done chunk without message content.');
                                }
                            }

                            if (jsonResponse.done) {
                                console.log('Stream finished by Ollama (jsonResponse.done is true)');
                                done = true;
                                // Hide stop button when streaming is complete
                                if (stopButton) {
                                    stopButton.style.display = 'none';
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse JSON chunk from stream:', jsonStr, e);
                        }
                    });
                }
            }
            console.log('Stream reading complete.');

            // Build final message with thinking if present
            let finalBotMessageToSave = '';
            if (hasThinking && accumulatedThinking) {
                finalBotMessageToSave = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
            } else {
                finalBotMessageToSave = accumulatedContent;
            }
            
            // Update the dataset to ensure consistency
            botTextElement.dataset.fullMessage = finalBotMessageToSave;
            currentConversation.messages.push({ role: 'assistant', content: finalBotMessageToSave });
            currentConversation.summary = getConversationSummary(currentConversation.messages);
            currentConversation.lastMessageTime = Date.now();

        } catch (error) {
            console.error('Error sending message to Ollama or processing stream:', error);
            let errorMessage = 'Error communicating with the model. Please check the proxy server and Ollama status.';
            
            // Handle AbortError specifically
            if (error.name === 'AbortError') {
                errorMessage = 'Request was stopped by user.';
                console.log('Request aborted by user');
            } else if (error.message && error.message.includes('Ollama API Error')) {
                errorMessage = error.message;
                
                // Handle vision model specific errors
                if (selectedImages.length > 0 && (
                    error.message.includes('exit status 2') || 
                    error.message.includes('runner process has terminated') ||
                    error.message.includes('500')
                )) {
                    errorMessage = `This model (${currentModelName}) may not support images. Try a vision model like LLaVA instead.`;
                    console.warn(`[Vision Error] Model ${currentModelName} failed with images:`, error.message);
                }
            }
            
            updateBotMessageInUI(botTextElement, `\n\n[Error: ${errorMessage}]`);
            // Get the current content from the botTextElement to avoid using undefined variables
            const currentBotContent = botTextElement.dataset.fullMessage || botTextElement.textContent || '';
            currentConversation.messages.push({ role: 'assistant', content: currentBotContent + `\n\n[Error: ${errorMessage}]` }); 
            currentConversation.lastMessageTime = Date.now();
        } finally {
            console.log('sendMessageToOllama finally block completed');
            
            // Hide stop button and clear abort controller
            if (stopButton) {
                stopButton.style.display = 'none';
            }
            currentAbortController = null;
            
            // Always hide the loading indicator when done, with null check
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
            
            await saveModelChatState(currentModelName, modelData);
            populateConversationSidebar(currentModelName, modelData); 
            console.log('UI unlocked, state saved, sidebar repopulated in finally block.');
        }
    }


    async function clearAllConversationsForModel(modelToClear) {
        if (!confirm(`Are you sure you want to clear ALL chat history for ${decodeURIComponent(modelToClear)}? This action cannot be undone.`)) {
            return;
        }
        console.log(`Clearing all conversations for model: ${modelToClear}`);
        let modelData = { conversations: {}, activeConversationId: null };
        await saveModelChatState(modelToClear, modelData);
        await startNewConversation(modelToClear); // This will also update UI and sidebar
    }

    async function switchModel(newModelName) {
        const oldModelName = currentModelName;
        if (newModelName === oldModelName) return;
        console.log('[OllamaBro] switchModel - Switching from:', oldModelName, 'to:', newModelName);
        console.log(`Switching model to: ${newModelName}`);
        currentModelName = newModelName;
        updateModelDisplay(currentModelName);
        
        // Clear any selected images when switching models
        clearSelectedImages();
        
        // Show image upload UI (users can upload images to any model, API will error if unsupported)
        toggleImageUploadUI(true);
        
        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName); // Start new if no active or no convs
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    async function fetchAvailableModels() {
        if (availableModels.length > 0) return availableModels;
        const proxyUrl = 'http://localhost:3000/proxy/api/tags';
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                console.error('Failed to fetch models:', response.status, await response.text());
                return [];
            }
            const data = await response.json();
            // Store full model objects with name and size
            availableModels = data.models ? data.models : [];
            
            return availableModels;
        } catch (error) {
            console.error('Error fetching available models:', error);
            return [];
        }
    }

    function populateModelDropdown(models, currentModel) {
        modelSwitcherDropdown.innerHTML = ''; // Clear previous items
        const ul = document.createElement('ul');

        if (models.length === 0) {
            const noModelsItem = document.createElement('li');
            noModelsItem.textContent = 'No models found.';
            noModelsItem.classList.add('model-dropdown-item', 'no-models');
            ul.appendChild(noModelsItem);
            modelSwitcherDropdown.appendChild(ul);
            return;
        }

        models.forEach(model => {
            const modelName = model.name || model; // Support both object and string format
            const modelSize = model.size;
            
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            
            // Create model name container
            const modelNameContainer = document.createElement('div');
            modelNameContainer.style.display = 'flex';
            modelNameContainer.style.alignItems = 'center';
            modelNameContainer.style.justifyContent = 'space-between';
            modelNameContainer.style.width = '100%';
            
            // Left side: model name
            const modelNameSpan = document.createElement('span');
            modelNameSpan.textContent = modelName;
            modelNameContainer.appendChild(modelNameSpan);
            
            // Right side: cloud icon and size
            const detailsContainer = document.createElement('div');
            detailsContainer.style.display = 'flex';
            detailsContainer.style.alignItems = 'center';
            detailsContainer.style.gap = '8px';
            
            // Add cloud icon for cloud models
            if (modelName.includes('.cloud')) {
                const cloudIcon = document.createElement('span');
                cloudIcon.classList.add('cloud-icon');
                cloudIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/></svg>';
                cloudIcon.title = 'Cloud model';
                cloudIcon.style.color = '#3b82f6';
                detailsContainer.appendChild(cloudIcon);
            }
            
            // Add size display
            if (modelSize) {
                const sizeSpan = document.createElement('span');
                sizeSpan.classList.add('model-size');
                const sizeGB = (modelSize / (1024 * 1024 * 1024)).toFixed(2);
                sizeSpan.textContent = `${sizeGB} GB`;
                sizeSpan.style.color = 'var(--text-muted)';
                sizeSpan.style.fontSize = '0.9em';
                detailsContainer.appendChild(sizeSpan);
            }
            
            if (detailsContainer.children.length > 0) {
                modelNameContainer.appendChild(detailsContainer);
            }
            
            a.appendChild(modelNameContainer);
            a.dataset.modelName = modelName;
            
            li.classList.add('model-dropdown-item');
            if (modelName === currentModel) {
                li.classList.add('active-model');
            }

            a.addEventListener('click', async (e) => {
                e.preventDefault();
                if (modelName !== currentModelName) {
                    await switchModel(modelName);
                }
                modelSwitcherDropdown.style.display = 'none';
                const allItems = ul.querySelectorAll('li.model-dropdown-item');
                allItems.forEach(item => item.classList.remove('active-model'));
                li.classList.add('active-model');
            });
            li.appendChild(a);
            ul.appendChild(li);
        });
        modelSwitcherDropdown.appendChild(ul);
    }

    async function init() {
        const urlModel = new URLSearchParams(window.location.search).get('model');
        if (!urlModel) {
            modelNameDisplay.textContent = 'Error: Model name not specified.';
            addMessageToChatUI('System', 'No model specified. Select a model.', 'bot-message');
            messageInput.disabled = true; sendButton.disabled = true;
            return;
        }
        currentModelName = urlModel;
        console.log('[OllamaBro] init - Initializing chat for model from URL:', currentModelName);
        updateModelDisplay(currentModelName);

        // Show image upload UI (users can upload images to any model, API will error if unsupported)
        toggleImageUploadUI(true);

        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName);
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();

        // Sidebar collapse/expand persistence
        const savedSidebarState = await chrome.storage.local.get(sidebarStateKey);
        if (savedSidebarState && savedSidebarState[sidebarStateKey] === 'collapsed') {
            conversationSidebar.classList.add('collapsed');
            collapseSidebarButton.innerHTML = '&#x2192;'; // Right arrow
        } else {
            conversationSidebar.classList.remove('collapsed');
            collapseSidebarButton.innerHTML = '&#x2190;'; // Left arrow
        }
    }

    // Event Listeners
    sendButton.addEventListener('click', () => sendMessageToOllama(messageInput.value));
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageToOllama(messageInput.value); });
    
    clearChatButton.addEventListener('click', () => clearAllConversationsForModel(currentModelName));
    exportChatButton.addEventListener('click', exportConversation);
    
    newChatButton.addEventListener('click', () => startNewConversation(currentModelName));

    // Image upload event listeners
    if (imageButton && imageInput) {
        imageButton.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleImageFiles(Array.from(e.target.files));
                e.target.value = ''; // Clear the input so the same file can be selected again
            }
        });
    }

    // Drag and drop functionality
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragDropOverlay.classList.add('active');
    });

    document.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
            dragDropOverlay.classList.remove('active');
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropOverlay.classList.remove('active');
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const imageFiles = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            if (imageFiles.length > 0) {
                handleImageFiles(imageFiles);
            }
        }
    });

    modelSwitcherButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (modelSwitcherDropdown.style.display === 'block') {
            modelSwitcherDropdown.style.display = 'none';
        } else {
            const models = await fetchAvailableModels();
            populateModelDropdown(models, currentModelName);
            modelSwitcherDropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!modelSwitcherButton.contains(e.target) && !modelSwitcherDropdown.contains(e.target)) {
            modelSwitcherDropdown.style.display = 'none';
        }
    });

    collapseSidebarButton.addEventListener('click', async () => {
        conversationSidebar.classList.toggle('collapsed');
        const isCollapsed = conversationSidebar.classList.contains('collapsed');
        collapseSidebarButton.innerHTML = isCollapsed ? '&#x2192;' : '&#x2190;'; // Right/Left arrow
        await chrome.storage.local.set({ [sidebarStateKey]: isCollapsed ? 'collapsed' : 'expanded' });
    });

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') messageInput.focus(); });

    init();

});
