// File processing utilities for different file types

// Import libraries for file processing (these will work in Cloudflare Workers)
// Note: We'll use simpler alternatives that work in the Workers environment

export interface ProcessedFile {
  content: string;
  error?: string;
}

/**
 * Extract text content from various file types
 */
export async function processFile(file: File): Promise<ProcessedFile> {
  try {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    // Text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      return { content: await file.text() };
    }
    
    // PDF files - Note: For Cloudflare Workers, we'll implement a simpler approach
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await processPDF(file);
    }
    
    // Image files (JPG, PNG) - OCR would require external API
    if (fileType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return await processImage(file);
    }
    
    // Microsoft Word documents
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileName.endsWith('.docx')) {
      return await processWordDocument(file);
    }
    
    // Legacy Word documents
    if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      return { 
        content: '', 
        error: 'Legacy .doc files are not supported. Please save as .docx or paste the content directly.' 
      };
    }
    
    // Excel files
    if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        fileName.endsWith('.xlsx')) {
      return await processExcelFile(file);
    }
    
    // Legacy Excel files
    if (fileType === 'application/vnd.ms-excel' || fileName.endsWith('.xls')) {
      return { 
        content: '', 
        error: 'Legacy .xls files are not supported. Please save as .xlsx or paste the content directly.' 
      };
    }
    
    // CSV files
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      return await processCSV(file);
    }
    
    return { 
      content: '', 
      error: `File type "${fileType}" is not supported. Supported formats: .txt, .pdf, .docx, .xlsx, .csv, .jpg, .png` 
    };
    
  } catch (error) {
    console.error('File processing error:', error);
    return { 
      content: '', 
      error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Process PDF files - basic text extraction for Cloudflare Workers
 */
async function processPDF(file: File): Promise<ProcessedFile> {
  try {
    // For basic PDF text extraction, we'll try to extract any readable text
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string and look for text content
    let pdfString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      pdfString += String.fromCharCode(uint8Array[i]);
    }
    
    // Simple text extraction - look for readable text patterns
    const textMatches = pdfString.match(/\(([^)]+)\)/g);
    if (textMatches && textMatches.length > 0) {
      let extractedText = '';
      textMatches.forEach(match => {
        const text = match.slice(1, -1); // Remove parentheses
        if (text.length > 3 && /[a-zA-Z]/.test(text)) { // Only include text with letters
          extractedText += text + ' ';
        }
      });
      
      if (extractedText.trim().length > 50) {
        return { 
          content: `[PDF Content Extracted]\n\n${extractedText.trim()}\n\n[Note: Basic PDF extraction - some formatting may be lost]` 
        };
      }
    }
    
    // If no text found with simple extraction, provide helpful guidance
    return {
      content: '',
      error: 'Could not extract text from this PDF file. The PDF may be image-based or encrypted. Please try: 1) Copy and paste text directly from the PDF, 2) Use a PDF-to-text converter, or 3) Contact administrator for advanced PDF processing setup.'
    };
    
  } catch (error) {
    return {
      content: '',
      error: 'Failed to process PDF file. Please copy and paste the text content directly, or contact administrator for PDF processing setup.'
    };
  }
}

/**
 * Process image files - would require OCR API
 */
async function processImage(file: File): Promise<ProcessedFile> {
  // Image OCR requires external API services like Google Vision, AWS Textract, etc.
  // For now, we'll provide guidance to users
  return {
    content: '',
    error: 'Image text extraction (OCR) requires external service integration. Please transcribe the text manually or contact administrator for OCR setup.'
  };
}

/**
 * Process Word documents (.docx)
 */
async function processWordDocument(file: File): Promise<ProcessedFile> {
  try {
    // For Cloudflare Workers, we'll need to implement a simpler approach
    // The mammoth library may not work directly in Workers environment
    const arrayBuffer = await file.arrayBuffer();
    
    // This is a placeholder - in production, you'd use an external service
    // or implement a simplified DOCX parser
    return {
      content: '',
      error: 'Word document processing requires external service integration. Please copy and paste the content directly.'
    };
  } catch (error) {
    return {
      content: '',
      error: 'Failed to process Word document. Please copy and paste the content directly.'
    };
  }
}

/**
 * Process Excel files (.xlsx)
 */
async function processExcelFile(file: File): Promise<ProcessedFile> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // For Cloudflare Workers, complex spreadsheet parsing may not work
    // We'll provide a simpler approach
    return {
      content: '',
      error: 'Excel file processing requires external service integration. Please export to CSV or paste the data directly.'
    };
  } catch (error) {
    return {
      content: '',
      error: 'Failed to process Excel file. Please export to CSV or paste the data directly.'
    };
  }
}

/**
 * Process CSV files
 */
async function processCSV(file: File): Promise<ProcessedFile> {
  try {
    const csvText = await file.text();
    
    // Convert CSV to readable text format
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return { content: '', error: 'CSV file appears to be empty' };
    }
    
    // Process CSV into readable format
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1);
    
    let content = `Data Table (${rows.length} rows):\n\n`;
    content += `Columns: ${headers.join(', ')}\n\n`;
    
    // Add first 50 rows to avoid huge content
    const maxRows = Math.min(50, rows.length);
    for (let i = 0; i < maxRows; i++) {
      const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
      content += `Row ${i + 1}:\n`;
      headers.forEach((header, idx) => {
        if (values[idx]) {
          content += `  ${header}: ${values[idx]}\n`;
        }
      });
      content += '\n';
    }
    
    if (rows.length > maxRows) {
      content += `... and ${rows.length - maxRows} more rows\n`;
    }
    
    return { content };
  } catch (error) {
    return {
      content: '',
      error: 'Failed to process CSV file. Please check file format.'
    };
  }
}

/**
 * Get supported file types for frontend validation
 */
export function getSupportedFileTypes(): string[] {
  return [
    '.txt',
    '.pdf', 
    '.docx',
    '.xlsx',
    '.csv',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp'
  ];
}

/**
 * Get file type description for user guidance
 */
export function getFileTypeDescription(): string {
  return 'Supported formats: Text (.txt), PDF (.pdf), Word (.docx), Excel (.xlsx), CSV (.csv), Images (.jpg, .png)';
}