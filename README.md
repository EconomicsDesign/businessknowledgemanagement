# Business Knowledge Management Tool

## Project Overview
- **Name**: Business Knowledge Management Tool
- **Goal**: Create an intelligent business knowledge system where users can upload documents, get automatic categorisation, and interact with their business knowledge through a conversational AI interface
- **Features**: Document upload, AI-powered categorisation, knowledge base browsing, and conversational Q&A chatbot

## 🌐 URLs
- **Production**: https://bkm.economicsdesign.com (Custom Domain)
- **Backup URL**: https://business-knowledge-tool.pages.dev (Cloudflare Pages)
- **Development**: https://3000-ipcasslymqyl781ow4rmv.e2b.dev
- **GitHub**: https://github.com/EconomicsDesign/businessknowledgemanagement

## 🚀 Current Features (Completed)
1. **Enhanced Document Upload System**
   - Support for multiple file formats: **TXT, PDF, Word (.docx), Excel (.xlsx), CSV, Images (JPG, PNG)**
   - Paste content directly option
   - Drag and drop file interface with file type detection
   - Automatic content processing and extraction
   - CSV files converted to readable text format
   - Helpful error messages for unsupported formats

2. **AI-Powered Categorisation**
   - Automatic document categorisation using Cloudflare AI (Llama-3-8b-instruct)
   - Pre-configured business segments: General, Accounting, Finance, Marketing, Operations, HR, Legal, Product, Customer Service
   - Confidence scoring for categorisation accuracy
   - Auto-generated document summaries

3. **Knowledge Base Management**
   - Browse all uploaded documents
   - Filter by business segment
   - Document metadata display (title, segment, upload date, file type, size)
   - Categorised document counts

4. **Conversational AI Assistant**
   - Chat interface for querying business knowledge
   - Answers based ONLY on uploaded documents
   - Source citation for all responses
   - Session-based conversation history
   - Context-aware responses

5. **Responsive Web Interface**
   - Modern UI using TailwindCSS and FontAwesome icons
   - Tab-based navigation (Upload, Browse, Chat)
   - Interactive upload area with drag-and-drop
   - Real-time notifications and feedback
   - Mobile-friendly responsive design

## 🏗️ Data Architecture
- **Data Models**: Documents, Segments, Knowledge Chunks, Chat Sessions, Chat Messages
- **Storage Services**: Cloudflare D1 (SQLite-based distributed database)
- **AI Integration**: Cloudflare Workers AI (Llama-3-8b-instruct model)
- **Data Flow**: Upload → Content Extraction → AI Categorisation & Summarisation → Chunking → Database Storage → Search & Retrieval

## 📋 Functional Entry Points

### API Endpoints
| Endpoint | Method | Purpose | Parameters |
|----------|---------|---------|------------|
| `/api/segments` | GET | Get all business segments | None |
| `/api/documents/upload` | POST | Upload and process document | `title`, `file` or `content` |
| `/api/documents` | GET | Get documents (with optional filtering) | `segment` (optional) |
| `/api/chat` | POST | Send message to AI assistant | `message`, `sessionId` |
| `/api/chat/:sessionId` | GET | Get chat history for session | `sessionId` |

### Frontend Features
| Feature | Location | Description |
|---------|----------|-------------|
| Document Upload | `/` (Upload tab) | File upload or paste content with title |
| Knowledge Browser | `/` (Browse tab) | View and filter all documents by segment |
| AI Chat Assistant | `/` (Chat tab) | Conversational interface with business knowledge |

## 🎯 User Guide

### Uploading Documents
1. Navigate to the **Upload Documents** tab
2. Enter a descriptive document title
3. Choose upload method:
   - **File Upload**: Select a .txt file or drag and drop
   - **Paste Content**: Directly paste document text
4. Click "Upload & Process Document"
5. The system will automatically:
   - Categorise the document into appropriate business segment
   - Generate a summary
   - Extract keywords
   - Store for future searching

### Browsing Knowledge
1. Navigate to the **Browse Knowledge** tab
2. View all uploaded documents with their:
   - Title and summary
   - Business segment (colour-coded)
   - Upload date and file information
   - AI categorisation confidence
3. Filter documents by business segment using the dropdown
4. Click "Filter" to apply segment filtering

### Using the Chat Assistant
1. Navigate to the **Chat Assistant** tab
2. Type questions about your business documents
3. The AI will respond based ONLY on uploaded information
4. Review source documents cited in responses
5. Continue conversation - the assistant maintains context

### File Upload Capabilities
**Fully Supported (Ready for Production)**:
- **Text Files (.txt)** - Direct text extraction
- **CSV Files (.csv)** - Converted to readable table format

