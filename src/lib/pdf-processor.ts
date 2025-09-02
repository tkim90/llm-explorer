import { generateDocumentSummary } from '@/lib/openai'
import { DocumentPage, UploadedDocument } from '@/types/document'
import { createDocumentObserver } from '@/lib/observability'

export async function processPDFBuffer(
  buffer: Buffer,
  filename: string
): Promise<UploadedDocument> {
  // Generate document ID early for logging
  const documentId = generateDocumentId()
  const observer = createDocumentObserver(documentId, filename)
  
  observer.log('Starting PDF processing', { 
    filename, 
    bufferSize: buffer.length,
    documentId 
  })
  
  try {
    observer.log('Importing PDF parser')
    // Use pdf2json for better Next.js compatibility
    const PDFParser = (await import('pdf2json')).default
    
    observer.log('Creating PDF parser instance')
    const pdfParser = new PDFParser(null, true)
    
    const parsePromise = new Promise<any>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', reject)
      pdfParser.on('pdfParser_dataReady', resolve)
    })
    
    observer.log('Starting PDF buffer parsing')
    pdfParser.parseBuffer(buffer)
    const pdfData = await parsePromise
    
    observer.log('PDF parsing completed', { 
      pagesFound: pdfData.Pages?.length || 0 
    })
    
    // Extract text from pdf2json format
    const pages = pdfData.Pages || []
    observer.log('Extracting text from pages')
    
    const pageTexts = pages.map((page: any) => {
      const texts = page.Texts || []
      const pageText = texts.map((textObj: any) => {
        return textObj.R.map((r: any) => decodeURIComponent(r.T)).join('')
      }).join(' ')
      return pageText
    })
    
    observer.log('Text extraction completed', { 
      totalPages: pageTexts.length,
      averageLength: Math.round(pageTexts.reduce((acc: number, text: string) => acc + text.length, 0) / pageTexts.length)
    })
    
    const documentPages: DocumentPage[] = []
    
    observer.log('Starting AI-powered page analysis')
    
    // Process each page
    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i]
      
      if (pageText.trim().length === 0) {
        observer.log(`Skipping empty page ${i + 1}`)
        continue
      }
      
      observer.log(`Processing page ${i + 1}/${pageTexts.length}`, { 
        contentLength: pageText.length 
      })
      
      // Generate AI-powered analysis for each page
      const analysis = await generateDocumentSummary(pageText)
      
      const documentPage: DocumentPage = {
        pageNbr: i + 1,
        content: pageText,
        summary: analysis.summary,
        tags: analysis.tags,
        references: analysis.references,
      }
      
      observer.log(`Page ${i + 1} analysis completed`, {
        summaryLength: analysis.summary.length,
        tagsCount: analysis.tags.length,
        referencesCount: analysis.references.length,
        tags: analysis.tags.slice(0, 3), // First 3 tags for logging
        references: analysis.references.slice(0, 3) // First 3 references for logging
      })
      
      documentPages.push(documentPage)
    }
    
    observer.log('All pages processed, creating document object', {
      totalProcessedPages: documentPages.length,
      totalContentLength: documentPages.reduce((acc, page) => acc + page.content.length, 0)
    })
    
    const document: UploadedDocument = {
      id: documentId,
      filename,
      pages: documentPages,
      uploadedAt: new Date(),
    }
    
    observer.log('Storing document in memory')
    // Store document in memory (in production, use a database)
    await storeDocument(document)
    
    observer.log('Document processing completed successfully')
    
    // Create observability dumps
    await observer.dumpToFiles(document)
    
    return document
    
  } catch (error) {
    observer.log('Error during PDF processing', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    console.error('Error processing PDF:', error)
    throw new Error('Failed to process PDF file')
  }
}


function generateDocumentId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// Simple in-memory storage (replace with database in production)
const documentStore = new Map<string, UploadedDocument>()

async function storeDocument(document: UploadedDocument): Promise<void> {
  documentStore.set(document.id, document)
}

export async function getDocument(id: string): Promise<UploadedDocument | null> {
  return documentStore.get(id) || null
}

export async function getAllDocuments(): Promise<UploadedDocument[]> {
  return Array.from(documentStore.values())
}