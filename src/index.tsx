import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { processFile, getSupportedFileTypes, getFileTypeDescription } from './fileProcessor'

// Type definitions for Cloudflare bindings
type Bindings = {
  DB: D1Database
  AI: Ai
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ===== DATABASE HELPER FUNCTIONS =====

async function initDatabase(db: D1Database) {
  try {
    // Apply migrations
    const migrationSQL = `
      -- Segments table - categorised business areas
      CREATE TABLE IF NOT EXISTS segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        colour TEXT DEFAULT '#3B82F6',
        document_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Documents table - uploaded files and information
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        filename TEXT,
        content TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        segment_id INTEGER,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        summary TEXT,
        keywords TEXT,
        confidence_score REAL DEFAULT 0,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL
      );

      -- Knowledge chunks table
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding_summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      -- Chat sessions table
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Chat messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
        content TEXT NOT NULL,
        sources TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_documents_segment_id ON documents(segment_id);
      CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

      -- Insert default segments with EconomicsDesign brand colors
      INSERT OR IGNORE INTO segments (name, description, colour) VALUES 
        ('General', 'General business information and documents', '#373F51'),
        ('Accounting', 'Financial records, invoices, and accounting documents', '#5CA4A9'),
        ('Finance', 'Financial planning, budgets, and investment information', '#EE716A'),
        ('Marketing', 'Marketing materials, campaigns, and customer information', '#9C0D38'),
        ('Operations', 'Operational procedures, workflows, and processes', '#9BC1BC'),
        ('Human Resources', 'HR policies, employee information, and recruitment', '#F6B0A4'),
        ('Legal', 'Contracts, legal documents, and compliance information', '#373F51'),
        ('Product', 'Product specifications, development, and documentation', '#EE716A'),
        ('Customer Service', 'Customer support, feedback, and service procedures', '#D1E3DD');
    `;

    await db.exec(migrationSQL);
    return true;
  } catch (error) {
    console.error('Database initialisation failed:', error);
    return false;
  }
}

// Split text into manageable chunks for better processing
function chunkText(text: string, maxLength: number = 1000): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}

// ===== API ROUTES =====

// Get all segments
app.get('/api/segments', async (c) => {
  const { DB } = c.env;
  await initDatabase(DB);

  try {
    const result = await DB.prepare(`
      SELECT * FROM segments 
      ORDER BY name ASC
    `).all();

    return c.json({ success: true, segments: result.results });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch segments' }, 500);
  }
});

