import { z } from 'zod'
import { router, publicProcedure } from '@/lib/trpc'
import { processPDFBuffer, getDocument, getAllDocuments, deleteDocumentById } from '@/lib/pdf-processor'
import { ForagerQueryAgent } from '@/lib/query-agent'
import { dumpObject } from '@/lib/observability'

const documentPageSchema = z.object({
  pageNbr: z.number(),
  pageContentNbr: z.number().optional(),
  content: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  references: z.array(z.string()),
})

const uploadedDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  pages: z.array(documentPageSchema),
  uploadedAt: z.date(),
})

export const appRouter = router({
  uploadDocument: publicProcedure
    .input(z.object({
      filename: z.string(),
      fileData: z.string(), // Base64 encoded PDF data
    }))
    .output(z.object({
      documentId: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      const startTime = Date.now()
      
      console.log(`[${requestId}] 🚀 Upload request started`, {
        filename: input.filename,
        fileSize: input.fileData.length,
        requestId
      })
      
      try {
        console.log(`[${requestId}] 📄 Starting PDF processing for: ${input.filename}`)
        const buffer = Buffer.from(input.fileData, 'base64')
        console.log(`[${requestId}] 💾 Buffer created, size: ${buffer.length} bytes`)
        
        // Dump request details for debugging
        await dumpObject(`request-${requestId}.json`, {
          requestId,
          filename: input.filename,
          originalFileSize: input.fileData.length,
          bufferSize: buffer.length,
          startTime: new Date(startTime).toISOString()
        })
        
        const document = await processPDFBuffer(buffer, input.filename)
        const endTime = Date.now()
        const duration = endTime - startTime
        
        console.log(`[${requestId}] ✅ PDF processed successfully`, {
          pages: document.pages.length,
          documentId: document.id,
          duration: `${duration}ms`,
          avgTimePerPage: `${Math.round(duration / document.pages.length)}ms`
        })
        
        // Dump processing result summary
        await dumpObject(`result-${requestId}.json`, {
          requestId,
          documentId: document.id,
          filename: document.filename,
          processingDuration: duration,
          pagesProcessed: document.pages.length,
          totalContentLength: document.pages.reduce((acc, page) => acc + page.content.length, 0),
          endTime: new Date(endTime).toISOString(),
          success: true
        })
        
        return {
          documentId: document.id,
          message: `Document uploaded successfully. Processed ${document.pages.length} pages in ${duration}ms.`,
        }
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime
        
        console.error(`[${requestId}] ❌ PDF processing error after ${duration}ms:`, error)
        
        // Dump error details
        await dumpObject(`error-${requestId}.json`, {
          requestId,
          filename: input.filename,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          duration,
          endTime: new Date(endTime).toISOString(),
          success: false
        })
        
        throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : String(error)}`)
      }
    }),

  queryDocument: publicProcedure
    .input(z.object({
      query: z.string(),
      documentId: z.string().optional(),
    }))
    .output(z.object({
      answer: z.string(),
      relevantPages: z.array(z.number()),
      sources: z.array(z.object({
        pageNbr: z.number(),
        content: z.string(),
        relevance: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      try {
        let documents
        
        if (input.documentId) {
          const doc = await getDocument(input.documentId)
          if (!doc) {
            throw new Error('Document not found')
          }
          documents = doc.pages
        } else {
          // Query across all documents
          const allDocs = await getAllDocuments()

          console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")
          console.log("✨ allDocs", allDocs)
          console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")

          documents = allDocs.flatMap(doc => doc.pages)
        }
        
        if (documents.length === 0) {
          throw new Error('No documents available to query')
        }
        
        const agent = new ForagerQueryAgent(documents)
        const result = await agent.processQuery(input.query)

        console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")
        console.log("✨ result", result)
        console.log("✨✨✨✨✨✨✨✨✨✨✨✨✨✨✨")
        
        return {
          answer: result.answer,
          relevantPages: result.relevantPages,
          sources: result.sources,
        }
      } catch (error) {
        throw new Error(`Query processing failed: ${error}`)
      }
    }),

  getDocuments: publicProcedure
    .output(z.array(z.object({
      id: z.string(),
      filename: z.string(),
      uploadedAt: z.date(),
      pageCount: z.number(),
    })))
    .query(async () => {
      const documents = await getAllDocuments()
      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        uploadedAt: doc.uploadedAt,
        pageCount: doc.pages.length,
      }))
    }),

  getDocumentDetail: publicProcedure
    .input(z.object({ documentId: z.string() }))
    .output(uploadedDocumentSchema)
    .query(async ({ input }) => {
      const doc = await getDocument(input.documentId)
      if (!doc) {
        throw new Error('Document not found')
      }
      return doc
    }),

  deleteDocument: publicProcedure
    .input(z.object({
      documentId: z.string(),
    }))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input }) => {
      const success = await deleteDocumentById(input.documentId)
      return { success }
    }),
})

export type AppRouter = typeof appRouter
