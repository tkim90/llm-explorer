import { generateDocumentSummary } from '@/lib/openai'
import { DocumentPage, UploadedDocument } from '@/types/document'
import { createDocumentObserver } from '@/lib/observability'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

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
    // Write buffer to a temp file for Zerox
    observer.log('Preparing temp file for Zerox')
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-explorer-'))
    const safeName = filename && path.extname(filename)
      ? filename
      : `${path.basename(filename || 'uploaded', path.extname(filename || '')) || 'uploaded'}.pdf`
    const tempFilePath = path.join(tempRoot, safeName)
    await fs.writeFile(tempFilePath, buffer)

    observer.log('Running Zerox OCR to Markdown', {
      tempFilePath,
      model: 'gpt-4o-mini',
    })

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }

    /**
     * Lazy import zerox bc it breaks edge bundles (for trpc api routes)
     * Because it relies on `libheif-js`, which triggers this error:
     * 
     * ⚠ ./node_modules/libheif-js/libheif-wasm/libheif-bundle.js
     * Critical dependency: require function is used in a way in which dependencies cannot be statically extracted
     */
    const zerox = await import('zerox');
    console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")
    console.log("✨ Successfully imported zerox", zerox.zerox.name);
    console.log("✨ Running Zerox OCR...");
    console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")

    const ocrResult = await zerox.zerox({
      filePath: tempFilePath,
      modelProvider: 'OPENAI',
      model: 'gpt-4o-mini',
      credentials: { apiKey: process.env.OPENAI_API_KEY },
      // Maintain format helps with tables/multi-page continuity; can be slower
      maintainFormat: true,
      // Use our tempRoot for Zerox internal temp
      tempDir: tempRoot,
      // Keep defaults for concurrency, retries, etc.
    })


    console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨')
    console.log("✨ tempFilePath", tempFilePath)
    console.log("✨ tempRoot", tempRoot)
    console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨')
    console.log("✨ ocrResult", ocrResult)
    console.log('✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨')

    observer.log('Zerox OCR completed', {
      totalPages: ocrResult.pages?.length || 0,
      inputTokens: ocrResult.inputTokens,
      outputTokens: ocrResult.outputTokens,
    })

    observer.log('mock - Zerox OCR completed');
    const documentPages: DocumentPage[] = []

    observer.log('Starting AI-powered page analysis from OCR markdown')

    for (const page of ocrResult.pages || []) {
      const pageNumber = page.page
      const pageText = page.content?.trim() || ''

      if (!pageText) {
        observer.log(`Skipping empty/errored page ${pageNumber}`, { error: page.error })
        continue
      }

      observer.log(`Processing page ${pageNumber}/${ocrResult.pages.length}`, {
        contentLength: pageText.length,
      })

      const analysis = await generateDocumentSummary(pageText)

      const documentPage: DocumentPage = {
        pageNbr: pageNumber,
        content: pageText,
        summary: analysis.summary,
        tags: analysis.tags,
        references: analysis.references,
      }

      observer.log(`Page ${pageNumber} analysis completed`, {
        summaryLength: analysis.summary.length,
        tagsCount: analysis.tags.length,
        referencesCount: analysis.references.length,
        tags: analysis.tags.slice(0, 3),
        references: analysis.references.slice(0, 3),
      })

      documentPages.push(documentPage)
    }

    observer.log('All pages processed, creating document object', {
      totalProcessedPages: documentPages.length,
      totalContentLength: documentPages.reduce((acc, page) => acc + page.content.length, 0),
    })

    const document: UploadedDocument = {
      id: documentId,
      filename,
      pages: documentPages,
      uploadedAt: new Date(),
    }

    observer.log('Storing document in memory')
    await storeDocument(document)

    observer.log('Cleaning up temp files')
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {})

    observer.log('Document processing completed successfully')

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
