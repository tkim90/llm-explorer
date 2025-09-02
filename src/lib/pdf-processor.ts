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

    // Reconstruct text using positional grouping to avoid extra spaces
    const pageTexts = pages.map((page: any) => {
      const texts: any[] = page.Texts || []
      if (!texts.length) return ''

      // Group by line based on Y position (rounded to reduce tiny variations)
      const linesMap = new Map<number, any[]>()
      for (const t of texts) {
        const yKey = Math.round(t.y)
        const arr = linesMap.get(yKey) || []
        arr.push(t)
        linesMap.set(yKey, arr)
      }

      // Sort lines by their Y coordinate
      const sortedLines = Array.from(linesMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, arr]) => arr)

      // Build text line by line
      const lineStrings = sortedLines.map((lineTokens: any[]) => {
        // Sort tokens left-to-right
        lineTokens.sort((a, b) => (a.x - b.x))

        let line = ''
        let prevEndX: number | null = null
        for (const tok of lineTokens) {
          const tokenText = (tok.R || [])
            .map((r: any) => decodeURIComponent(r.T))
            .join('')

          const x = typeof tok.x === 'number' ? tok.x : 0
          // pdf2json provides width as `w` in many cases; fall back to 0 if missing
          const w = typeof tok.w === 'number' ? tok.w : 0

          if (line.length > 0) {
            // Compute gap between tokens to decide if a space is needed
            const gap = prevEndX !== null ? (x - prevEndX) : 0
            const startsWithSpace = tokenText.startsWith(' ')
            const endsWithSpace = line.endsWith(' ')
            // Heuristic: add a space if there's a noticeable gap or explicit space
            const needsSpace = startsWithSpace || (!endsWithSpace && gap > 0.5)
            if (needsSpace && !endsWithSpace) {
              line += ' '
            }
          }

          line += tokenText
          prevEndX = x + w
        }

        return line.trimEnd()
      })

      // Join lines with newlines to preserve structure
      return lineStrings.join('\n')
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
