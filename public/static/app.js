// Business Knowledge Management Tool - Frontend Application
let currentSessionId = null;
let segments = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    // Generate session ID for chat
    currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Load initial data
    await loadSegments();
    await loadDocuments();
    
    console.log('Business Knowledge Tool initialized');
}

function setupEventListeners() {
    // Upload method toggle
    document.querySelectorAll('input[name="upload-method"]').forEach(radio => {
        radio.addEventListener('change', toggleUploadMethod);
    });

    // File input
    const fileInput = document.getElementById('file-input');
    fileInput.addEventListener('change', handleFileSelect);

    // Upload form
    document.getElementById('upload-form').addEventListener('submit', handleDocumentUpload);

    // Chat input
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Drag and drop
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            document.getElementById('file-input').files = files;
            handleFileSelect({ target: { files: files } });
        }
    });
}

// Tab switching
function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active state from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('text-gray-500');
    });
    
    // Show selected tab content
    document.getElementById(tabName + '-content').classList.remove('hidden');
    
    // Activate selected tab
    const activeTab = document.getElementById(tabName + '-tab');
    activeTab.classList.add('border-blue-500', 'text-blue-600');
    activeTab.classList.remove('text-gray-500');

    // Load data if needed
    if (tabName === 'browse') {
        loadDocuments();
    } else if (tabName === 'chat') {
        loadChatHistory();
    }
}

function toggleUploadMethod() {
    const method = document.querySelector('input[name="upload-method"]:checked').value;
    const fileSection = document.getElementById('file-upload-section');
    const pasteSection = document.getElementById('paste-content-section');
    
    if (method === 'file') {
        fileSection.classList.remove('hidden');
        pasteSection.classList.add('hidden');
    } else {
        fileSection.classList.add('hidden');
        pasteSection.classList.remove('hidden');
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const file = files[0];
        const fileSize = formatFileSize(file.size);
        const fileType = getFileTypeDescription(file);
        
        document.querySelector('.upload-area p').innerHTML = `
            <strong>Selected:</strong> ${file.name}<br>
            <small class="text-gray-500">Size: ${fileSize} | Type: ${fileType}</small>
        `;
    }
}

function getFileTypeDescription(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    const typeMap = {
        'txt': 'Text Document',
        'pdf': 'PDF Document', 
        'docx': 'Word Document',
        'xlsx': 'Excel Spreadsheet',
        'csv': 'CSV Data',
        'jpg': 'JPEG Image',
        'jpeg': 'JPEG Image',
        'png': 'PNG Image',
        'gif': 'GIF Image',
        'webp': 'WebP Image'
    };
    return typeMap[ext] || file.type || 'Unknown';
}

// Load segments from API
async function loadSegments() {
    try {
        const response = await axios.get('/api/segments');
        if (response.data.success) {
            segments = response.data.segments;
            renderSegments();
            populateSegmentFilter();
        }
    } catch (error) {
        console.error('Failed to load segments:', error);
        showNotification('Failed to load business segments', 'error');
    }
}

function renderSegments() {
    const segmentsList = document.getElementById('segments-list');
    segmentsList.innerHTML = segments.map(segment => `
        <div class="segment-badge flex items-center justify-between p-3 rounded-lg border hover:shadow-md cursor-pointer" style="border-left: 4px solid ${segment.colour}">
            <div>
                <h3 class="font-medium text-gray-900">${segment.name}</h3>
                <p class="text-sm text-gray-600">${segment.description}</p>
            </div>
            <div class="text-right">
                <span class="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">
                    ${segment.document_count} docs
                </span>
            </div>
        </div>
    `).join('');
}

function populateSegmentFilter() {
    const filterSelect = document.getElementById('filter-segment');
    filterSelect.innerHTML = '<option value="">All Segments</option>' + 
        segments.map(segment => `<option value="${segment.id}">${segment.name}</option>`).join('');
}

