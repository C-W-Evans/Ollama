document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const stopButton = document.getElementById('stopButton');
    const chatDisplay = document.getElementById('chatDisplay');
    const generatingIndicator = document.getElementById('generatingIndicator');
    const conversationList = document.getElementById('conversationList');
    const newConversationButton = document.getElementById('newConversationButton');
    const currentConversationTitle = document.getElementById('currentConversationTitle');
    const renameButton = document.getElementById('renameButton');
    const deleteButton = document.getElementById('deleteButton');
    const themeToggleButton = document.getElementById('themeToggleButton');
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    // State variables
    let controller = null;
    let currentConversationId = null;
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') sendMessage();
    });
    stopButton.addEventListener('click', stopGeneration);
    newConversationButton.addEventListener('click', createNewConversation);
    renameButton.addEventListener('click', showRenameModal);
    deleteButton.addEventListener('click', deleteCurrentConversation);
    themeToggleButton.addEventListener('click', toggleTheme);
    
    // Initialize the app
    initApp();
    
    // Functions
    async function initApp() {
        await loadConversations();
        enableConversationButtons(false);
        loadThemePreference();
    }
    
    // Theme functions
    function toggleTheme() {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        updateThemeUI(isDarkMode);
        localStorage.setItem('darkMode', isDarkMode);
    }
    
    function loadThemePreference() {
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-mode');
        }
        updateThemeUI(darkMode);
    }
    
    function updateThemeUI(isDarkMode) {
        if (isDarkMode) {
            themeIcon.className = 'fas fa-sun theme-icon';
            themeText.textContent = 'Light Mode';
        } else {
            themeIcon.className = 'fas fa-moon theme-icon';
            themeText.textContent = 'Dark Mode';
        }
    }
    
    async function loadConversations() {
        try {
            const response = await fetch('http://localhost:5000/conversations');
            const conversations = await response.json();
            
            // Clear the conversation list
            conversationList.innerHTML = '';
            
            // Add each conversation to the list
            conversations.forEach(conversation => {
                const item = document.createElement('div');
                item.classList.add('conversation-item');
                if (conversation.id === currentConversationId) {
                    item.classList.add('active-conversation');
                }
                item.textContent = conversation.name;
                item.dataset.id = conversation.id;
                item.addEventListener('click', () => loadConversation(conversation.id));
                conversationList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }
    
    async function createNewConversation() {
        try {
            // Clear the chat display
            chatDisplay.innerHTML = '';
            
            // Create a new conversation
            const response = await fetch('http://localhost:5000/conversations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: 'New Conversation' }),
            });
            
            if (!response.ok) throw new Error('Failed to create conversation');
            
            const conversation = await response.json();
            currentConversationId = conversation.id;
            currentConversationTitle.textContent = conversation.name;
            
            // Enable the conversation buttons
            enableConversationButtons(true);
            
            // Reload the conversation list
            await loadConversations();
        } catch (error) {
            console.error('Error creating new conversation:', error);
        }
    }
    
    async function loadConversation(conversationId) {
        try {
            const response = await fetch(`http://localhost:5000/conversations/${conversationId}`);
            
            if (!response.ok) throw new Error('Failed to load conversation');
            
            const conversation = await response.json();
            
            // Update state
            currentConversationId = conversation.id;
            currentConversationTitle.textContent = conversation.name;
            
            // Enable the conversation buttons
            enableConversationButtons(true);
            
            // Clear the chat display
            chatDisplay.innerHTML = '';
            
            // Add each message to the chat display
            conversation.messages.forEach(message => {
                const sender = message.role === 'user' ? 'user' : 'bot';
                displayMessage(message.content, sender);
            });
            
            // Update the active conversation in the list
            const conversationItems = document.querySelectorAll('.conversation-item');
            conversationItems.forEach(item => {
                if (parseInt(item.dataset.id) === conversationId) {
                    item.classList.add('active-conversation');
                } else {
                    item.classList.remove('active-conversation');
                }
            });
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    }
    
    async function deleteCurrentConversation() {
        if (!currentConversationId) return;
        
        if (!confirm('Are you sure you want to delete this conversation?')) return;
        
        try {
            const response = await fetch(`http://localhost:5000/conversations/${currentConversationId}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) throw new Error('Failed to delete conversation');
            
            // Clear the chat display
            chatDisplay.innerHTML = '';
            currentConversationId = null;
            currentConversationTitle.textContent = 'New Conversation';
            
            // Disable the conversation buttons
            enableConversationButtons(false);
            
            // Reload the conversation list
            await loadConversations();
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    }
    
    function showRenameModal() {
        if (!currentConversationId) return;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('renameModal');
        
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'renameModal';
            modal.classList.add('modal');
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Rename Conversation</h3>
                        <button class="close-button" id="closeModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="text" id="conversationNameInput" placeholder="Enter new name">
                    </div>
                    <div class="modal-footer">
                        <button id="cancelRename">Cancel</button>
                        <button id="confirmRename">Rename</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            document.getElementById('closeModal').addEventListener('click', () => modal.style.display = 'none');
            document.getElementById('cancelRename').addEventListener('click', () => modal.style.display = 'none');
            document.getElementById('confirmRename').addEventListener('click', renameConversation);
            
            // Close when clicking outside
            modal.addEventListener('click', e => {
                if (e.target === modal) modal.style.display = 'none';
            });
        }
        
        // Show the modal and set the current name
        document.getElementById('conversationNameInput').value = currentConversationTitle.textContent;
        modal.style.display = 'flex';
    }
    
    async function renameConversation() {
        if (!currentConversationId) return;
        
        const nameInput = document.getElementById('conversationNameInput');
        const newName = nameInput.value.trim();
        
        if (!newName) return;
        
        try {
            const response = await fetch(`http://localhost:5000/conversations/${currentConversationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: newName }),
            });
            
            if (!response.ok) throw new Error('Failed to rename conversation');
            
            // Update the conversation title
            currentConversationTitle.textContent = newName;
            
            // Hide the modal
            document.getElementById('renameModal').style.display = 'none';
            
            // Reload the conversation list
            await loadConversations();
        } catch (error) {
            console.error('Error renaming conversation:', error);
        }
    }
    
    function enableConversationButtons(enabled) {
        renameButton.disabled = !enabled;
        deleteButton.disabled = !enabled;
    }
    
    function stopGeneration() {
        if (controller) {
            controller.abort();
            controller = null;
            stopButton.disabled = true;
            generatingIndicator.textContent = 'Generation stopped.';
            setTimeout(() => {
                generatingIndicator.textContent = '';
            }, 2000);
        }
    }
    
    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;
        
        // Create a new conversation if none exists
        if (!currentConversationId) {
            createNewConversation().then(() => {
                // After creating the conversation, send the message
                processSendMessage(message);
            });
        } else {
            processSendMessage(message);
        }
    }
    
    function processSendMessage(message) {
        displayMessage(message, 'user');
        messageInput.value = '';
        generatingIndicator.textContent = 'Generating...';
        
        stopButton.disabled = false;
        controller = new AbortController();
        
        let botResponse = '';
        let lastSegments = [];
        let repeatCounter = 0;
        
        fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                conversation_id: currentConversationId
            }),
            signal: controller.signal
        })
        .then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            function readStream() {
                return reader.read().then(({ done, value }) => {
                    if (done) {
                        generatingIndicator.textContent = '';
                        return;
                    }
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const eventData = line.slice(6); // Remove 'data: ' prefix
                            
                            if (eventData === '[DONE]') {
                                generatingIndicator.textContent = '';
                                return;
                            }
                            
                            try {
                                const data = JSON.parse(eventData);
                                if (data.response) {
                                    botResponse += data.response;
                                    
                                    // Detection for repetitive patterns
                                    if (botResponse.length > 100) {
                                        // Check for repetitive segments
                                        const lastSegment = botResponse.slice(-50);
                                        if (lastSegments.includes(lastSegment)) {
                                            repeatCounter++;
                                            if (repeatCounter > 2) {
                                                console.log("Detected repetitive pattern, stopping generation");
                                                reader.cancel();
                                                generatingIndicator.textContent = '[Stopped due to repetition]';
                                                return;
                                            }
                                        } else {
                                            repeatCounter = 0;
                                        }
                                        
                                        lastSegments.push(lastSegment);
                                        if (lastSegments.length > 5) lastSegments.shift();
                                    }
                                    
                                    const lastResponseDiv = chatDisplay.lastElementChild;
                                    if (lastResponseDiv && lastResponseDiv.classList.contains('bot-message')) {
                                        lastResponseDiv.textContent = botResponse;
                                    } else {
                                        displayMessage(botResponse, 'bot');
                                    }
                                } else if (data.error) {
                                    displayMessage(`Error: ${data.error}`, 'bot-error');
                                    generatingIndicator.textContent = '';
                                    return;
                                }
                            } catch (error) {
                                console.error('Error parsing event data:', error, eventData);
                            }
                        }
                    }
                    
                    return readStream();
                });
            }
            
            return readStream();
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Fetch error:', error);
                displayMessage('Connection error with the server.', 'bot-error');
            }
            stopButton.disabled = true;
            generatingIndicator.textContent = '';
        })
        .finally(() => {
            stopButton.disabled = true;
        });
    }
    
    function displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender + '-message');
        messageDiv.textContent = message;
        chatDisplay.appendChild(messageDiv);
        chatDisplay.scrollTop = chatDisplay.scrollHeight;
    }
});