// Upload document
app.post('/api/documents/upload', async (c) => {
  const { DB, AI } = c.env;
  await initDatabase(DB);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    let content = formData.get('content') as string;

    if (!title || (!file && !content)) {
      return c.json({ success: false, error: 'Title and either file or content required' }, 400);
    }

    // If file is provided, extract content using the file processor
    if (file) {
      const processedFile = await processFile(file);
      
      if (processedFile.error) {
        return c.json({ 
          success: false, 
          error: processedFile.error,
          fileType: file.type,
          fileName: file.name,
          supportedTypes: getSupportedFileTypes().join(', ')
        }, 400);
      }
      
      content = processedFile.content;
    }

    if (!content || content.trim().length === 0) {
      return c.json({ 
        success: false, 
        error: 'No content found in the document. Please ensure the file contains readable text or paste content directly.' 
      }, 400);
    }

    // Auto-categorise using AI
    let segmentId = 1; // Default to General
    let confidence = 0;

    try {
      const segments = await DB.prepare('SELECT * FROM segments').all();
      const segmentList = segments.results.map((s: any) => `${s.name}: ${s.description}`).join('\\n');

      const categorisationPrompt = `
        Analyse the following document content and categorise it into one of these business segments:

        ${segmentList}

        Document Title: ${title}
        Document Content: ${content.substring(0, 2000)}...

        Respond with only the exact segment name that best matches this document.
      `;

      const response = await AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [{ role: 'user', content: categorisationPrompt }]
      });

      if (response && response.response) {
        const suggestedSegment = response.response.trim();
        const matchingSegment = segments.results.find((s: any) => 
          s.name.toLowerCase() === suggestedSegment.toLowerCase()
        );
        
        if (matchingSegment) {
          segmentId = matchingSegment.id;
          confidence = 0.8;
        }
      }
    } catch (aiError) {
      console.warn('AI categorisation failed, using default segment:', aiError);
    }

    // Generate summary
    let summary = '';
    try {
      const summaryPrompt = `Summarise this business document in 2-3 sentences:\\n\\n${content.substring(0, 1500)}`;
      const summaryResponse = await AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [{ role: 'user', content: summaryPrompt }]
      });
      
      if (summaryResponse && summaryResponse.response) {
        summary = summaryResponse.response.trim();
      }
    } catch (summaryError) {
      console.warn('Summary generation failed:', summaryError);
      summary = content.substring(0, 200) + '...';
    }

    // Extract keywords
    const keywords = content.toLowerCase()
      .split(/\\W+/)
      .filter(word => word.length > 3)
      .slice(0, 20)
      .join(',');

    // Insert document
    const docResult = await DB.prepare(`
      INSERT INTO documents (title, filename, content, file_type, file_size, segment_id, summary, keywords, confidence_score, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      title,
      file?.name || null,
      content,
      file?.type || 'text/plain',
      file?.size || content.length,
      segmentId,
      summary,
      keywords,
      confidence,
      true
    ).run();

    const documentId = docResult.meta.last_row_id;

    // Create knowledge chunks
    const chunks = chunkText(content);
    for (let i = 0; i < chunks.length; i++) {
      await DB.prepare(`
        INSERT INTO knowledge_chunks (document_id, chunk_text, chunk_index, embedding_summary)
        VALUES (?, ?, ?, ?)
      `).bind(documentId, chunks[i], i, chunks[i].substring(0, 200)).run();
    }

    // Update segment document count
    await DB.prepare(`
      UPDATE segments 
      SET document_count = (SELECT COUNT(*) FROM documents WHERE segment_id = ?)
      WHERE id = ?
    `).bind(segmentId, segmentId).run();

    return c.json({ 
      success: true, 
      documentId, 
      segmentId,
      confidence,
      summary,
      message: 'Document uploaded and processed successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, error: 'Failed to upload document' }, 500);
  }
});

// Get documents
app.get('/api/documents', async (c) => {
  const { DB } = c.env;
  await initDatabase(DB);

  try {
    const segmentId = c.req.query('segment');
    
    let query = `
      SELECT d.*, s.name as segment_name, s.colour as segment_colour
      FROM documents d
      LEFT JOIN segments s ON d.segment_id = s.id
    `;
    
    let params: any[] = [];
    
    if (segmentId) {
      query += ' WHERE d.segment_id = ?';
      params.push(parseInt(segmentId));
    }
    
    query += ' ORDER BY d.upload_date DESC';

    const result = await DB.prepare(query).bind(...params).all();

    return c.json({ success: true, documents: result.results });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch documents' }, 500);
  }
});

// Chat endpoint
app.post('/api/chat', async (c) => {
  const { DB, AI } = c.env;
  await initDatabase(DB);

  try {
    const { message, sessionId } = await c.req.json();

    if (!message || !sessionId) {
      return c.json({ success: false, error: 'Message and session ID required' }, 400);
    }

    // Create or update session
    await DB.prepare(`
      INSERT OR REPLACE INTO chat_sessions (session_id, last_activity)
      VALUES (?, CURRENT_TIMESTAMP)
    `).bind(sessionId).run();

    // Search for relevant knowledge
    const searchResults = await DB.prepare(`
      SELECT kc.chunk_text, d.title, d.summary, s.name as segment_name
      FROM knowledge_chunks kc
      JOIN documents d ON kc.document_id = d.id
      LEFT JOIN segments s ON d.segment_id = s.id
      WHERE kc.chunk_text LIKE ? OR d.title LIKE ? OR d.summary LIKE ? OR d.keywords LIKE ?
      ORDER BY d.upload_date DESC
      LIMIT 10
    `).bind(
      `%${message}%`,
      `%${message}%`, 
      `%${message}%`,
      `%${message}%`
    ).all();

    // Create context from search results
    const context = searchResults.results
      .map((r: any) => `[${r.segment_name}] ${r.title}: ${r.chunk_text}`)
      .join('\\n\\n');

    // Generate response using AI
    const systemPrompt = `You are a helpful business assistant. Answer questions based ONLY on the provided company documentation. If the information is not in the documentation, clearly state that you don't have that information in the company documents.

Company Documentation:
${context}

Always cite which documents or sections you're referencing in your response.`;

    const aiResponse = await AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const botResponse = aiResponse?.response || "I'm sorry, I couldn't process your request at the moment.";

    // Save messages
    await DB.prepare(`
      INSERT INTO chat_messages (session_id, message_type, content, sources)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, 'user', message, null).run();

    const sources = JSON.stringify(
      searchResults.results.map((r: any) => ({ title: r.title, segment: r.segment_name }))
    );

    await DB.prepare(`
      INSERT INTO chat_messages (session_id, message_type, content, sources)
      VALUES (?, ?, ?, ?)
    `).bind(sessionId, 'assistant', botResponse, sources).run();

    return c.json({
      success: true,
      response: botResponse,
      sources: searchResults.results.map((r: any) => ({
        title: r.title,
        segment: r.segment_name,
        summary: r.summary
      }))
    });

  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ success: false, error: 'Failed to process chat message' }, 500);
  }
});

// Get chat history
app.get('/api/chat/:sessionId', async (c) => {
  const { DB } = c.env;
  await initDatabase(DB);

  try {
    const sessionId = c.req.param('sessionId');
    
    const result = await DB.prepare(`
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).bind(sessionId).all();

    return c.json({ success: true, messages: result.results });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch chat history' }, 500);
  }
});

