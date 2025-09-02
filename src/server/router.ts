import { z } from 'zod'
import { router, publicProcedure } from '@/lib/trpc'
import { processPDFBuffer, getDocument, getAllDocuments } from '@/lib/pdf-processor'
import { ForagerQueryAgent } from '@/lib/query-agent'

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
      document: uploadedDocumentSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        console.log('Starting PDF processing for:', input.filename)
        const buffer = Buffer.from(input.fileData, 'base64')
        console.log('Buffer created, size:', buffer.length)
        
        const document = await processPDFBuffer(buffer, input.filename)
        console.log('PDF processed successfully, pages:', document.pages.length)
        
        return {
          documentId: document.id,
          message: `Document uploaded successfully. Processed ${document.pages.length} pages.`,
          document,
        }
      } catch (error) {
        console.error('PDF processing error:', error)
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
        summary: z.string(),
        tags: z.array(z.string()),
        references: z.array(z.string()),
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
          documents = allDocs.flatMap(doc => doc.pages)
        }
        
        if (documents.length === 0) {
          throw new Error('No documents available to query')
        }
        
        const agent = new ForagerQueryAgent(documents)
        const result = await agent.processQuery(input.query)
        
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
})

export type AppRouter = typeof appRouter