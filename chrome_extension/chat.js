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

    // Settings modal elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalButton = document.getElementById('closeSettingsModal');
    const systemPromptInput = document.getElementById('systemPromptInput');
    const saveSystemPromptButton = document.getElementById('saveSystemPromptButton');
    const clearSystemPromptButton = document.getElementById('clearSystemPromptButton');
    const systemPromptTokenCount = document.getElementById('systemPromptTokenCount');
    const contextLimitInput = document.getElementById('contextLimitInput');
    const contextLimitInfo = document.getElementById('contextLimitInfo');

    // Clear context modal elements
    const clearContextModal = document.getElementById('clearContextModal');

    // Keyboard shortcuts modal elements
    const shortcutsModal = document.getElementById('shortcutsModal');
    const closeShortcutsModalButton = document.getElementById('closeShortcutsModal');
    const closeClearContextModalButton = document.getElementById('closeClearContextModal');
    const cancelClearContextButton = document.getElementById('cancelClearContextButton');
    const confirmClearContextButton = document.getElementById('confirmClearContextButton');

    // Context indicator elements
    const contextIndicator = document.getElementById('contextIndicator');
    const contextIndicatorText = document.getElementById('contextIndicatorText');

    // Image upload elements
    const imageButton = document.getElementById('imageButton');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    const dragDropOverlay = document.getElementById('dragDropOverlay');
    const micButton = document.getElementById('micButton');

    // Speech Recognition Setup
    let recognition = null;
    let isListening = false;

    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isListening = true;
            micButton.classList.add('listening');
            micButton.innerHTML = createLucideIcon('mic-off', 20).outerHTML;
            micButton.title = "Stop Recording";
        };

        recognition.onend = () => {
            isListening = false;
            micButton.classList.remove('listening');
            micButton.innerHTML = createLucideIcon('mic', 20).outerHTML;
            micButton.title = "Voice Input";
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append final transcript to input
            if (finalTranscript) {
                // Add space if input is not empty and doesn't end with whitespace
                if (messageInput.value && !/\s$/.test(messageInput.value)) {
                    messageInput.value += ' ';
                }
                messageInput.value += finalTranscript;
                // Trigger input event to resize textarea if needed
                messageInput.dispatchEvent(new Event('input'));
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone access to use dictation.');
            }
            // Stop if error occurs
            if (isListening) {
                recognition.stop();
            }
        };

        // Toggle recording on click
        micButton.addEventListener('click', () => {
            if (isListening) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        // Hide button if speech recognition is not supported
        if (micButton) {
            micButton.style.display = 'none';
            console.warn('Web Speech API not supported in this browser.');
        }
    }

    let currentModelName = '';
    const storageKeyPrefix = 'ollamaBroChat_';
    const sidebarStateKey = 'ollamaBroSidebarState';
    const draftsKey = 'ollamaBroDrafts';
    const personaPresetsKey = 'ollamaBroPersonaPresets';

    let activePersonaName = '';

    const DEFAULT_PRESETS = [
        {
            id: 'default-code-reviewer',
            name: 'Code Reviewer',
            prompt: 'You are an expert code reviewer. Analyze code for bugs, performance issues, security vulnerabilities, and style violations. Provide clear, actionable feedback with specific suggestions for improvement.'
        },
        {
            id: 'default-translator',
            name: 'Translator',
            prompt: 'You are a professional translator. Translate text accurately while preserving tone, nuance, and cultural context. If the target language is not specified, ask before translating.'
        },
        {
            id: 'default-tutor',
            name: 'Tutor',
            prompt: 'You are a patient and encouraging tutor. Explain concepts clearly using simple language and relatable examples. Break down complex topics step by step. Ask clarifying questions to tailor explanations to the student\'s level.'
        },
        {
            id: 'default-storyteller',
            name: 'Storyteller',
            prompt: 'You are a creative storyteller. Craft vivid, engaging narratives with compelling characters and immersive descriptions. Adapt your style and tone to match the genre and mood requested.'
        }
    ];
    // Store available models as objects with name and size
    let availableModels = [];
    let currentAbortController = null; // Track current request for aborting
    let selectedImages = []; // Store selected images for sending

    // Context management constants
    const DEFAULT_CONTEXT_LIMIT = 4096;   // 4K — local models
    const CLOUD_CONTEXT_LIMIT = 131072;   // 128K — cloud models
    const WARNING_THRESHOLD = 0.75; // 75% - yellow
    const CRITICAL_THRESHOLD = 0.90; // 90% - red

    // Smart scrolling state
    let isUserScrolledUp = false;
    let scrollThreshold = 100; // pixels from bottom to consider "at bottom"
    let isStreaming = false;

    // Smart scroll functions
    function isNearBottom() {
        const scrollPosition = chatContainer.scrollTop + chatContainer.clientHeight;
        const scrollHeight = chatContainer.scrollHeight;
        return scrollHeight - scrollPosition <= scrollThreshold;
    }

    function scrollToBottom(force = false) {
        if (force || !isUserScrolledUp) {
            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    }

    function handleScroll() {
        const wasScrolledUp = isUserScrolledUp;
        isUserScrolledUp = !isNearBottom();

        // Show/hide scroll to bottom button
        const scrollButton = document.getElementById('scrollToBottomButton');
        if (scrollButton) {
            scrollButton.style.display = isUserScrolledUp ? 'flex' : 'none';
        }

        // If user scrolls down to bottom during streaming, resume auto-scroll
        if (wasScrolledUp && !isUserScrolledUp && isStreaming) {
            scrollToBottom(true);
        }
    }

    // Draft persistence functions
    async function saveDraft(conversationId, text) {
        if (!chrome.storage || !chrome.storage.local) return;
        try {
            const drafts = await chrome.storage.local.get(draftsKey);
            const draftData = drafts[draftsKey] || {};
            draftData[conversationId] = {
                text: text,
                timestamp: Date.now()
            };
            await chrome.storage.local.set({ [draftsKey]: draftData });
        } catch (error) {
            console.error('Error saving draft:', error);
        }
    }

    async function loadDraft(conversationId) {
        if (!chrome.storage || !chrome.storage.local) return '';
        try {
            const drafts = await chrome.storage.local.get(draftsKey);
            const draftData = drafts[draftsKey] || {};
            const draft = draftData[conversationId];
            return draft ? draft.text : '';
        } catch (error) {
            console.error('Error loading draft:', error);
            return '';
        }
    }

    async function clearDraft(conversationId) {
        if (!chrome.storage || !chrome.storage.local) return;
        try {
            const drafts = await chrome.storage.local.get(draftsKey);
            const draftData = drafts[draftsKey] || {};
            delete draftData[conversationId];
            await chrome.storage.local.set({ [draftsKey]: draftData });
        } catch (error) {
            console.error('Error clearing draft:', error);
        }
    }

    // Helper function to create Lucide icons as SVG
    function createLucideIcon(iconName, size = 16) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');

        // Define icon paths
        const icons = {
            'copy': '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
            'file-down': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>',
            'file-code': '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 13 11 15 9 17"/><polyline points="15 13 13 15 15 17"/>',
            'square': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
            'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
            'brain': '<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>',
            'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
            'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
            'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
            'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
            'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
            'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
            'trash': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
            'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
            'audio-lines': '<path d="M2 10v4"/><path d="M6 6v12"/><path d="M10 3v18"/><path d="M14 6v12"/><path d="M18 10v4"/><path d="M22 10v4"/>',
            'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
            'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
            'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
            'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
            'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
            'zap': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
            'activity': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
            'flame': '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
            'cpu': '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
            'mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
            'mic-off': '<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>',
            'mic': '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
            'mic-off': '<line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" y1="19" x2="12" y2="22"/>'
        };

        if (icons[iconName]) {
            svg.innerHTML = icons[iconName];
        } else {
            // Fallback to a simple circle if icon not found
            svg.innerHTML = '<circle cx="12" cy="12" r="10"/>';
        }

        return svg;
    }

    // Token estimation functions
    function estimateTokens(text) {
        if (!text || typeof text !== 'string') return 0;
        // Rough approximation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }

    function getConversationTokenCount(messages) {
        if (!Array.isArray(messages)) return 0;
        return messages.reduce((total, msg) => {
            const contentTokens = estimateTokens(msg.content || '');
            // Add overhead for message structure (role, etc.)
            return total + contentTokens + 4;
        }, 0);
    }

    function formatTokenCount(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}k tokens`;
        }
        return `${count} tokens`;
    }

    async function updateContextIndicator(messages, systemPrompt = '', modelData = null) {
        const messageTokens = getConversationTokenCount(messages);
        const systemPromptTokens = estimateTokens(systemPrompt);
        const totalTokens = messageTokens + systemPromptTokens;

        // Get effective context limit
        const effectiveLimit = getEffectiveContextLimit(currentModelName, modelData);
        const isCloud = isCloudModel(currentModelName);
        const hasOverride = modelData && modelData.contextLimitOverride && modelData.contextLimitOverride > 0;

        // Update text
        contextIndicatorText.textContent = formatTokenCount(totalTokens);

        // Calculate percentage
        const usagePercent = ((totalTokens / effectiveLimit) * 100).toFixed(1);

        // Build enhanced tooltip
        let tooltipText = `📊 Context Usage: ${formatTokenCount(totalTokens)} / ${formatContextLimit(effectiveLimit)} (${usagePercent}%)\n\n`;
        tooltipText += `Messages: ${formatTokenCount(messageTokens)}\n`;
        if (systemPromptTokens > 0) {
            tooltipText += `System prompt: ${formatTokenCount(systemPromptTokens)}\n`;
        }
        tooltipText += `\n`;

        if (isCloud) {
            tooltipText += `Context window: ${formatContextLimit(effectiveLimit)} (cloud model)\n`;
            tooltipText += `Context window varies by model. Cloud models typically support\n`;
            tooltipText += `128K-1M tokens. Check ollama.com/library/${currentModelName} for specifics.\n\n`;
        } else {
            tooltipText += `Context window: ${formatContextLimit(effectiveLimit)} (local model)\n`;
            tooltipText += `Default context window for local models is 4K tokens.\n`;
            tooltipText += `You can increase this when running Ollama with --ctx-size flag.\n\n`;
        }

        if (hasOverride) {
            tooltipText += `💡 Custom limit set. Visit Settings to change.\n`;
        } else {
            tooltipText += `💡 Tip: Click Settings to set a custom context limit.`;
        }

        contextIndicator.title = tooltipText;

        // Update color based on usage
        const usageRatio = totalTokens / effectiveLimit;
        contextIndicator.classList.remove('warning', 'critical');

        if (usageRatio >= CRITICAL_THRESHOLD) {
            contextIndicator.classList.add('critical');
        } else if (usageRatio >= WARNING_THRESHOLD) {
            contextIndicator.classList.add('warning');
        }
    }

    // Cloud model detection
    function isCloudModel(modelName) {
        if (!modelName || typeof modelName !== 'string') return false;

        // Pattern 1: :cloud or .cloud tag in name (Ollama cloud models use :cloud)
        if (modelName.includes(':cloud') || modelName.includes('.cloud')) return true;

        // Pattern 2: Check if model has size 0 (cloud models don't occupy local storage)
        const model = availableModels.find(m => m.name === modelName);
        if (model && (model.size === 0 || model.size === undefined || model.size === null)) {
            return true;
        }

        return false;
    }

    // Get effective context limit for current model
    function getEffectiveContextLimit(modelName, modelData) {
        // Check for user override
        if (modelData && modelData.contextLimitOverride && modelData.contextLimitOverride > 0) {
            return modelData.contextLimitOverride;
        }

        // Auto-detect based on model type
        if (isCloudModel(modelName)) {
            return CLOUD_CONTEXT_LIMIT; // 131072 (128K)
        }

        return DEFAULT_CONTEXT_LIMIT; // 4096 (4K)
    }

    // Format context limit for display
    function formatContextLimit(limit) {
        if (limit >= 1000) {
            return `${(limit / 1000).toFixed(0)}k`;
        }
        return `${limit}`;
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
            return { conversations: {}, activeConversationId: null, systemPrompt: '', contextLimitOverride: null, params: null };
        }
        try {
            const key = getModelStorageKey(modelToLoad); // Key generation will also log
            const storageResult = await chrome.storage.local.get(key);
            console.log('[OllamaBro] loadModelChatState - Key used:', key, 'Data loaded from storage:', storageResult);

            let modelSpecificData = storageResult[key];
            let needsSave = false;

            if (modelSpecificData && typeof modelSpecificData === 'object') {
                // Data exists and is an object, proceed with checks
                // Ensure a deep copy for logging to avoid showing mutated object if it's referenced elsewhere
                try {
                    console.log(`Raw chat state loaded for ${modelToLoad}:`, JSON.parse(JSON.stringify(modelSpecificData)));
                } catch (e) {
                    console.warn(`[OllamaBro] loadModelChatState - Could not stringify modelSpecificData for logging for model ${modelToLoad}:`, modelSpecificData);
                }

                if (typeof modelSpecificData.conversations !== 'object' || modelSpecificData.conversations === null) {
                    modelSpecificData.conversations = {};
                    needsSave = true;
                }
                if (typeof modelSpecificData.activeConversationId === 'undefined') {
                    modelSpecificData.activeConversationId = null;
                    needsSave = true;
                }
                if (typeof modelSpecificData.systemPrompt === 'undefined') {
                    modelSpecificData.systemPrompt = '';
                    needsSave = true;
                }
                if (typeof modelSpecificData.contextLimitOverride === 'undefined') {
                    modelSpecificData.contextLimitOverride = null;
                    needsSave = true;
                }
                if (typeof modelSpecificData.params === 'undefined') {
                    modelSpecificData.params = null;
                    needsSave = true;
                }

                // Save back to storage if we initialized any missing fields
                if (needsSave) {
                    console.log(`[OllamaBro] loadModelChatState - Migrating old data for ${modelToLoad} with new fields`);
                    await chrome.storage.local.set({ [key]: modelSpecificData });
                }

                return modelSpecificData;
            } else if (modelSpecificData) {
                // Data exists but is NOT an object (e.g., string, number, boolean due to corruption)
                console.warn(`[OllamaBro] loadModelChatState - Data for model ${modelToLoad} is not an object:`, modelSpecificData, ". Resetting to default structure.");
                return { conversations: {}, activeConversationId: null, systemPrompt: '', contextLimitOverride: null, params: null }; // Return default structure
            }
            // modelSpecificData is null or undefined (no data for this key)
            console.log(`[OllamaBro] loadModelChatState - No data found for ${modelToLoad}. Returning default structure.`);
            return { conversations: {}, activeConversationId: null, systemPrompt: '', contextLimitOverride: null, params: null }; // Default if nothing stored
        } catch (error) {
            console.error('Error loading chat state:', error);
            return { conversations: {}, activeConversationId: null, systemPrompt: '', contextLimitOverride: null, params: null };
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
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
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

            // TTS Button
            const ttsButton = document.createElement('button');
            ttsButton.classList.add('action-button', 'tts-button');
            ttsButton.title = 'Read aloud';
            ttsButton.appendChild(createLucideIcon('audio-lines', 16));

            ttsButton.addEventListener('click', (e) => {
                e.stopPropagation();
                speakText(textContentDiv, ttsButton);
            });
            actionsDiv.appendChild(ttsButton);

            // Store reference to stop button for later use
            messageDiv.stopButton = stopButton;

            messageDiv.appendChild(actionsDiv);

            // Add metadata display if available
        }

        chatContainer.appendChild(messageDiv);
        scrollToBottom(true); // Force scroll on new message

        // Store reference to messageDiv for later use (e.g., adding metadata)
        textContentDiv.messageDiv = messageDiv;

        return textContentDiv; // Return the element where text is displayed for streaming
    }

    function updateBotMessageInUI(botTextElement, newContentChunk, streaming = false) {
        const previousRawFullText = botTextElement.dataset.fullMessage || '';
        const currentRawFullText = previousRawFullText + newContentChunk;

        // Debug: Log if we see think tags in the content
        if (newContentChunk.includes('<think') || newContentChunk.includes('</think>')) {
            console.log('[Thinking] Received chunk with think tag:', newContentChunk.substring(0, 100));
        }

        botTextElement.innerHTML = '';
        const fragment = renderMarkdownWithThinking(currentRawFullText, streaming);
        botTextElement.appendChild(fragment);

        botTextElement.dataset.fullMessage = currentRawFullText;

        // Only auto-scroll if user hasn't scrolled up
        scrollToBottom(false);
    }

    // Helper function to add metadata to an existing message
    function addMetadataToMessage(messageDiv, metadata) {
        if (!metadata || (!metadata.tokens && !metadata.promptTokens)) return;

        // Check if metadata already exists
        if (messageDiv.querySelector('.message-metadata')) return;

        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'message-metadata';

        // Format metadata items with titles for tooltips
        const items = [];

        if (metadata.tokens) {
            items.push({
                icon: 'type',
                text: `${metadata.tokens}`,
                title: `Output tokens: ${metadata.tokens} tokens generated in the response`
            });
        }

        if (metadata.promptTokens) {
            items.push({
                icon: 'message-square',
                text: `${metadata.promptTokens}`,
                title: `Prompt tokens: ${metadata.promptTokens} tokens in the input/prompt`
            });
        }

        if (metadata.thinkingTokens) {
            items.push({
                icon: 'brain',
                text: `${metadata.thinkingTokens}`,
                title: `Thinking tokens: ~${metadata.thinkingTokens} tokens in the reasoning/thinking section`
            });
        }

        if (metadata.speed !== null && metadata.speed !== undefined && metadata.speed !== '0.0') {
            items.push({
                icon: 'zap',
                text: `${metadata.speed}`,
                title: `Generation speed: ${metadata.speed} tokens per second`
            });
        }

        if (metadata.duration) {
            items.push({
                icon: 'clock',
                text: `${metadata.duration}s`,
                title: `Generation time: ${metadata.duration} seconds to generate the response`
            });
        }

        items.forEach((item, index) => {
            const itemSpan = document.createElement('span');
            itemSpan.className = 'metadata-item';
            itemSpan.title = item.title;
            itemSpan.appendChild(createLucideIcon(item.icon, 12));
            const textSpan = document.createElement('span');
            textSpan.textContent = item.text;
            itemSpan.appendChild(textSpan);
            metadataDiv.appendChild(itemSpan);

            // Add divider between items
            if (index < items.length - 1) {
                const divider = document.createElement('span');
                divider.className = 'metadata-divider';
                divider.textContent = '·';
                metadataDiv.appendChild(divider);
            }
        });

        messageDiv.appendChild(metadataDiv);
    }

    async function displayConversationMessages(modelData, conversationId) {
        chatContainer.innerHTML = ''; // Clear current messages
        let messages = [];

        if (modelData.conversations[conversationId] && modelData.conversations[conversationId].messages) {
            messages = modelData.conversations[conversationId].messages;
            messages.forEach(msg => {
                const textContentDiv = addMessageToChatUI(
                    msg.role === 'user' ? 'You' : currentModelName,
                    msg.content,
                    msg.role === 'user' ? 'user-message' : 'bot-message',
                    modelData,
                    msg.images // Pass images if present
                );

                // Add metadata to existing bot messages that have it stored
                if (msg.role === 'assistant' && msg.metadata && textContentDiv && textContentDiv.messageDiv) {
                    addMetadataToMessage(textContentDiv.messageDiv, msg.metadata);
                }
            });
        } else {
            addMessageToChatUI(currentModelName, `Hello! Start a new conversation with ${decodeURIComponent(currentModelName)}.`, 'bot-message', modelData);
        }

        // Update context indicator
        await updateContextIndicator(messages, modelData.systemPrompt, modelData);
    }

    async function startNewConversation(modelForNewChat = currentModelName) {
        console.log(`Starting new conversation for model: ${modelForNewChat}`);

        // Save current draft before switching
        const currentModelData = await loadModelChatState(modelForNewChat);
        if (currentModelData.activeConversationId && messageInput.value.trim()) {
            await saveDraft(currentModelData.activeConversationId, messageInput.value);
        }

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

        // Clear input and draft for new conversation
        messageInput.value = '';
        await clearDraft(newConversationId);
        messageInput.focus();
        return newConversationId;
    }

    async function switchActiveConversation(modelToSwitch, newConversationId) {
        console.log(`Switching to conversation ${newConversationId} for model ${modelToSwitch}`);

        // Save current draft before switching
        let currentModelData = await loadModelChatState(modelToSwitch);
        if (currentModelData.activeConversationId && messageInput.value.trim()) {
            await saveDraft(currentModelData.activeConversationId, messageInput.value);
        }

        let modelData = await loadModelChatState(modelToSwitch);
        if (modelData.conversations[newConversationId]) {
            modelData.activeConversationId = newConversationId;
            await saveModelChatState(modelToSwitch, modelData);
            displayConversationMessages(modelData, newConversationId);
            populateConversationSidebar(modelToSwitch, modelData); // Refresh sidebar to highlight active

            // Load draft for the new conversation
            const draftText = await loadDraft(newConversationId);
            messageInput.value = draftText || '';
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
    }

    // --- Model Parameter Functions ---

    function setupParamSync(sliderId, numberId, defaultVal) {
        const slider = document.getElementById(sliderId);
        const number = document.getElementById(numberId);
        if (!slider || !number) return;
        slider.addEventListener('input', () => {
            number.value = slider.value;
        });
        number.addEventListener('input', () => {
            if (number.value === '') {
                slider.value = defaultVal;
            } else {
                const val = parseFloat(number.value);
                if (!isNaN(val)) {
                    slider.value = Math.min(parseFloat(slider.max), Math.max(parseFloat(slider.min), val));
                }
            }
        });
    }

    function loadParamInputs(params) {
        const p = params || {};
        const setSliderAndNumber = (sliderId, numberId, val, defaultVal) => {
            const slider = document.getElementById(sliderId);
            const number = document.getElementById(numberId);
            if (slider) slider.value = (val != null) ? val : defaultVal;
            if (number) number.value = (val != null) ? val : '';
        };
        setSliderAndNumber('paramTemperatureSlider', 'paramTemperature', p.temperature ?? null, 0.8);
        setSliderAndNumber('paramTopPSlider', 'paramTopP', p.top_p ?? null, 0.9);
        setSliderAndNumber('paramTopKSlider', 'paramTopK', p.top_k ?? null, 40);
        setSliderAndNumber('paramRepeatPenaltySlider', 'paramRepeatPenalty', p.repeat_penalty ?? null, 1.1);
        const numPredict = document.getElementById('paramNumPredict');
        if (numPredict) numPredict.value = (p.num_predict != null) ? p.num_predict : '';
        const seed = document.getElementById('paramSeed');
        if (seed) seed.value = (p.seed != null) ? p.seed : '';
    }

    function collectParams() {
        const getFloat = (id) => {
            const el = document.getElementById(id);
            if (!el || el.value === '') return null;
            const v = parseFloat(el.value);
            return isNaN(v) ? null : v;
        };
        const getInt = (id) => {
            const el = document.getElementById(id);
            if (!el || el.value === '') return null;
            const v = parseInt(el.value, 10);
            return isNaN(v) ? null : v;
        };
        const params = {};
        const temperature = getFloat('paramTemperature');
        const top_p = getFloat('paramTopP');
        const top_k = getInt('paramTopK');
        const repeat_penalty = getFloat('paramRepeatPenalty');
        const num_predict = getInt('paramNumPredict');
        const seed = getInt('paramSeed');
        if (temperature != null) params.temperature = temperature;
        if (top_p != null) params.top_p = top_p;
        if (top_k != null) params.top_k = top_k;
        if (repeat_penalty != null) params.repeat_penalty = repeat_penalty;
        if (num_predict != null) params.num_predict = num_predict;
        if (seed != null && seed !== 0) params.seed = seed;
        return Object.keys(params).length > 0 ? params : null;
    }

    function resetParamInputs() {
        ['paramTemperature', 'paramTopP', 'paramTopK', 'paramRepeatPenalty', 'paramNumPredict', 'paramSeed'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const sliderDefaults = { paramTemperatureSlider: 0.8, paramTopPSlider: 0.9, paramTopKSlider: 40, paramRepeatPenaltySlider: 1.1 };
        for (const [id, def] of Object.entries(sliderDefaults)) {
            const el = document.getElementById(id);
            if (el) el.value = def;
        }
    }

    function toggleSection(toggleId, bodyId) {
        const toggle = document.getElementById(toggleId);
        const body = document.getElementById(bodyId);
        if (!toggle || !body) return;
        const isExpanded = body.classList.contains('expanded');
        body.classList.toggle('expanded', !isExpanded);
        toggle.classList.toggle('expanded', !isExpanded);
        if (!isExpanded && typeof lucide !== 'undefined') lucide.createIcons();
    }

    function toggleParamSection() {
        toggleSection('paramSectionToggle', 'paramSectionBody');
    }

    // Settings modal functions
    function openSettingsModal() {
        // Load current settings
        loadModelChatState(currentModelName).then(modelData => {
            // Load system prompt
            const prompt = modelData.systemPrompt || '';
            systemPromptInput.value = prompt;
            updateSystemPromptTokenCount();

            // Load context limit
            const contextLimit = modelData.contextLimitOverride;
            if (contextLimit && contextLimit > 0) {
                contextLimitInput.value = contextLimit;
            } else {
                contextLimitInput.value = '';
            }
            updateContextLimitInfo();

            // Load model params (always populate so inputs are ready when section expands)
            loadParamInputs(modelData.params);
        });

        // Refresh persona presets only if section is already expanded
        const personaBody = document.getElementById('personaSectionBody');
        if (personaBody && personaBody.classList.contains('expanded')) {
            loadPersonaPresets().then(presets => {
                renderPersonaPresets(presets);
                hideNewPresetForm();
            });
        } else {
            hideNewPresetForm();
        }

        // Load TTS settings
        loadTTSSettings();

        settingsModal.classList.add('active');
    }

    function closeSettingsModal() {
        settingsModal.classList.remove('active');
        stopKokoroStatusPoll();
        // Restore focus to input when modal closes
        messageInput.focus();
    }

    function updateSystemPromptTokenCount() {
        const tokens = estimateTokens(systemPromptInput.value);
        systemPromptTokenCount.textContent = `${tokens} tokens`;
    }

    function updateContextLimitInfo() {
        const isCloud = isCloudModel(currentModelName);
        const autoLimit = isCloud ? formatContextLimit(CLOUD_CONTEXT_LIMIT) : formatContextLimit(DEFAULT_CONTEXT_LIMIT);
        const modelType = isCloud ? 'cloud' : 'local';
        contextLimitInfo.textContent = `Auto-detecting: ${autoLimit} (${modelType} model). Set to 0 or leave empty for auto.`;
    }

    async function saveSystemPrompt() {
        try {
            const newPrompt = systemPromptInput.value.trim();
            const contextLimitValue = contextLimitInput.value.trim();

            let modelData = await loadModelChatState(currentModelName);
            modelData.systemPrompt = newPrompt;

            // Parse and save context limit override
            const parsedLimit = parseInt(contextLimitValue, 10);
            if (contextLimitValue && !isNaN(parsedLimit) && parsedLimit > 0) {
                modelData.contextLimitOverride = parsedLimit;
            } else {
                modelData.contextLimitOverride = null; // Use auto-detection
            }

            // Collect and save model params
            modelData.params = collectParams();

            await saveModelChatState(currentModelName, modelData);

            // Update context indicator to reflect new system prompt size
            const currentMessages = getCurrentConversationMessages(modelData);
            await updateContextIndicator(currentMessages, newPrompt, modelData);

            // Save TTS settings
            await saveTTSSettings();

            console.log('[OllamaBro] Settings saved for model:', currentModelName);
        } finally {
            closeSettingsModal();
        }
    }

    async function clearSystemPrompt() {
        systemPromptInput.value = '';
        updateSystemPromptTokenCount();
        let modelData = await loadModelChatState(currentModelName);
        modelData.systemPrompt = '';
        modelData.contextLimitOverride = null; // Also clear context limit override
        await saveModelChatState(currentModelName, modelData);

        const currentMessages = getCurrentConversationMessages(modelData);
        await updateContextIndicator(currentMessages, '', modelData);

        // Clear active persona badge
        activePersonaName = '';
        updatePersonaBadge();
        loadPersonaPresets().then(renderPersonaPresets);

        console.log('[OllamaBro] System prompt cleared for model:', currentModelName);
    }

    // --- Persona Preset Functions ---

    async function loadPersonaPresets() {
        if (!chrome.storage || !chrome.storage.local) return [...DEFAULT_PRESETS];
        try {
            const initKey = `${personaPresetsKey}_init`;
            const result = await chrome.storage.local.get([personaPresetsKey, initKey]);
            if (!result[initKey]) {
                // First run — seed with defaults, user owns the list from here
                const initial = DEFAULT_PRESETS.map(({ id, name, prompt }) => ({ id, name, prompt }));
                await chrome.storage.local.set({ [personaPresetsKey]: initial, [initKey]: true });
                return initial;
            }
            return result[personaPresetsKey] || [];
        } catch (error) {
            console.error('[OllamaBro] Error loading persona presets:', error);
            return [...DEFAULT_PRESETS];
        }
    }

    async function savePersonaPresets(presets) {
        if (!chrome.storage || !chrome.storage.local) return;
        try {
            await chrome.storage.local.set({ [personaPresetsKey]: presets });
        } catch (error) {
            console.error('[OllamaBro] Error saving persona presets:', error);
        }
    }

    function renderPersonaPresets(presets) {
        const list = document.getElementById('personaPresetsList');
        if (!list) return;
        list.innerHTML = '';

        if (presets.length === 0) {
            const empty = document.createElement('p');
            empty.style.cssText = 'font-size: var(--font-size-xs); color: var(--text-muted); padding: var(--space-sm) 0;';
            empty.textContent = 'No presets yet. Use the button below to add one.';
            list.appendChild(empty);
            return;
        }

        for (const preset of presets) {
            list.appendChild(createPresetViewRow(preset));
        }
    }

    function createPresetViewRow(preset) {
        const item = document.createElement('div');
        item.className = 'preset-item';
        item.dataset.presetId = preset.id;

        const info = document.createElement('div');
        info.className = 'preset-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'preset-item-name';
        nameEl.textContent = preset.name;

        const preview = document.createElement('div');
        preview.className = 'preset-item-preview';
        preview.textContent = preset.prompt;
        preview.title = preset.prompt;

        info.appendChild(nameEl);
        info.appendChild(preview);

        const actions = document.createElement('div');
        actions.className = 'preset-item-actions';

        const applyBtn = document.createElement('button');
        applyBtn.className = 'preset-apply-button';
        const isActive = activePersonaName === preset.name;
        applyBtn.textContent = isActive ? 'Active' : 'Apply';
        if (isActive) applyBtn.classList.add('active');
        applyBtn.addEventListener('click', () => applyPersonaPreset(preset));

        const editBtn = document.createElement('button');
        editBtn.className = 'preset-edit-button';
        editBtn.title = 'Edit preset';
        editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
        editBtn.addEventListener('click', () => openPresetEditInline(item, preset));

        actions.appendChild(applyBtn);
        actions.appendChild(editBtn);
        item.appendChild(info);
        item.appendChild(actions);
        return item;
    }

    function openPresetEditInline(itemEl, preset) {
        itemEl.innerHTML = '';
        itemEl.classList.add('preset-item-editing');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'preset-name-input';
        nameInput.value = preset.name;
        nameInput.maxLength = 50;
        nameInput.placeholder = 'Preset name';

        const promptTextarea = document.createElement('textarea');
        promptTextarea.className = 'preset-prompt-input';
        promptTextarea.value = preset.prompt;
        promptTextarea.rows = 4;
        promptTextarea.placeholder = 'System prompt text...';

        const actionsRow = document.createElement('div');
        actionsRow.className = 'preset-edit-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'modal-button danger';
        deleteBtn.style.marginRight = 'auto';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deletePersonaPreset(preset.id));

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-button secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => loadPersonaPresets().then(renderPersonaPresets));

        const saveBtn = document.createElement('button');
        saveBtn.className = 'modal-button primary';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async () => {
            const newName = nameInput.value.trim();
            const newPrompt = promptTextarea.value.trim();
            if (!newName) { nameInput.focus(); return; }
            if (!newPrompt) { promptTextarea.focus(); return; }
            await updatePersonaPreset(preset.id, newName, newPrompt);
        });

        actionsRow.appendChild(deleteBtn);
        actionsRow.appendChild(cancelBtn);
        actionsRow.appendChild(saveBtn);
        itemEl.appendChild(nameInput);
        itemEl.appendChild(promptTextarea);
        itemEl.appendChild(actionsRow);
        nameInput.focus();
        nameInput.select();
    }

    async function updatePersonaPreset(id, name, prompt) {
        const presets = await loadPersonaPresets();
        const idx = presets.findIndex(p => p.id === id);
        if (idx === -1) return;
        const oldName = presets[idx].name;
        const updated = presets.map(p => p.id === id ? { id: p.id, name, prompt } : p);
        if (activePersonaName === oldName) {
            activePersonaName = name;
            updatePersonaBadge();
        }
        await savePersonaPresets(updated);
        renderPersonaPresets(updated);
    }

    function togglePersonaSection() {
        const toggle = document.getElementById('personaSectionToggle');
        const body = document.getElementById('personaSectionBody');
        if (!toggle || !body) return;
        const isExpanded = body.classList.contains('expanded');
        if (isExpanded) {
            body.classList.remove('expanded');
            toggle.classList.remove('expanded');
        } else {
            body.classList.add('expanded');
            toggle.classList.add('expanded');
            loadPersonaPresets().then(presets => {
                renderPersonaPresets(presets);
                hideNewPresetForm();
            });
        }
    }

    function applyPersonaPreset(preset) {
        if (systemPromptInput) {
            systemPromptInput.value = preset.prompt;
            updateSystemPromptTokenCount();
        }
        activePersonaName = preset.name;
        updatePersonaBadge();
        // Re-render to update Active/Apply button states
        loadPersonaPresets().then(renderPersonaPresets);
        console.log('[OllamaBro] Applied persona preset:', preset.name);
    }

    function updatePersonaBadge() {
        const badge = document.getElementById('personaBadge');
        if (!badge) return;
        if (activePersonaName) {
            badge.textContent = activePersonaName;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }

    async function deletePersonaPreset(id) {
        const presets = await loadPersonaPresets();
        const deleted = presets.find(p => p.id === id);
        const updated = presets.filter(p => p.id !== id);
        await savePersonaPresets(updated);
        if (deleted && activePersonaName === deleted.name) {
            activePersonaName = '';
            updatePersonaBadge();
        }
        renderPersonaPresets(updated);
    }

    async function saveNewPersonaPreset() {
        const nameInput = document.getElementById('newPresetName');
        const promptInput = document.getElementById('newPresetPrompt');
        const name = nameInput ? nameInput.value.trim() : '';
        const prompt = promptInput ? promptInput.value.trim() : '';
        if (!name) { if (nameInput) nameInput.focus(); return; }
        if (!prompt) { if (promptInput) promptInput.focus(); return; }

        const newPreset = { id: `user-${Date.now()}`, name, prompt, isDefault: false };
        const presets = await loadPersonaPresets();
        presets.push(newPreset);
        await savePersonaPresets(presets);
        hideNewPresetForm();
        renderPersonaPresets(presets);
        console.log('[OllamaBro] Saved new persona preset:', name);
    }

    function showNewPresetForm() {
        const form = document.getElementById('newPresetForm');
        const addBtn = document.getElementById('addNewPresetButton');
        if (form) { form.style.display = 'flex'; }
        if (addBtn) { addBtn.style.display = 'none'; }
        const nameInput = document.getElementById('newPresetName');
        if (nameInput) nameInput.focus();
    }

    function hideNewPresetForm() {
        const form = document.getElementById('newPresetForm');
        const addBtn = document.getElementById('addNewPresetButton');
        if (form) { form.style.display = 'none'; }
        if (addBtn) { addBtn.style.display = 'flex'; }
        const nameInput = document.getElementById('newPresetName');
        const promptInput = document.getElementById('newPresetPrompt');
        if (nameInput) nameInput.value = '';
        if (promptInput) promptInput.value = '';
    }

    // Clear context modal functions
    function openClearContextModal() {
        clearContextModal.classList.add('active');
    }

    function closeClearContextModal() {
        clearContextModal.classList.remove('active');
        // Restore focus to input when modal closes
        messageInput.focus();
    }

    function openShortcutsModal() {
        shortcutsModal.classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function closeShortcutsModal() {
        shortcutsModal.classList.remove('active');
        messageInput.focus();
    }

    async function clearContextKeepingSystemPrompt() {
        console.log(`Clearing messages while keeping system prompt for model: ${currentModelName}`);
        let modelData = await loadModelChatState(currentModelName);
        const systemPrompt = modelData.systemPrompt || '';

        // Reset conversations but preserve all settings
        modelData = {
            conversations: {},
            activeConversationId: null,
            systemPrompt: systemPrompt,
            contextLimitOverride: modelData.contextLimitOverride || null,
            params: modelData.params || null
        };

        await saveModelChatState(currentModelName, modelData);
        await startNewConversation(currentModelName);
        closeClearContextModal();
    }

    async function sendMessageToOllama(prompt) {
        if (!prompt || prompt.trim() === '') return;

        // Clear draft for current conversation when sending
        let modelData = await loadModelChatState(currentModelName);
        if (modelData.activeConversationId) {
            await clearDraft(modelData.activeConversationId);
        }

        modelData = await loadModelChatState(currentModelName);
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
        // Show loading indicator - will hide when first content arrives or on error
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
            loadingIndicator.textContent = 'Waiting for response...';
        }
        messageInput.disabled = true;
        sendButton.disabled = true;

        // Track if content has started arriving for gap-filling loading state
        let contentHasStarted = false;

        const botTextElement = addMessageToChatUI(currentModelName, '', 'bot-message', modelData);
        const botMessageDiv = botTextElement.parentElement;
        const stopButton = botMessageDiv.stopButton;

        // Create AbortController for this request
        currentAbortController = new AbortController();

        // Set streaming flag
        isStreaming = true;

        // Show stop button during streaming and add streaming class
        if (stopButton) {
            stopButton.style.display = 'flex';
        }
        if (botMessageDiv) {
            botMessageDiv.classList.add('streaming');
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

            // Prepend system prompt if it exists
            if (modelData.systemPrompt && modelData.systemPrompt.trim()) {
                apiMessages.unshift({
                    role: 'system',
                    content: modelData.systemPrompt.trim()
                });
                console.log('[OllamaBro] System prompt prepended to API request');
            }

            const requestBody = {
                model: currentModelName,
                messages: apiMessages,
                stream: true
            };

            // Attach non-null model params as Ollama options
            const p = modelData.params || {};
            const options = {};
            if (p.temperature != null) options.temperature = p.temperature;
            if (p.top_p != null) options.top_p = p.top_p;
            if (p.top_k != null) options.top_k = p.top_k;
            if (p.repeat_penalty != null) options.repeat_penalty = p.repeat_penalty;
            if (p.num_predict != null) options.num_predict = p.num_predict;
            if (p.seed != null && p.seed !== 0) options.seed = p.seed;
            if (Object.keys(options).length > 0) requestBody.options = options;

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
            let messageMetadata = null;

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

                            // Hide loading indicator when content first starts arriving (gap-filling)
                            if (!contentHasStarted && (accumulatedContent || accumulatedThinking)) {
                                contentHasStarted = true;
                                if (loadingIndicator) {
                                    loadingIndicator.style.display = 'none';
                                }
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
                                // Hide stop button and remove streaming class when streaming is complete
                                if (stopButton) {
                                    stopButton.style.display = 'none';
                                }
                                if (botMessageDiv) {
                                    botMessageDiv.classList.remove('streaming');
                                }

                                // Capture metrics from final response
                                if (jsonResponse.eval_count !== undefined) {
                                    // Use eval_duration if available, otherwise fall back to total_duration
                                    const durationNs = jsonResponse.eval_duration || jsonResponse.total_duration;
                                    const duration = durationNs ? (durationNs / 1e9).toFixed(2) : null;
                                    // Calculate speed: tokens / seconds (duration is in nanoseconds)
                                    let speed = null;
                                    if (durationNs && durationNs > 0 && jsonResponse.eval_count > 0) {
                                        const durationSeconds = durationNs / 1e9;
                                        speed = (jsonResponse.eval_count / durationSeconds).toFixed(1);
                                    }

                                    // Estimate thinking tokens (rough approximation: ~4 chars per token)
                                    const thinkingTokens = hasThinking && accumulatedThinking
                                        ? Math.ceil(accumulatedThinking.length / 4)
                                        : null;

                                    messageMetadata = {
                                        tokens: jsonResponse.eval_count,
                                        promptTokens: jsonResponse.prompt_eval_count,
                                        thinkingTokens: thinkingTokens,
                                        speed: speed,
                                        duration: duration
                                    };
                                    console.log('Message metadata captured:', messageMetadata);
                                    console.log('Raw API values:', {
                                        eval_count: jsonResponse.eval_count,
                                        eval_duration: jsonResponse.eval_duration,
                                        prompt_eval_count: jsonResponse.prompt_eval_count,
                                        total_duration: jsonResponse.total_duration
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse JSON chunk from stream:', jsonStr, e);
                        }
                    });
                }
            }
            console.log('Stream reading complete.');

            // Add metadata display to the message
            if (messageMetadata && botMessageDiv) {
                addMetadataToMessage(botMessageDiv, messageMetadata);
            }

            // Build final message with thinking if present
            let finalBotMessageToSave = '';
            if (hasThinking && accumulatedThinking) {
                finalBotMessageToSave = `<think>\n${accumulatedThinking}\n</think>\n\n${accumulatedContent}`;
            } else {
                finalBotMessageToSave = accumulatedContent;
            }

            // Update the dataset to ensure consistency
            botTextElement.dataset.fullMessage = finalBotMessageToSave;
            const messageToSave = { role: 'assistant', content: finalBotMessageToSave };
            if (messageMetadata) {
                messageToSave.metadata = messageMetadata;
            }
            currentConversation.messages.push(messageToSave);
            currentConversation.summary = getConversationSummary(currentConversation.messages);
            currentConversation.lastMessageTime = Date.now();

            // Update context indicator after receiving response
            await updateContextIndicator(currentConversation.messages, modelData.systemPrompt, modelData);

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

            // Reset streaming flag
            isStreaming = false;

            // Hide stop button and clear abort controller
            if (stopButton) {
                stopButton.style.display = 'none';
            }
            currentAbortController = null;

            // Remove streaming class from message
            if (botMessageDiv) {
                botMessageDiv.classList.remove('streaming');
            }

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
        // This function now just opens the clear context modal
        // The actual clearing is handled by clearContextKeepingSystemPrompt()
        console.log(`Opening clear context modal for model: ${modelToClear}`);
        openClearContextModal();
    }

    async function switchModel(newModelName) {
        const oldModelName = currentModelName;
        if (newModelName === oldModelName) return;
        console.log('[OllamaBro] switchModel - Switching from:', oldModelName, 'to:', newModelName);
        console.log(`Switching model to: ${newModelName}`);

        // Save draft for current conversation before switching
        let oldModelData = await loadModelChatState(oldModelName);
        if (oldModelData.activeConversationId && messageInput.value.trim()) {
            await saveDraft(oldModelData.activeConversationId, messageInput.value);
        }

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

            // Load draft for the new conversation
            const draftText = await loadDraft(modelData.activeConversationId);
            messageInput.value = draftText || '';
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

            // Load draft for active conversation
            const draftText = await loadDraft(modelData.activeConversationId);
            if (draftText) {
                messageInput.value = draftText;
            }
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

        // Initialize Lucide icons for new elements
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Setup scroll detection
        chatContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    // Message history navigation (persistent via chrome.storage.local)
    const MESSAGE_HISTORY_KEY = 'inputMessageHistory';
    const messageHistory = [];
    let historyIndex = -1;
    let historyDraft = '';

    // Load persisted history on startup
    chrome.storage.local.get(MESSAGE_HISTORY_KEY, (result) => {
        const saved = result[MESSAGE_HISTORY_KEY];
        if (Array.isArray(saved)) messageHistory.push(...saved);
    });

    function pushToHistory(text) {
        if (!text.trim()) return;
        if (messageHistory[messageHistory.length - 1] === text) return; // no duplicates
        messageHistory.push(text);
        if (messageHistory.length > 50) messageHistory.shift();
        historyIndex = -1;
        chrome.storage.local.set({ [MESSAGE_HISTORY_KEY]: messageHistory });
    }

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            pushToHistory(messageInput.value);
            sendMessageToOllama(messageInput.value);
            return;
        }
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (messageHistory.length === 0) return;
        e.preventDefault();

        if (e.key === 'ArrowUp') {
            if (historyIndex === -1) {
                historyDraft = messageInput.value; // save current draft on first navigation
                historyIndex = messageHistory.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            messageInput.value = messageHistory[historyIndex];
        } else { // ArrowDown
            if (historyIndex === -1) return;
            if (historyIndex < messageHistory.length - 1) {
                historyIndex++;
                messageInput.value = messageHistory[historyIndex];
            } else {
                historyIndex = -1;
                messageInput.value = historyDraft;
            }
        }
        // Move cursor to end
        messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
    });

    // Event Listeners
    sendButton.addEventListener('click', () => { pushToHistory(messageInput.value); sendMessageToOllama(messageInput.value); });
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { pushToHistory(messageInput.value); sendMessageToOllama(messageInput.value); } });

    // Save draft as user types (debounced)
    let draftSaveTimeout;
    messageInput.addEventListener('input', () => {
        clearTimeout(draftSaveTimeout);
        draftSaveTimeout = setTimeout(async () => {
            const modelData = await loadModelChatState(currentModelName);
            if (modelData.activeConversationId && messageInput.value.trim()) {
                await saveDraft(modelData.activeConversationId, messageInput.value);
            }
        }, 500); // Save 500ms after user stops typing
    });

    // Scroll to bottom button
    const scrollToBottomButton = document.getElementById('scrollToBottomButton');
    if (scrollToBottomButton) {
        scrollToBottomButton.addEventListener('click', () => {
            scrollToBottom(true);
            isUserScrolledUp = false;
            scrollToBottomButton.style.display = 'none';
        });
    }

    clearChatButton.addEventListener('click', () => openClearContextModal());
    exportChatButton.addEventListener('click', exportConversation);

    newChatButton.addEventListener('click', () => startNewConversation(currentModelName));

    // Settings modal event listeners
    if (settingsButton) {
        settingsButton.addEventListener('click', openSettingsModal);
    }

    const modelParamsButton = document.getElementById('modelParamsButton');
    if (modelParamsButton) {
        modelParamsButton.addEventListener('click', () => {
            openSettingsModal();
            // Ensure the Model Parameters section is expanded
            const body = document.getElementById('paramSectionBody');
            const toggle = document.getElementById('paramSectionToggle');
            if (body && !body.classList.contains('expanded')) {
                body.classList.add('expanded');
                toggle.classList.add('expanded');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    if (closeSettingsModalButton) {
        closeSettingsModalButton.addEventListener('click', closeSettingsModal);
    }

    if (saveSystemPromptButton) {
        saveSystemPromptButton.addEventListener('click', saveSystemPrompt);
    }

    if (clearSystemPromptButton) {
        clearSystemPromptButton.addEventListener('click', clearSystemPrompt);
    }

    if (systemPromptInput) {
        systemPromptInput.addEventListener('input', updateSystemPromptTokenCount);
    }

    // Model parameter event listeners
    const paramSectionToggle = document.getElementById('paramSectionToggle');
    if (paramSectionToggle) {
        paramSectionToggle.addEventListener('click', toggleParamSection);
    }

    const paramResetButton = document.getElementById('paramResetButton');
    if (paramResetButton) {
        paramResetButton.addEventListener('click', resetParamInputs);
    }

    // Set up bidirectional slider ↔ number sync
    setupParamSync('paramTemperatureSlider', 'paramTemperature', 0.8);
    setupParamSync('paramTopPSlider', 'paramTopP', 0.9);
    setupParamSync('paramTopKSlider', 'paramTopK', 40);
    setupParamSync('paramRepeatPenaltySlider', 'paramRepeatPenalty', 1.1);

    // Collapsible section toggles for System Prompt, Context Window, TTS
    const systemPromptSectionToggle = document.getElementById('systemPromptSectionToggle');
    if (systemPromptSectionToggle) {
        systemPromptSectionToggle.addEventListener('click', () => toggleSection('systemPromptSectionToggle', 'systemPromptSectionBody'));
    }

    const contextWindowSectionToggle = document.getElementById('contextWindowSectionToggle');
    if (contextWindowSectionToggle) {
        contextWindowSectionToggle.addEventListener('click', () => toggleSection('contextWindowSectionToggle', 'contextWindowSectionBody'));
    }

    const ttsSectionToggle = document.getElementById('ttsSectionToggle');
    if (ttsSectionToggle) {
        ttsSectionToggle.addEventListener('click', () => toggleSection('ttsSectionToggle', 'ttsSectionBody'));
    }

    // Persona preset event listeners
    const personaSectionToggle = document.getElementById('personaSectionToggle');
    if (personaSectionToggle) {
        personaSectionToggle.addEventListener('click', togglePersonaSection);
    }

    const addNewPresetButton = document.getElementById('addNewPresetButton');
    if (addNewPresetButton) {
        addNewPresetButton.addEventListener('click', showNewPresetForm);
    }

    const saveNewPresetButton = document.getElementById('saveNewPresetButton');
    if (saveNewPresetButton) {
        saveNewPresetButton.addEventListener('click', saveNewPersonaPreset);
    }

    const cancelNewPresetButton = document.getElementById('cancelNewPresetButton');
    if (cancelNewPresetButton) {
        cancelNewPresetButton.addEventListener('click', hideNewPresetForm);
    }

    // Clear context modal event listeners
    if (closeClearContextModalButton) {
        closeClearContextModalButton.addEventListener('click', closeClearContextModal);
    }

    if (cancelClearContextButton) {
        cancelClearContextButton.addEventListener('click', closeClearContextModal);
    }

    if (confirmClearContextButton) {
        confirmClearContextButton.addEventListener('click', clearContextKeepingSystemPrompt);
    }

    // Close modals on backdrop click
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettingsModal();
        });
    }

    if (clearContextModal) {
        clearContextModal.addEventListener('click', (e) => {
            if (e.target === clearContextModal) closeClearContextModal();
        });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const inInput = document.activeElement === messageInput || document.activeElement === systemPromptInput;
        const anyModalOpen = (settingsModal && settingsModal.classList.contains('active')) ||
                             (clearContextModal && clearContextModal.classList.contains('active')) ||
                             (shortcutsModal && shortcutsModal.classList.contains('active'));

        // Escape: close modals or abort generation
        if (e.key === 'Escape') {
            if (settingsModal && settingsModal.classList.contains('active')) { closeSettingsModal(); return; }
            if (clearContextModal && clearContextModal.classList.contains('active')) { closeClearContextModal(); return; }
            if (shortcutsModal && shortcutsModal.classList.contains('active')) { closeShortcutsModal(); return; }
            if (dashboardModal && dashboardModal.classList.contains('active')) { closeDashboardModal(); return; }
            if (isStreaming && currentAbortController) {
                currentAbortController.abort();
            }
            return;
        }

        // Alt+H — show shortcuts panel
        if (e.key.toLowerCase() === 'h' && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            shortcutsModal && shortcutsModal.classList.contains('active') ? closeShortcutsModal() : openShortcutsModal();
            return;
        }

        // Don't fire Ctrl shortcuts when a modal is open or user is in system prompt textarea
        if (anyModalOpen || document.activeElement === systemPromptInput) return;

        // Alt+N — new chat (Ctrl+N is reserved by Chrome for new window)
        if (e.key.toLowerCase() === 'n' && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            startNewConversation(currentModelName);
        }

        if (e.ctrlKey && !e.shiftKey && !e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'd': {
                    e.preventDefault();
                    (async () => {
                        const modelData = await loadModelChatState(currentModelName);
                        if (modelData.activeConversationId) {
                            handleDeleteConversation(currentModelName, modelData.activeConversationId);
                        }
                    })();
                    break;
                }
                case 'r': {
                    e.preventDefault();
                    const botMessages = chatContainer.querySelectorAll('.bot-message');
                    const lastBot = botMessages[botMessages.length - 1];
                    if (lastBot) {
                        const ttsBtn = lastBot.querySelector('.tts-button');
                        const textDiv = lastBot.querySelector('.message-text-content');
                        if (ttsBtn && textDiv) speakText(textDiv, ttsBtn);
                    }
                    break;
                }
            }
        }
    });

    // Shortcuts modal event listeners
    if (closeShortcutsModalButton) {
        closeShortcutsModalButton.addEventListener('click', closeShortcutsModal);
    }
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) closeShortcutsModal();
        });
    }
    const openShortcutsFromSettings = document.getElementById('openShortcutsFromSettings');
    if (openShortcutsFromSettings) {
        openShortcutsFromSettings.addEventListener('click', () => {
            closeSettingsModal();
            openShortcutsModal();
        });
    }

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

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Small delay to ensure the page is fully visible before focusing
            setTimeout(() => messageInput.focus(), 100);
        }
    });

    // ===== TTS State =====
    // Web Speech API state
    let ttsUtterance = null;
    let isSpeaking = false;
    let availableVoices = [];

    // Kokoro TTS state
    let kokoroAbortController = null;
    let kokoroAudioContext = null;
    let kokoroSources = [];
    let kokoroVoicesCache = null;

    const PROXY_BASE = 'http://localhost:3000';

    // Load available Web Speech voices
    function loadWebSpeechVoices() {
        availableVoices = speechSynthesis.getVoices();
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadWebSpeechVoices;
    }

    // Get current TTS settings from storage
    async function getTTSSettings() {
        const settings = await chrome.storage.local.get('ttsSettings');
        return settings.ttsSettings || { engine: 'webSpeech', voice: 'Google US English' };
    }

    // ===== Main speak/stop dispatch =====

    async function speakText(textContentDiv, buttonElement) {
        if (isSpeaking) {
            stopSpeaking();
            return;
        }

        const rawText = textContentDiv.dataset.fullMessage || textContentDiv.textContent || '';
        const cleanText = rawText
            // Strip thinking tags
            .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
            .replace(/<thought[^>]*>[\s\S]*?<\/thought>/gi, '')
            // Strip markdown formatting
            .replace(/```[\s\S]*?```/g, ' code block ')      // fenced code blocks
            .replace(/`([^`]+)`/g, '$1')                      // inline code
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')         // images
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')          // links → keep text
            .replace(/^#{1,6}\s+/gm, '')                      // headings
            .replace(/(\*\*\*|___)(.*?)\1/g, '$2')            // bold+italic
            .replace(/(\*\*|__)(.*?)\1/g, '$2')               // bold
            .replace(/(\*|_)(.*?)\1/g, '$2')                  // italic
            .replace(/~~(.*?)~~/g, '$1')                      // strikethrough
            .replace(/^\s*[-*+]\s+/gm, '')                    // unordered list markers
            .replace(/^\s*\d+\.\s+/gm, '')                    // ordered list markers
            .replace(/^\s*>\s?/gm, '')                        // blockquotes
            .replace(/^---+$/gm, '')                          // horizontal rules
            .replace(/\|/g, ' ')                              // table pipes
            .replace(/\n{3,}/g, '\n\n')                       // collapse extra newlines
            .trim();

        if (!cleanText) {
            console.log('[TTS] No text to speak');
            return;
        }

        const settings = await getTTSSettings();

        if (settings.engine === 'kokoro') {
            await speakWithKokoro(cleanText, settings.voice, buttonElement);
        } else {
            await speakWithWebSpeech(cleanText, settings.voice, buttonElement);
        }
    }

    function stopSpeaking() {
        isSpeaking = false;

        // Stop Web Speech
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        ttsUtterance = null;

        // Stop Kokoro
        stopKokoroSpeech();

        // Reset all TTS buttons
        document.querySelectorAll('.tts-button.speaking, .tts-button.loading').forEach(btn => {
            resetTTSButton(btn);
        });
    }

    // ===== Web Speech API =====

    async function speakWithWebSpeech(text, voiceId, buttonElement) {
        try {
            setTTSButtonState(buttonElement, 'speaking');

            if (availableVoices.length === 0) {
                loadWebSpeechVoices();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const selectedVoice = availableVoices.find(v => v.voiceURI === voiceId) || availableVoices[0];
            console.log(`[TTS] Web Speech with voice: ${selectedVoice?.name || 'default'}`);

            ttsUtterance = new SpeechSynthesisUtterance(text);
            if (selectedVoice) ttsUtterance.voice = selectedVoice;
            ttsUtterance.rate = 1.0;
            ttsUtterance.pitch = 1.0;

            ttsUtterance.onstart = () => {
                isSpeaking = true;
                console.log('[TTS] Started speaking');
            };

            ttsUtterance.onend = () => {
                console.log('[TTS] Finished speaking');
                isSpeaking = false;
                resetTTSButton(buttonElement);
            };

            ttsUtterance.onerror = (event) => {
                if (event.error === 'interrupted') {
                    console.log('[TTS] Speech interrupted');
                } else {
                    console.error('[TTS] Speech error:', event.error);
                }
                isSpeaking = false;
                resetTTSButton(buttonElement);
            };

            isSpeaking = true;
            speechSynthesis.speak(ttsUtterance);
        } catch (error) {
            console.error('[TTS] Error speaking text:', error);
            isSpeaking = false;
            resetTTSButton(buttonElement);
        }
    }

    // ===== Kokoro TTS =====

    async function speakWithKokoro(text, voice, buttonElement) {
        try {
            setTTSButtonState(buttonElement, 'loading');
            isSpeaking = true;

            kokoroAbortController = new AbortController();
            const response = await fetch(`${PROXY_BASE}/api/tts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: voice || undefined }),
                signal: kokoroAbortController.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 503) {
                    console.log('[TTS] Kokoro model is loading, retrying in 3s...');
                    setTTSButtonState(buttonElement, 'loading');
                    await new Promise(r => setTimeout(r, 3000));
                    if (!isSpeaking) return;
                    return speakWithKokoro(text, voice, buttonElement);
                }
                throw new Error(errData.error || `Server error ${response.status}`);
            }

            const sampleRate = parseInt(response.headers.get('X-Sample-Rate')) || 24000;
            kokoroAudioContext = new AudioContext({ sampleRate });
            let scheduledTime = kokoroAudioContext.currentTime;

            setTTSButtonState(buttonElement, 'speaking');

            const reader = response.body.getReader();
            let leftover = new Uint8Array(0);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Combine leftover bytes with new data
                const combined = new Uint8Array(leftover.length + value.length);
                combined.set(leftover);
                combined.set(value, leftover.length);

                // Align to 4-byte float32 boundary
                const usableBytes = combined.length - (combined.length % 4);
                if (usableBytes === 0) {
                    leftover = combined;
                    continue;
                }

                leftover = combined.slice(usableBytes);
                const float32 = new Float32Array(combined.buffer.slice(combined.byteOffset, combined.byteOffset + usableBytes));

                // Create AudioBuffer and schedule playback
                const audioBuffer = kokoroAudioContext.createBuffer(1, float32.length, sampleRate);
                audioBuffer.getChannelData(0).set(float32);

                const source = kokoroAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(kokoroAudioContext.destination);

                // Schedule seamlessly after previous chunk
                const startTime = Math.max(scheduledTime, kokoroAudioContext.currentTime);
                source.start(startTime);
                scheduledTime = startTime + audioBuffer.duration;

                kokoroSources.push(source);
                source.onended = () => {
                    const idx = kokoroSources.indexOf(source);
                    if (idx !== -1) kokoroSources.splice(idx, 1);
                };
            }

            // Wait for all audio to finish playing
            const remainingTime = scheduledTime - kokoroAudioContext.currentTime;
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime * 1000 + 100));
            }

            isSpeaking = false;
            resetTTSButton(buttonElement);
            cleanupKokoroAudio();

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('[TTS] Kokoro playback aborted');
            } else {
                console.error('[TTS] Kokoro error:', error);
            }
            isSpeaking = false;
            resetTTSButton(buttonElement);
            cleanupKokoroAudio();
        }
    }

    function stopKokoroSpeech() {
        if (kokoroAbortController) {
            kokoroAbortController.abort();
            kokoroAbortController = null;
        }
        kokoroSources.forEach(source => {
            try { source.stop(); } catch (e) { /* already stopped */ }
        });
        kokoroSources = [];
        cleanupKokoroAudio();
    }

    function cleanupKokoroAudio() {
        if (kokoroAudioContext && kokoroAudioContext.state !== 'closed') {
            kokoroAudioContext.close().catch(() => {});
            kokoroAudioContext = null;
        }
    }

    // ===== TTS Button States =====

    function setTTSButtonState(buttonElement, state) {
        if (!buttonElement) return;
        buttonElement.innerHTML = '';
        buttonElement.classList.remove('speaking', 'loading');

        if (state === 'speaking') {
            buttonElement.appendChild(createLucideIcon('volume-x', 16));
            buttonElement.title = 'Stop';
            buttonElement.classList.add('speaking');
        } else if (state === 'loading') {
            buttonElement.appendChild(createLucideIcon('loader', 16));
            buttonElement.title = 'Loading...';
            buttonElement.classList.add('loading');
        }
    }

    function resetTTSButton(buttonElement) {
        if (!buttonElement) return;
        buttonElement.innerHTML = '';
        buttonElement.appendChild(createLucideIcon('audio-lines', 16));
        buttonElement.title = 'Read aloud';
        buttonElement.classList.remove('speaking', 'loading');
    }

    // ===== TTS Settings =====

    let kokoroStatusPollTimer = null;

    async function loadTTSSettings() {
        const settings = await chrome.storage.local.get('ttsSettings');
        const ttsSettings = settings.ttsSettings || { engine: 'webSpeech', voice: 'Google US English' };

        // Set engine radio
        const engineRadio = document.querySelector(`input[name="ttsEngine"][value="${ttsSettings.engine}"]`);
        if (engineRadio) engineRadio.checked = true;

        // Populate voices for the selected engine
        const voiceSelect = document.getElementById('ttsVoiceSelect');
        await populateVoicesForEngine(ttsSettings.engine, voiceSelect, ttsSettings.voice);

        // Show/hide Kokoro status and trigger model load if Kokoro is active
        updateKokoroStatusVisibility(ttsSettings.engine);
        if (ttsSettings.engine === 'kokoro') {
            triggerKokoroModelLoad();
        }

        // Listen for engine toggle changes
        document.querySelectorAll('input[name="ttsEngine"]').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                const engine = e.target.value;
                const select = document.getElementById('ttsVoiceSelect');
                const statusText = document.getElementById('ttsStatusText');
                await populateVoicesForEngine(engine, select);

                updateKokoroStatusVisibility(engine);

                if (engine === 'kokoro') {
                    if (statusText) statusText.textContent = 'Kokoro TTS runs on the proxy server';
                    triggerKokoroModelLoad();
                } else {
                    stopKokoroStatusPoll();
                    if (statusText) statusText.textContent = 'Click speaker icon on any response to hear it';
                }
            });
        });

        return ttsSettings;
    }

    function updateKokoroStatusVisibility(engine) {
        const statusEl = document.getElementById('kokoroModelStatus');
        if (statusEl) {
            statusEl.style.display = engine === 'kokoro' ? 'flex' : 'none';
        }
    }

    async function triggerKokoroModelLoad() {
        const statusEl = document.getElementById('kokoroModelStatus');
        const labelEl = document.getElementById('kokoroStatusLabel');
        if (!statusEl || !labelEl) return;

        // First, try to reach the proxy server directly
        try {
            const loadRes = await fetch(`${PROXY_BASE}/api/tts/load`, { method: 'POST' });
            if (loadRes.status === 404) {
                // Server is running but old code — need restart
                setKokoroStatusUI('loading', 'Restarting proxy server...');
                await requestProxyControl('restart');
                return;
            }
            if (!loadRes.ok) throw new Error(`Server error ${loadRes.status}`);
            const loadData = await loadRes.json();

            if (loadData.status === 'ready') {
                setKokoroStatusUI('ready', 'Model ready');
                return;
            }

            setKokoroStatusUI('loading', 'Downloading model (~86 MB)...');
            startKokoroStatusPoll();
            return;
        } catch (err) {
            // Server not reachable — try to auto-start via native messaging
            console.log('[TTS] Proxy not reachable, attempting auto-start...');
        }

        await requestProxyControl('start');
    }

    async function requestProxyControl(command) {
        setKokoroStatusUI('loading', command === 'restart' ? 'Restarting proxy server...' : 'Starting proxy server...');

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { action: 'proxyControl', command },
                    (resp) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(resp);
                        }
                    }
                );
            });

            if (response.needsSetup) {
                setKokoroStatusUI('error', 'One-time setup needed: run install-native-host.bat from the project folder');
                return;
            }

            if (response.status === 'started' || response.status === 'restarted' || response.status === 'already_running') {
                // Server is up — now trigger Kokoro model load
                setKokoroStatusUI('loading', 'Proxy server running. Loading Kokoro model...');
                // Wait a moment then try to trigger model load
                await new Promise(r => setTimeout(r, 1000));
                try {
                    const loadRes = await fetch(`${PROXY_BASE}/api/tts/load`, { method: 'POST' });
                    if (loadRes.ok) {
                        const data = await loadRes.json();
                        if (data.status === 'ready') {
                            setKokoroStatusUI('ready', 'Model ready');
                            return;
                        }
                    }
                } catch (e) { /* will poll */ }
                setKokoroStatusUI('loading', 'Downloading model (~86 MB)...');
                startKokoroStatusPoll();
            } else if (response.status === 'start_failed' || response.status === 'restart_failed') {
                setKokoroStatusUI('error', 'Failed to start proxy server. Check that Node.js is installed.');
            } else if (response.error) {
                setKokoroStatusUI('error', response.error);
            }
        } catch (err) {
            console.error('[TTS] Native messaging failed:', err);
            setKokoroStatusUI('error', 'One-time setup needed: run install-native-host.bat from the project folder');
        }
    }

    function setKokoroStatusUI(status, label) {
        const statusEl = document.getElementById('kokoroModelStatus');
        const labelEl = document.getElementById('kokoroStatusLabel');
        if (!statusEl || !labelEl) return;

        statusEl.className = 'kokoro-model-status status-' + status;
        statusEl.style.display = 'flex';
        labelEl.textContent = label;
    }

    function startKokoroStatusPoll() {
        stopKokoroStatusPoll();
        let failCount = 0;
        kokoroStatusPollTimer = setInterval(async () => {
            try {
                const res = await fetch(`${PROXY_BASE}/api/tts/status`);
                if (res.status === 404) {
                    // Server running old code without TTS endpoints
                    failCount++;
                    if (failCount >= 3) {
                        setKokoroStatusUI('error', 'Proxy server outdated. Stop it and run: cd proxy_server && npm start');
                        stopKokoroStatusPoll();
                    }
                    return;
                }
                if (!res.ok) return;
                failCount = 0;
                const data = await res.json();

                if (data.status === 'ready') {
                    setKokoroStatusUI('ready', 'Model ready');
                    stopKokoroStatusPoll();
                } else if (data.status === 'error') {
                    setKokoroStatusUI('error', 'Model failed to load: ' + (data.error || 'unknown error'));
                    stopKokoroStatusPoll();
                } else {
                    setKokoroStatusUI('loading', 'Downloading model (~86 MB)...');
                }
            } catch (err) {
                failCount++;
                if (failCount >= 5) {
                    setKokoroStatusUI('error', 'Lost connection to proxy server');
                    stopKokoroStatusPoll();
                }
            }
        }, 2000);
    }

    function stopKokoroStatusPoll() {
        if (kokoroStatusPollTimer) {
            clearInterval(kokoroStatusPollTimer);
            kokoroStatusPollTimer = null;
        }
    }

    async function populateVoicesForEngine(engine, voiceSelect, selectedVoice) {
        if (!voiceSelect) return;

        if (engine === 'kokoro') {
            await populateKokoroVoices(voiceSelect, selectedVoice);
        } else {
            populateWebSpeechVoices(voiceSelect, selectedVoice);
        }
    }

    function populateWebSpeechVoices(voiceSelect, selectedVoice) {
        if (!voiceSelect) return;

        if (availableVoices.length === 0) {
            loadWebSpeechVoices();
            if (availableVoices.length === 0) {
                setTimeout(() => {
                    loadWebSpeechVoices();
                    populateWebSpeechVoices(voiceSelect, selectedVoice);
                }, 500);
                return;
            }
        }

        voiceSelect.innerHTML = '';

        const voicesByLang = {};
        availableVoices.forEach(voice => {
            const lang = voice.lang.split('-')[0];
            if (!voicesByLang[lang]) voicesByLang[lang] = [];
            voicesByLang[lang].push(voice);
        });

        Object.keys(voicesByLang).sort().forEach(lang => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = lang.toUpperCase();
            voicesByLang[lang].forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = voice.name;
                optgroup.appendChild(option);
            });
            voiceSelect.appendChild(optgroup);
        });

        if (selectedVoice) voiceSelect.value = selectedVoice;
    }

    async function populateKokoroVoices(voiceSelect, selectedVoice) {
        if (!voiceSelect) return;
        voiceSelect.innerHTML = '<option value="">Loading Kokoro voices...</option>';

        try {
            if (!kokoroVoicesCache) {
                const response = await fetch(`${PROXY_BASE}/api/tts/voices`);
                if (response.status === 503) {
                    voiceSelect.innerHTML = '<option value="">Model loading, please wait...</option>';
                    setTimeout(() => populateKokoroVoices(voiceSelect, selectedVoice), 4000);
                    return;
                }
                if (!response.ok) throw new Error('Failed to fetch voices');
                const data = await response.json();
                kokoroVoicesCache = data.voices || [];
            }

            voiceSelect.innerHTML = '';

            if (kokoroVoicesCache.length === 0) {
                voiceSelect.innerHTML = '<option value="">No voices available</option>';
                return;
            }

            // Group voices by language
            const byLang = {};
            kokoroVoicesCache.forEach(v => {
                const lang = v.language || 'unknown';
                if (!byLang[lang]) byLang[lang] = [];
                byLang[lang].push(v);
            });

            const langLabels = { 'en-us': 'American English', 'en-gb': 'British English' };

            Object.entries(byLang).forEach(([lang, voices]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = langLabels[lang] || lang.toUpperCase();
                voices.forEach(v => {
                    const option = document.createElement('option');
                    option.value = v.id;
                    const genderIcon = v.gender === 'Female' ? '\u2640' : '\u2642';
                    option.textContent = `${v.name} ${genderIcon}${v.grade ? ' [' + v.grade + ']' : ''}`;
                    optgroup.appendChild(option);
                });
                voiceSelect.appendChild(optgroup);
            });

            if (selectedVoice) voiceSelect.value = selectedVoice;
            if (!voiceSelect.value && voiceSelect.options.length > 0) {
                voiceSelect.selectedIndex = 0;
            }
        } catch (error) {
            console.error('[TTS] Error fetching Kokoro voices:', error);
            voiceSelect.innerHTML = '<option value="">Could not load voices (is proxy server running?)</option>';
        }
    }

    async function saveTTSSettings() {
        const voiceSelect = document.getElementById('ttsVoiceSelect');
        const engineRadio = document.querySelector('input[name="ttsEngine"]:checked');
        if (!voiceSelect) return;

        const ttsSettings = {
            engine: engineRadio ? engineRadio.value : 'webSpeech',
            voice: voiceSelect.value
        };

        await chrome.storage.local.set({ ttsSettings });
        console.log('[TTS] Settings saved:', ttsSettings);

        // If Kokoro was selected, ensure model is pre-loaded
        if (ttsSettings.engine === 'kokoro') {
            triggerKokoroModelLoad();
        }

        stopKokoroStatusPoll();
    }

    // ─── Dashboard ────────────────────────────────────────────────────────────

    function dashFmt(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    async function computeDashboardStats() {
        // Ensure available models are loaded — fetchAvailableModels caches after first call
        await fetchAvailableModels();

        const allStorage = await chrome.storage.local.get(null);
        const stats = {
            totalTokens: 0,
            totalPromptTokens: 0,
            totalConversations: 0,
            totalUserMessages: 0,
            totalBotMessages: 0,
            totalImages: 0,
            speedSamples: [],
            modelStats: {},   // storageKey → { displayName, isCloud, installed, conversations, messages, tokens, speedSamples }
            dayActivity: {},  // 'YYYY-MM-DD' → message count
            longestConvMessages: 0,
            longestConvModel: '—',
        };

        // Build reverse-lookup without calling getModelStorageKey (avoids console spam)
        const sanitize = name => `${storageKeyPrefix}${name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const knownKeyToName = {};
        const installedKeys = new Set();
        for (const m of availableModels) {
            const k = sanitize(m.name);
            knownKeyToName[k] = m.name;
            installedKeys.add(k);
        }

        for (const [key, data] of Object.entries(allStorage)) {
            if (!key.startsWith(storageKeyPrefix)) continue;
            if (!data || typeof data !== 'object' || !data.conversations) continue;

            const displayName = knownKeyToName[key] || key.slice(storageKeyPrefix.length);
            const installed = installedKeys.has(key);
            // Use isCloudModel with the real display name now that availableModels is populated
            const cloud = isCloudModel(displayName);

            if (!stats.modelStats[key]) {
                stats.modelStats[key] = {
                    displayName,
                    isCloud: cloud,
                    installed,
                    conversations: 0,
                    messages: 0,
                    tokens: 0,
                    speedSamples: [],
                };
            }
            const ms = stats.modelStats[key];

            for (const conv of Object.values(data.conversations)) {
                const msgs = conv.messages || [];
                if (msgs.length === 0) continue;

                stats.totalConversations++;
                ms.conversations++;

                let convMsgCount = 0;
                for (const msg of msgs) {
                    stats.totalBotMessages += msg.role === 'assistant' ? 1 : 0;
                    ms.messages++;
                    convMsgCount++;

                    if (msg.role === 'user') {
                        stats.totalUserMessages++;
                        if (msg.images && msg.images.length > 0) {
                            stats.totalImages += msg.images.length;
                        }
                    }

                    if (msg.role === 'assistant' && msg.metadata) {
                        if (msg.metadata.tokens) {
                            stats.totalTokens += msg.metadata.tokens;
                            ms.tokens += msg.metadata.tokens;
                        }
                        if (msg.metadata.promptTokens) {
                            stats.totalPromptTokens += msg.metadata.promptTokens;
                        }
                        const spd = parseFloat(msg.metadata.speed);
                        if (!isNaN(spd) && spd > 0) {
                            stats.speedSamples.push(spd);
                            ms.speedSamples.push(spd);
                        }
                    }
                }

                if (convMsgCount > stats.longestConvMessages) {
                    stats.longestConvMessages = convMsgCount;
                    stats.longestConvModel = displayName;
                }

                if (conv.lastMessageTime) {
                    const day = new Date(conv.lastMessageTime).toISOString().split('T')[0];
                    stats.dayActivity[day] = (stats.dayActivity[day] || 0) + convMsgCount;
                }
            }
        }

        // Most active day
        let mostActiveDay = '—', mostActiveDayCount = 0;
        for (const [day, count] of Object.entries(stats.dayActivity)) {
            if (count > mostActiveDayCount) { mostActiveDayCount = count; mostActiveDay = day; }
        }
        stats.mostActiveDay = mostActiveDay;
        stats.mostActiveDayCount = mostActiveDayCount;

        // Average speed
        stats.avgSpeed = stats.speedSamples.length
            ? (stats.speedSamples.reduce((a, b) => a + b, 0) / stats.speedSamples.length).toFixed(1)
            : null;

        // Most used model (by total messages)
        let topModel = '—', topModelMessages = 0;
        for (const ms of Object.values(stats.modelStats)) {
            if (ms.messages > topModelMessages) { topModelMessages = ms.messages; topModel = ms.displayName; }
        }
        stats.topModel = topModel;
        stats.topModelMessages = topModelMessages;

        // Local / cloud counts — based on currently installed models, not storage history
        stats.localModels = availableModels.filter(m => !isCloudModel(m.name)).length;
        stats.cloudModels = availableModels.filter(m => isCloudModel(m.name)).length;

        return stats;
    }

    function renderDashboard(stats) {
        const content = document.getElementById('dashboardContent');
        if (!content) return;

        const hasData = stats.totalConversations > 0;

        if (!hasData) {
            content.innerHTML = `<div class="dashboard-empty">
                No chat history yet. Start a conversation to see your stats here.
            </div>`;
            content.style.display = '';
            document.getElementById('dashboardLoading').style.display = 'none';
            if (typeof lucide !== 'undefined') lucide.createIcons({ el: content });
            return;
        }

        // Sort: installed first (by messages), then archived (by messages)
        const sortedModels = Object.values(stats.modelStats).sort((a, b) => {
            if (a.installed !== b.installed) return a.installed ? -1 : 1;
            return b.messages - a.messages;
        });

        const cloudSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="#3b82f6" viewBox="0 0 16 16" title="Cloud model"><path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383z"/></svg>`;

        const modelRows = sortedModels.map((m, i) => {
            const avgSpd = m.speedSamples.length
                ? (m.speedSamples.reduce((a, b) => a + b, 0) / m.speedSamples.length).toFixed(1) + ' t/s'
                : '—';
            const cloudBadge = m.isCloud ? cloudSvg : '';
            const archivedBadge = !m.installed
                ? `<span style="font-size:10px;padding:1px 5px;background:rgba(115,115,115,0.15);color:var(--text-muted);border-radius:3px;margin-left:4px;">archived</span>`
                : '';
            const rowStyle = !m.installed ? 'opacity:0.55;' : '';
            return `<tr style="${rowStyle}">
                <td><div class="model-name-cell"><span class="model-rank">${i + 1}</span>${m.displayName}${cloudBadge}${archivedBadge}</div></td>
                <td>${m.conversations}</td>
                <td>${dashFmt(m.messages)}</td>
                <td>${m.tokens > 0 ? dashFmt(m.tokens) : '—'}</td>
                <td>${avgSpd}</td>
            </tr>`;
        }).join('');

        content.innerHTML = `
            <div class="dashboard-section">
                <div class="dashboard-stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon blue"><i data-lucide="zap"></i></div>
                        </div>
                        <div class="stat-value">${dashFmt(stats.totalTokens)}</div>
                        <div class="stat-label">Tokens Generated</div>
                        <div class="stat-sublabel">${dashFmt(stats.totalPromptTokens)} prompt tokens</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon purple"><i data-lucide="message-square"></i></div>
                        </div>
                        <div class="stat-value">${dashFmt(stats.totalUserMessages)}</div>
                        <div class="stat-label">Messages Sent</div>
                        <div class="stat-sublabel">${dashFmt(stats.totalBotMessages)} responses</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon green"><i data-lucide="folder-open"></i></div>
                        </div>
                        <div class="stat-value">${dashFmt(stats.totalConversations)}</div>
                        <div class="stat-label">Conversations</div>
                        <div class="stat-sublabel">${sortedModels.filter(m => m.installed).length} installed · ${sortedModels.filter(m => !m.installed).length} archived</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon amber"><i data-lucide="gauge"></i></div>
                        </div>
                        <div class="stat-value">${stats.avgSpeed !== null ? stats.avgSpeed : '—'}</div>
                        <div class="stat-label">Avg Speed</div>
                        <div class="stat-sublabel">tokens / second</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-section">
                <div class="dashboard-stats-grid-3">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon cyan"><i data-lucide="trophy"></i></div>
                        </div>
                        <div class="stat-value" style="font-size:1rem;word-break:break-word;">${stats.topModel}</div>
                        <div class="stat-label">Most Used Model</div>
                        <div class="stat-sublabel">${dashFmt(stats.topModelMessages)} messages</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon pink"><i data-lucide="image"></i></div>
                        </div>
                        <div class="stat-value">${dashFmt(stats.totalImages)}</div>
                        <div class="stat-label">Images Sent</div>
                        <div class="stat-sublabel">across all conversations</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon blue"><i data-lucide="server"></i></div>
                        </div>
                        <div class="local-cloud-split" style="margin-top:var(--space-xs);">
                            <div class="split-item">
                                <div class="split-value">${stats.localModels}</div>
                                <div class="split-label">Local</div>
                            </div>
                            <div class="split-divider"></div>
                            <div class="split-item">
                                <div class="split-value">${stats.cloudModels}</div>
                                <div class="split-label">Cloud</div>
                            </div>
                        </div>
                        <div class="stat-label" style="margin-top:var(--space-sm);">Models by Type</div>
                    </div>
                </div>
            </div>

            <div class="dashboard-section">
                <div class="dashboard-stats-grid-3">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon amber"><i data-lucide="calendar"></i></div>
                        </div>
                        <div class="stat-value" style="font-size:1rem;">${stats.mostActiveDay}</div>
                        <div class="stat-label">Most Active Day</div>
                        <div class="stat-sublabel">${stats.mostActiveDayCount > 0 ? dashFmt(stats.mostActiveDayCount) + ' messages' : '—'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon green"><i data-lucide="messages-square"></i></div>
                        </div>
                        <div class="stat-value">${stats.longestConvMessages}</div>
                        <div class="stat-label">Longest Conversation</div>
                        <div class="stat-sublabel" style="word-break:break-word;">${stats.longestConvModel}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <div class="stat-card-icon red"><i data-lucide="brain"></i></div>
                        </div>
                        <div class="stat-value">${dashFmt(stats.totalTokens + stats.totalPromptTokens)}</div>
                        <div class="stat-label">Total Tokens Processed</div>
                        <div class="stat-sublabel">input + output combined</div>
                    </div>
                </div>
            </div>

            ${sortedModels.length > 0 ? `
            <div class="dashboard-section">
                <div class="dashboard-section-title">Model Breakdown</div>
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>Model</th>
                            <th>Convs</th>
                            <th>Messages</th>
                            <th>Tokens</th>
                            <th>Avg Speed</th>
                        </tr>
                    </thead>
                    <tbody>${modelRows}</tbody>
                </table>
            </div>` : ''}
        `;

        document.getElementById('dashboardLoading').style.display = 'none';
        content.style.display = '';
        if (typeof lucide !== 'undefined') lucide.createIcons({ el: content });
    }

    async function openDashboardModal() {
        const modal = document.getElementById('dashboardModal');
        const content = document.getElementById('dashboardContent');
        const loading = document.getElementById('dashboardLoading');
        if (!modal) return;

        // Reset to loading state
        if (content) content.style.display = 'none';
        if (loading) loading.style.display = 'flex';
        modal.classList.add('active');
        if (typeof lucide !== 'undefined') lucide.createIcons({ el: loading });

        const stats = await computeDashboardStats();
        renderDashboard(stats);
    }

    function closeDashboardModal() {
        const modal = document.getElementById('dashboardModal');
        if (modal) modal.classList.remove('active');
        messageInput.focus();
    }

    // Dashboard event listeners
    const dashboardButton = document.getElementById('dashboardButton');
    if (dashboardButton) {
        dashboardButton.addEventListener('click', openDashboardModal);
    }

    const closeDashboardModalButton = document.getElementById('closeDashboardModal');
    if (closeDashboardModalButton) {
        closeDashboardModalButton.addEventListener('click', closeDashboardModal);
    }

    const dashboardModal = document.getElementById('dashboardModal');
    if (dashboardModal) {
        dashboardModal.addEventListener('click', (e) => {
            if (e.target === dashboardModal) closeDashboardModal();
        });
    }

    // ── Theme System ──────────────────────────────────────────────────────────

    const LIGHT_THEMES = new Set(['github-light', 'solarized-light', 'catppuccin-latte']);
    const HLJS_LIGHT_HREF = 'lib/github-light.min.css';
    const HLJS_DARK_HREF = 'lib/atom-one-dark.min.css';

    function applyTheme(themeId) {
        const root = document.documentElement;
        if (themeId === 'default-dark') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', themeId);
        }
        const hljsLink = document.getElementById('hljs-theme');
        if (hljsLink) {
            hljsLink.href = LIGHT_THEMES.has(themeId) ? HLJS_LIGHT_HREF : HLJS_DARK_HREF;
        }
        document.querySelectorAll('.theme-swatch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeId === themeId);
        });
    }

    async function loadSavedTheme() {
        try {
            const result = await chrome.storage.local.get(['activeTheme']);
            applyTheme(result.activeTheme || 'default-dark');
        } catch (e) {
            applyTheme('default-dark');
        }
    }

    document.querySelectorAll('.theme-swatch').forEach(btn => {
        btn.addEventListener('click', async () => {
            const themeId = btn.dataset.themeId;
            applyTheme(themeId);
            await chrome.storage.local.set({ activeTheme: themeId });
        });
    });

    await loadSavedTheme();

    // ─────────────────────────────────────────────────────────────────────────

    init();

});
