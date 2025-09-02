import { generateDocumentSummary } from '@/lib/openai'
import { DocumentPage, UploadedDocument } from '@/types/document'

export async function processPDFBuffer(
  buffer: Buffer,
  filename: string
): Promise<UploadedDocument> {
  console.log(`Processing PDF buffer, size: ${buffer.length} bytes`)
  
  try {
    // Use pdf2json for better Next.js compatibility
    const PDFParser = (await import('pdf2json')).default
    
    const pdfParser = new PDFParser(null, true)
    
    const parsePromise = new Promise<any>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', reject)
      pdfParser.on('pdfParser_dataReady', resolve)
    })
    
    pdfParser.parseBuffer(buffer)
    const pdfData = await parsePromise
    
    // Extract text from pdf2json format
    const pages = pdfData.Pages || []
    const pageTexts = pages.map((page: any, index: number) => {
      const texts = page.Texts || []
      const pageText = texts.map((textObj: any) => {
        return textObj.R.map((r: any) => decodeURIComponent(r.T)).join('')
      }).join(' ')
      return pageText
    })
    
    const documentPages: DocumentPage[] = []
    
    // Process each page
    for (let i = 0; i < pageTexts.length; i++) {
      const pageText = pageTexts[i]
      
      if (pageText.trim().length === 0) {
        continue
      }
      
      // Generate AI-powered analysis for each page
      const analysis = await generateDocumentSummary(pageText)
      
      const documentPage: DocumentPage = {
        pageNbr: i + 1,
        content: pageText,
        summary: analysis.summary,
        tags: analysis.tags,
        references: analysis.references,
      }
      
      documentPages.push(documentPage)
    }
    
    const document: UploadedDocument = {
      id: generateDocumentId(),
      filename,
      pages: documentPages,
      uploadedAt: new Date(),
    }
    
    // Store document in memory (in production, use a database)
    await storeDocument(document)
    
    return document
    
  } catch (error) {
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