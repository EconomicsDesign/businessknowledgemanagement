-- Business Knowledge Management Tool Database Schema

-- Segments table - categorised business areas
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  colour TEXT DEFAULT '#3B82F6', -- Default blue colour for visual categorisation
  document_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Documents table - uploaded files and information
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  filename TEXT,
  content TEXT NOT NULL, -- Extracted text content
  file_type TEXT, -- pdf, txt, docx, etc.
  file_size INTEGER,
  segment_id INTEGER,
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  summary TEXT, -- AI-generated summary
  keywords TEXT, -- Comma-separated keywords for search
  confidence_score REAL DEFAULT 0, -- AI categorisation confidence
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL
);

-- Knowledge chunks table - for better search and retrieval
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Position in original document
  embedding_summary TEXT, -- Summary of this chunk for search
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Chat sessions table - track conversations
CREATE TABLE IF NOT EXISTS chat_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages table - store conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources TEXT, -- JSON array of source document IDs
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_segment_id ON documents(segment_id);
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_activity ON chat_sessions(last_activity);

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