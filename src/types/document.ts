export interface DocumentPage {
  pageNbr: number
  pageContentNbr?: number
  content: string
  summary: string
  tags: string[]
  references: string[]
}

export interface UploadedDocument {
  id: string
  filename: string
  pages: DocumentPage[]
  uploadedAt: Date
}

export interface QueryRequest {
  query: string
  documentId?: string
}

export interface QueryResponse {
  answer: string
  relevantPages: number[]
  sources: {
    pageNbr: number
    content: string
    relevance: number
  }[]
}