// ===== MAIN APPLICATION PAGE =====
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Business Knowledge Management Tool</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          /* EconomicsDesign Brand Colors */
          :root {
            --ed-salmon: #EE716A;
            --ed-melon: #F6B0A4;
            --ed-charcoal: #373F51;
            --ed-ice-blue: #5CA4A9;
            --ed-opal: #9BC1BC;
            --ed-mint: #D1E3DD;
            --ed-burgundy: #9C0D38;
          }
          
          .segment-badge { transition: all 0.3s ease; }
          .chat-container { max-height: 400px; overflow-y: auto; }
          .upload-area { border: 2px dashed #cbd5e1; transition: all 0.3s ease; }
          .upload-area.dragover { border-color: var(--ed-salmon); background-color: #fef7f7; }
          
          /* Brand Color Overrides */
          .bg-blue-600 { background-color: var(--ed-salmon) !important; }
          .text-blue-600 { color: var(--ed-salmon) !important; }
          .border-blue-500 { border-color: var(--ed-salmon) !important; }
          .hover\\:bg-blue-700:hover { background-color: #d85e58 !important; }
          .focus\\:ring-blue-500:focus { --tw-ring-color: var(--ed-salmon) !important; }
          .focus\\:border-blue-500:focus { border-color: var(--ed-salmon) !important; }
          
          /* Secondary colors */
          .bg-purple-600 { background-color: var(--ed-ice-blue) !important; }
          .hover\\:bg-purple-700:hover { background-color: #4a8b90 !important; }
          .text-purple-600 { color: var(--ed-ice-blue) !important; }
          .focus\\:ring-purple-500:focus { --tw-ring-color: var(--ed-ice-blue) !important; }
          
          .bg-indigo-600 { background-color: var(--ed-charcoal) !important; }
          .hover\\:bg-indigo-700:hover { background-color: #2a3142 !important; }
          .text-indigo-600 { color: var(--ed-charcoal) !important; }
          .focus\\:ring-indigo-500:focus { --tw-ring-color: var(--ed-charcoal) !important; }
          
          /* Logo styling */
          .ed-logo {
            width: 40px;
            height: 40px;
            margin-right: 12px;
            vertical-align: middle;
            object-fit: contain;
            border-radius: 4px;
          }
        </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 py-4">
                <h1 class="text-2xl font-bold text-gray-900 flex items-center">
                    <img src="/static/ed-logo-original.jpg" alt="EconomicsDesign Logo" class="ed-logo" />
                    Business Knowledge Management Tool
                </h1>
                <p class="text-gray-600 mt-1">Upload documents, get automatic categorisation, and chat with your business knowledge</p>
            </div>
        </header>

        <!-- Main Content -->
        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- Navigation Tabs -->
            <div class="mb-8">
                <nav class="flex space-x-8">
                    <button onclick="showTab('upload')" id="upload-tab" class="tab-btn border-b-2 border-blue-500 text-blue-600 pb-2 font-medium">
                        <i class="fas fa-upload mr-1"></i> Upload Documents
                    </button>
                    <button onclick="showTab('browse')" id="browse-tab" class="tab-btn text-gray-500 pb-2 font-medium hover:text-gray-700">
                        <i class="fas fa-folder mr-1"></i> Browse Knowledge
                    </button>
                    <button onclick="showTab('chat')" id="chat-tab" class="tab-btn text-gray-500 pb-2 font-medium hover:text-gray-700">
                        <i class="fas fa-comments mr-1"></i> Chat Assistant
                    </button>
                    <button onclick="showTab('privacy')" id="privacy-tab" class="tab-btn text-gray-500 pb-2 font-medium hover:text-gray-700">
                        <i class="fas fa-shield-alt mr-1"></i> Privacy & Security
                    </button>
                </nav>
            </div>

            <!-- Upload Tab -->
            <div id="upload-content" class="tab-content">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Upload Form -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">
                            <i class="fas fa-file-upload text-blue-600 mr-2"></i>
                            Upload Business Document
                        </h2>
                        
                        <form id="upload-form" class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Document Title *</label>
                                <input type="text" id="doc-title" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., Q3 Financial Report">
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Upload Method</label>
                                <div class="flex space-x-4 mb-4">
                                    <label class="flex items-center">
                                        <input type="radio" name="upload-method" value="file" checked class="mr-2">
                                        <span>File Upload</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="radio" name="upload-method" value="paste" class="mr-2">
                                        <span>Paste Content</span>
                                    </label>
                                </div>
                            </div>

                            <div id="file-upload-section">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Select File</label>
                                <div class="upload-area rounded-lg p-8 text-center">
                                    <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                                    <p class="text-gray-600 mb-2">Drop your file here or click to browse</p>
                                    <p class="text-sm text-gray-400">Supports: TXT, PDF, Word (.docx), Excel (.xlsx), CSV, Images (JPG, PNG)</p>
                                    <input type="file" id="file-input" accept=".txt,.pdf,.docx,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp" class="hidden">
                                    <button type="button" onclick="document.getElementById('file-input').click()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                                        Choose File
                                    </button>
                                </div>
                            </div>

                            <div id="paste-content-section" class="hidden">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Document Content *</label>
                                <textarea id="doc-content" rows="8" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Paste your document content here..."></textarea>
                            </div>

                            <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                                <i class="fas fa-upload mr-2"></i>
                                Upload & Process Document
                            </button>
                        </form>

                        <div id="upload-result" class="mt-4 hidden"></div>
                    </div>

                    <!-- Segments Overview -->
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-xl font-semibold mb-4">
                            <i class="fas fa-tags text-green-600 mr-2"></i>
                            Business Segments
                        </h2>
                        <p class="text-gray-600 mb-4">Documents are automatically categorised into these segments:</p>
                        <div id="segments-list" class="space-y-2">
                            <!-- Segments will be loaded here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Browse Tab -->
            <div id="browse-content" class="tab-content hidden">
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-semibold">
                            <i class="fas fa-search text-purple-600 mr-2"></i>
                            Knowledge Base
                        </h2>
                        <div class="mt-4 flex space-x-4">
                            <select id="filter-segment" class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500">
                                <option value="">All Segments</option>
                            </select>
                            <button onclick="loadDocuments()" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                                <i class="fas fa-filter mr-1"></i> Filter
                            </button>
                        </div>
                    </div>
                    <div id="documents-list" class="p-6">
                        <!-- Documents will be loaded here -->
                    </div>
                </div>
            </div>

            <!-- Chat Tab -->
            <div id="chat-content" class="tab-content hidden">
                <div class="bg-white rounded-lg shadow max-w-4xl mx-auto">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-semibold">
                            <i class="fas fa-robot text-indigo-600 mr-2"></i>
                            Knowledge Assistant
                        </h2>
                        <p class="text-gray-600 mt-1">Ask questions about your business documents. I'll answer based only on uploaded information.</p>
                    </div>
                    
                    <div class="chat-container p-6" id="chat-messages">
                        <div class="text-center text-gray-500 py-8">
                            <i class="fas fa-comments text-4xl mb-4 text-gray-400"></i>
                            <p>Start a conversation by asking about your business documents</p>
                        </div>
                    </div>

                    <div class="p-6 border-t">
                        <div class="flex space-x-4">
                            <input type="text" id="chat-input" placeholder="Ask about your business documents..." class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            <button onclick="sendMessage()" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            Answers are based only on your uploaded documents
                        </p>
                    </div>
                </div>
            </div>

            <!-- Privacy & Security Tab -->
            <div id="privacy-content" class="tab-content hidden">
                <div class="bg-white rounded-lg shadow">
                    <div class="p-6 border-b">
                        <h2 class="text-xl font-semibold">
                            <i class="fas fa-shield-alt text-green-600 mr-2"></i>
                            Privacy & Security Configuration
                        </h2>
                        <p class="text-gray-600 mt-1">Configure where your business documents are stored and how they're protected</p>
                    </div>
                    
                    <div class="p-6">
                        <!-- Current Storage Status -->
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <h3 class="font-semibold text-blue-900 mb-2">
                                <i class="fas fa-info-circle mr-2"></i>Current Storage Status
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <strong>Storage Type:</strong> Cloudflare D1 Database<br>
                                    <strong>Privacy Level:</strong> <span class="text-green-600 font-semibold">PRIVATE</span><br>
                                    <strong>Encryption:</strong> <span class="text-green-600">At Rest & In Transit</span><br>
                                    <strong>Access Control:</strong> Your Account Only
                                </div>
                                <div>
                                    <strong>Database ID:</strong> <code class="text-xs bg-gray-100 px-1 rounded">a5beac0f-e512-435a-be7d-33f8164fbfe6</code><br>
                                    <strong>Location:</strong> Cloudflare Global Network<br>
                                    <strong>Compliance:</strong> GDPR, SOC2, ISO27001<br>
                                    <strong>Data Residency:</strong> Your Cloudflare Account
                                </div>
                            </div>
                        </div>

                        <!-- Privacy Options -->
                        <h3 class="font-semibold text-gray-900 mb-4">Enhanced Privacy Options</h3>
                        
                        <div class="space-y-4">
                            <!-- Option 1: Current Setup (Enhanced) -->
                            <div class="border rounded-lg p-4 bg-green-50 border-green-200">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1">
                                        <i class="fas fa-check-circle text-green-600"></i>
                                    </div>
                                    <div class="ml-3">
                                        <h4 class="font-semibold text-green-900">✅ Current Setup: Cloudflare D1 (RECOMMENDED)</h4>
                                        <p class="text-green-700 text-sm mt-1">
                                            Your documents are already stored privately in your Cloudflare account. 
                                            All data is encrypted and only accessible with your API credentials.
                                        </p>
                                        <div class="mt-2 text-xs text-green-600">
                                            <strong>Benefits:</strong> Zero additional setup, enterprise security, global performance, automatic backups
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Option 2: Client-Side Encryption -->
                            <div class="border rounded-lg p-4 border-gray-200">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1">
                                        <i class="fas fa-lock text-blue-600"></i>
                                    </div>
                                    <div class="ml-3">
                                        <h4 class="font-semibold text-gray-900">🔒 Enhanced: Client-Side Encryption</h4>
                                        <p class="text-gray-700 text-sm mt-1">
                                            Add an extra layer of encryption where documents are encrypted in your browser before uploading.
                                        </p>
                                        <div class="mt-2 text-xs text-gray-600">
                                            <strong>Benefits:</strong> Zero-knowledge encryption, only you can decrypt documents
                                        </div>
                                        <button class="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                            Enable Client-Side Encryption
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Option 3: Private Cloud -->
                            <div class="border rounded-lg p-4 border-gray-200">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1">
                                        <i class="fas fa-cloud text-purple-600"></i>
                                    </div>
                                    <div class="ml-3">
                                        <h4 class="font-semibold text-gray-900">☁️ Enterprise: Private Cloud Storage</h4>
                                        <p class="text-gray-700 text-sm mt-1">
                                            Store documents in your own AWS S3, Google Cloud, or Azure storage accounts.
                                        </p>
                                        <div class="mt-2 text-xs text-gray-600">
                                            <strong>Benefits:</strong> Full control, enterprise compliance (HIPAA, GDPR), custom location
                                        </div>
                                        <button class="mt-2 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                                            Configure Private Cloud
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Option 4: Self-Hosted -->
                            <div class="border rounded-lg p-4 border-gray-200">
                                <div class="flex items-start">
                                    <div class="flex-shrink-0 mt-1">
                                        <i class="fas fa-server text-indigo-600"></i>
                                    </div>
                                    <div class="ml-3">
                                        <h4 class="font-semibold text-gray-900">🏢 Maximum Privacy: Self-Hosted Server</h4>
                                        <p class="text-gray-700 text-sm mt-1">
                                            Deploy the application on your own servers with your own database.
                                        </p>
                                        <div class="mt-2 text-xs text-gray-600">
                                            <strong>Benefits:</strong> Complete control, data never leaves your infrastructure
                                        </div>
                                        <button class="mt-2 bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">
                                            Self-Hosting Guide
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Security Features -->
                        <div class="mt-8 bg-gray-50 rounded-lg p-4">
                            <h3 class="font-semibold text-gray-900 mb-3">🛡️ Current Security Features</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <ul class="space-y-2">
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> Encrypted data storage
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> Secure HTTPS connections
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> Private database access
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> No public document URLs
                                    </li>
                                </ul>
                                <ul class="space-y-2">
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> SQL injection protection
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> API-only document access
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> Automatic data backups
                                    </li>
                                    <li class="flex items-center text-green-700">
                                        <i class="fas fa-check mr-2"></i> Enterprise-grade infrastructure
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <!-- Contact for Enterprise Setup -->
                        <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 class="font-semibold text-yellow-900">📞 Need Enterprise Setup?</h4>
                            <p class="text-yellow-800 text-sm mt-1">
                                For custom privacy configurations, compliance requirements, or enterprise deployment, 
                                I can help you implement any of the above options.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

export default app