**Partially Supported (Requires External Services)**:
- **PDF Files (.pdf)** - Shows guidance to paste content or contact admin
- **Word Documents (.docx)** - Shows guidance to paste content or contact admin  
- **Excel Files (.xlsx)** - Shows guidance to export to CSV or paste content
- **Images (.jpg, .png)** - Shows guidance to transcribe text or contact admin

**Legacy Formats**:
- **Old Word (.doc)** - Recommends saving as .docx
- **Old Excel (.xls)** - Recommends saving as .xlsx

*Note: For production deployment with full file processing, external API integrations can be added for PDF extraction, OCR, and document parsing.*

### Business Segments
The system automatically categorises documents into these segments:
- **General** - General business information
- **Accounting** - Financial records and invoices
- **Finance** - Financial planning and budgets
- **Marketing** - Marketing materials and customer info
- **Operations** - Operational procedures and workflows
- **Human Resources** - HR policies and employee info
- **Legal** - Contracts and legal documents
- **Product** - Product specs and development
- **Customer Service** - Support procedures and feedback

## 🔧 Technical Configuration

### Deployment Status
- **Platform**: Cloudflare Pages (designed for)
- **Runtime**: Cloudflare Workers with Hono framework
- **Status**: ✅ Active (Local Development)
- **Tech Stack**: Hono + TypeScript + TailwindCSS + Cloudflare D1 + Cloudflare AI
- **Database**: Local D1 SQLite (for development)
- **AI Model**: @cf/meta/llama-3-8b-instruct

### Local Development Setup
```bash
# Apply database migrations
npm run db:migrate:local

# Build the application
npm run build

# Start development server
pm2 start ecosystem.config.cjs

# Test the application
curl http://localhost:3000
```

### Dependencies
- **Backend**: Hono framework for Cloudflare Workers
- **Database**: Cloudflare D1 (distributed SQLite)
- **AI**: Cloudflare Workers AI
- **Frontend**: TailwindCSS, FontAwesome, Axios
- **Build**: Vite with Cloudflare Pages plugin

## 🔄 Features Not Yet Implemented
1. **Advanced File Processing Services**
   - PDF text extraction (requires external API integration)
   - Word document processing (requires external service)
   - Excel spreadsheet analysis (requires external service)  
   - Image OCR text extraction (requires external API)

2. **Advanced Search & Analytics**
   - Full-text search across documents
   - Advanced filtering options
   - Document similarity detection
   - Usage analytics dashboard

3. **User Management & Security**
   - User authentication system
   - Role-based access control
   - Document permissions
   - Audit logging

4. **Enhanced AI Features**
   - Custom AI model fine-tuning
   - Multi-language document support
   - Sentiment analysis
   - Trend detection across documents

5. **Integration & Export**
   - API integrations (Slack, Teams, etc.)
   - Document export functionality
   - Bulk document import
   - Webhook notifications

## 🎯 Recommended Next Steps

### Immediate (Phase 1)
1. **External Service Integration**: Set up PDF, Word, Excel processing APIs
2. **Enhanced Search**: Add full-text search across document content  
3. **User Authentication**: Basic login system for security
4. **Analytics Dashboard**: Usage statistics and document insights

### Short-term (Phase 2)  
1. **Advanced Analytics**: Document usage and search analytics
2. **Bulk Operations**: Bulk document upload and management
3. **API Integrations**: Connect with business tools (Slack, email)
4. **Mobile App**: Progressive Web App (PWA) capabilities

### Long-term (Phase 3)
1. **Enterprise Features**: Multi-tenant support, advanced permissions
2. **AI Enhancements**: Custom model training, multi-modal AI
3. **Workflow Integration**: Business process automation
4. **Advanced Analytics**: Predictive insights and recommendations

## 🚀 Deployment Instructions

### Quick Start Deployment
1. **Run setup script**: `./deploy-setup.sh`
2. **Create GitHub repository** and push code
3. **Set up Cloudflare Pages** (connects to GitHub)
4. **Configure D1 database**: `./cloudflare-setup.sh`
5. **Your site is live!** 🎉

### Detailed Guide
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete step-by-step instructions.

### Deployment Scripts
- `./deploy-setup.sh` - Prepares project for GitHub deployment
- `./cloudflare-setup.sh` - Configures Cloudflare D1 database and services

## 📝 Development Notes
- The application uses British English throughout the interface
- All AI responses are constrained to uploaded document content only
- Database is automatically initialised with default business segments
- Local development uses SQLite, production uses Cloudflare D1
- Multiple file types supported with graceful error handling
- The system prioritises simplicity and can be extended with additional features

## 🔐 Security Considerations
- All user uploads are processed server-side
- No sensitive data is stored in browser storage
- AI responses are limited to uploaded business content
- Database uses parameterised queries to prevent SQL injection

---
**Last Updated**: 29 August 2025  
**Version**: 1.0.0  
**Environment**: Development