// Document upload
async function handleDocumentUpload(event) {
    event.preventDefault();
    
    const title = document.getElementById('doc-title').value;
    const method = document.querySelector('input[name="upload-method"]:checked').value;
    
    if (!title.trim()) {
        showNotification('Please enter a document title', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);

    if (method === 'file') {
        const fileInput = document.getElementById('file-input');
        if (!fileInput.files[0]) {
            showNotification('Please select a file to upload', 'error');
            return;
        }
        formData.append('file', fileInput.files[0]);
    } else {
        const content = document.getElementById('doc-content').value;
        if (!content.trim()) {
            showNotification('Please enter document content', 'error');
            return;
        }
        formData.append('content', content);
    }

    try {
        showNotification('Processing document...', 'info');
        
        const response = await axios.post('/api/documents/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (response.data.success) {
            showNotification('Document uploaded and categorised successfully!', 'success');
            
            // Show upload result
            const resultDiv = document.getElementById('upload-result');
            const segment = segments.find(s => s.id === response.data.segmentId);
            resultDiv.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 class="font-medium text-green-900 mb-2">
                        <i class="fas fa-check-circle mr-2"></i>Upload Successful
                    </h4>
                    <p class="text-green-800 mb-2"><strong>Categorised as:</strong> ${segment ? segment.name : 'Unknown'}</p>
                    <p class="text-green-800 mb-2"><strong>Confidence:</strong> ${Math.round(response.data.confidence * 100)}%</p>
                    <p class="text-green-800"><strong>Summary:</strong> ${response.data.summary}</p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            
            // Reset form
            document.getElementById('upload-form').reset();
            document.querySelector('.upload-area p').textContent = 'Drop your file here or click to browse';
            
            // Reload segments to update counts
            await loadSegments();
            
        } else {
            const errorMsg = response.data.error || 'Upload failed';
            let errorDetails = '';
            
            // Add file type info if available
            if (response.data.fileType && response.data.fileName) {
                errorDetails += `\nFile: ${response.data.fileName} (${response.data.fileType})`;
            }
            if (response.data.supportedTypes) {
                errorDetails += `\nSupported types: ${response.data.supportedTypes}`;
            }
            
            showNotification(errorMsg + errorDetails, 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        const errorData = error.response?.data;
        let errorMsg = 'Upload failed: ';
        
        if (errorData?.error) {
            errorMsg += errorData.error;
            if (errorData.supportedTypes) {
                errorMsg += `\nSupported file types: ${errorData.supportedTypes}`;
            }
        } else {
            errorMsg += error.message;
        }
        
        showNotification(errorMsg, 'error');
    }
}

// Load and display documents
async function loadDocuments() {
    try {
        const segmentFilter = document.getElementById('filter-segment')?.value || '';
        const url = segmentFilter ? `/api/documents?segment=${segmentFilter}` : '/api/documents';
        
        const response = await axios.get(url);
        if (response.data.success) {
            renderDocuments(response.data.documents);
        }
    } catch (error) {
        console.error('Failed to load documents:', error);
        showNotification('Failed to load documents', 'error');
    }
}

function renderDocuments(documents) {
    const documentsList = document.getElementById('documents-list');
    
    if (documents.length === 0) {
        documentsList.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-folder-open text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600">No documents found</p>
                <p class="text-sm text-gray-500">Upload some documents to get started</p>
            </div>
        `;
        return;
    }

    documentsList.innerHTML = documents.map(doc => {
        const uploadDate = new Date(doc.upload_date).toLocaleDateString('en-GB');
        const segmentColour = doc.segment_colour || '#6B7280';
        
        return `
            <div class="border-b border-gray-200 py-4 hover:bg-gray-50 rounded-lg px-4 mb-2">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h3 class="text-lg font-medium text-gray-900 mb-1">${doc.title}</h3>
                        <div class="flex items-center space-x-4 mb-2">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" style="background-color: ${segmentColour}">
                                <i class="fas fa-tag mr-1"></i>
                                ${doc.segment_name || 'Uncategorised'}
                            </span>
                            <span class="text-sm text-gray-500">
                                <i class="fas fa-calendar mr-1"></i>
                                ${uploadDate}
                            </span>
                            ${doc.filename ? `
                                <span class="text-sm text-gray-500">
                                    <i class="fas fa-file mr-1"></i>
                                    ${doc.filename}
                                </span>
                            ` : ''}
                        </div>
                        <p class="text-gray-700 mb-2">${doc.summary || 'No summary available'}</p>
                        <div class="text-sm text-gray-500">
                            <span class="mr-4">
                                <i class="fas fa-file-alt mr-1"></i>
                                ${doc.file_type}
                            </span>
                            <span class="mr-4">
                                <i class="fas fa-database mr-1"></i>
                                ${formatFileSize(doc.file_size)}
                            </span>
                            ${doc.confidence_score > 0 ? `
                                <span>
                                    <i class="fas fa-brain mr-1"></i>
                                    ${Math.round(doc.confidence_score * 100)}% confidence
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Chat functionality
async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Clear input
    chatInput.value = '';
    
    // Add user message to chat
    addMessageToChat('user', message);
    
    // Show typing indicator
    const typingId = addMessageToChat('assistant', '<i class="fas fa-spinner fa-spin mr-2"></i>Thinking...');
    
    try {
        const response = await axios.post('/api/chat', {
            message: message,
            sessionId: currentSessionId
        });
        
        // Remove typing indicator
        document.getElementById(typingId).remove();
        
        if (response.data.success) {
            addMessageToChat('assistant', response.data.response, response.data.sources);
        } else {
            addMessageToChat('assistant', 'Sorry, I encountered an error processing your request.');
        }
    } catch (error) {
        // Remove typing indicator
        document.getElementById(typingId).remove();
        console.error('Chat error:', error);
        addMessageToChat('assistant', 'Sorry, I\'m having trouble connecting right now. Please try again.');
    }
}

function addMessageToChat(type, content, sources = null) {
    const chatMessages = document.getElementById('chat-messages');
    
    // Remove welcome message if it exists
    const welcomeMsg = chatMessages.querySelector('.text-center');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const isUser = type === 'user';
    
    const messageHTML = `
        <div id="${messageId}" class="mb-4 ${isUser ? 'text-right' : 'text-left'}">
            <div class="inline-block max-w-3xl">
                <div class="flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'} space-x-2">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full ${isUser ? 'bg-blue-600 ml-2' : 'bg-gray-600 mr-2'} flex items-center justify-center">
                        <i class="fas ${isUser ? 'fa-user' : 'fa-robot'} text-white text-sm"></i>
                    </div>
                    <div class="flex-1">
                        <div class="bg-${isUser ? 'blue' : 'gray'}-${isUser ? '600' : '100'} text-${isUser ? 'white' : 'gray-900'} rounded-lg px-4 py-2 shadow">
                            ${content}
                        </div>
                        ${sources && sources.length > 0 ? `
                            <div class="mt-2 text-sm text-gray-600">
                                <div class="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
                                    <p class="font-medium mb-2">
                                        <i class="fas fa-book mr-1"></i>
                                        Sources:
                                    </p>
                                    ${sources.map(source => `
                                        <div class="mb-1">
                                            <span class="font-medium">${source.title}</span>
                                            <span class="text-gray-500"> (${source.segment})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <div class="text-xs text-gray-500 mt-1">
                            ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.insertAdjacentHTML('beforeend', messageHTML);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageId;
}

async function loadChatHistory() {
    try {
        const response = await axios.get(`/api/chat/${currentSessionId}`);
        if (response.data.success) {
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = '';
            
            if (response.data.messages.length === 0) {
                chatMessages.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        <i class="fas fa-comments text-4xl mb-4 text-gray-400"></i>
                        <p>Start a conversation by asking about your business documents</p>
                    </div>
                `;
            } else {
                response.data.messages.forEach(msg => {
                    const sources = msg.sources ? JSON.parse(msg.sources) : null;
                    addMessageToChat(msg.message_type, msg.content, sources);
                });
            }
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${getNotificationClasses(type)}`;
    
    const icon = getNotificationIcon(type);
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${icon} mr-2"></i>
            <span class="flex-1">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-current opacity-70 hover:opacity-100">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationClasses(type) {
    switch (type) {
        case 'success': return 'bg-green-500 text-white';
        case 'error': return 'bg-red-500 text-white';
        case 'warning': return 'bg-yellow-500 text-white';
        default: return 'bg-blue-500 text-white';
    }
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}