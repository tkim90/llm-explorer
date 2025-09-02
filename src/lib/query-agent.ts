import { DocumentPage } from '@/types/document'
import { identifyRelevantPages } from '@/lib/openai'
import OpenAI from 'openai'

export interface AgentTool {
  name: string
  description: string
  execute: (args: any) => Promise<string>
}

export interface QueryAgentResult {
  answer: string
  relevantPages: number[]
  sources: Array<{
    pageNbr: number
    content: string
    relevance: number
  }>
  steps: number
}

export class ForagerQueryAgent {
  private documents: DocumentPage[]
  private maxSteps: number = 100
  private tools: Map<string, AgentTool>

  constructor(documents: DocumentPage[]) {
    this.documents = documents
    this.tools = new Map()
    this.setupTools()
  }

  private setupTools() {
    this.tools.set('search_pages', {
      name: 'search_pages',
      description: 'Search for document pages containing specific content or keywords',
      execute: async (args: { keywords: string[] }) => {
        const results = this.searchPages(args.keywords)
        return JSON.stringify(results)
      }
    })

    this.tools.set('get_page_content', {
      name: 'get_page_content',
      description: 'Get the full content of a specific page by page number',
      execute: async (args: { pageNumber: number }) => {
        const page = this.documents.find(p => p.pageNbr === args.pageNumber)
        return page ? page.content : 'Page not found'
      }
    })

    this.tools.set('search_references', {
      name: 'search_references',
      description: 'Find pages that reference specific sections, chapters, or headings',
      execute: async (args: { reference: string }) => {
        const results = this.searchReferences(args.reference)
        return JSON.stringify(results)
      }
    })

    this.tools.set('get_related_pages', {
      name: 'get_related_pages',
      description: 'Find pages with similar semantic tags to a given page',
      execute: async (args: { pageNumber: number }) => {
        const results = this.getRelatedPages(args.pageNumber)
        return JSON.stringify(results)
      }
    })
  }

  private searchPages(keywords: string[]): Array<{ pageNbr: number, relevance: number, summary: string }> {
    return this.documents
      .map(page => {
        const content = page.content.toLowerCase()
        const summary = page.summary.toLowerCase()
        const tags = page.tags.map(t => t.toLowerCase())

        let relevance = 0
        keywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase()
          if (content.includes(keywordLower)) relevance += 3
          if (summary.includes(keywordLower)) relevance += 2
          if (tags.some(tag => tag.includes(keywordLower))) relevance += 1
        })

        return { pageNbr: page.pageNbr, relevance, summary: page.summary }
      })
      .filter(result => result.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 10)
  }

  private searchReferences(reference: string): Array<{ pageNbr: number, references: string[] }> {
    return this.documents
      .filter(page =>
        page.references.some(ref =>
          ref.toLowerCase().includes(reference.toLowerCase())
        )
      )
      .map(page => ({ pageNbr: page.pageNbr, references: page.references }))
  }

  private getRelatedPages(pageNumber: number): Array<{ pageNbr: number, commonTags: string[] }> {
    const targetPage = this.documents.find(p => p.pageNbr === pageNumber)
    if (!targetPage) return []

    return this.documents
      .filter(page => page.pageNbr !== pageNumber)
      .map(page => {
        const commonTags = page.tags.filter(tag =>
          targetPage.tags.some(targetTag =>
            targetTag.toLowerCase() === tag.toLowerCase()
          )
        )
        return { pageNbr: page.pageNbr, commonTags }
      })
      .filter(result => result.commonTags.length > 0)
      .sort((a, b) => b.commonTags.length - a.commonTags.length)
      .slice(0, 5)
  }

  async processQuery(query: string): Promise<QueryAgentResult> {
    let step = 0
    const sources: Array<{ pageNbr: number, content: string, relevance: number }> = []

    // First, identify potentially relevant pages using AI
    const relevantPageNumbers = await identifyRelevantPages(
      this.documents.map(p => ({
        pageNbr: p.pageNbr,
        content: p.content.substring(0, 500), // Truncate for efficiency
        summary: p.summary,
        tags: p.tags
      })),
      query
    )

    // Get content from initially relevant pages
    for (const pageNbr of relevantPageNumbers.slice(0, 5)) { // Limit to first 5 pages
      const page = this.documents.find(p => p.pageNbr === pageNbr)
      if (page) {
        sources.push({
          pageNbr,
          content: page.content.substring(0, 1000),
          relevance: 1.0
        })
      }
    }

    // Simple search for additional relevant content based on keywords
    const keywords = query.toLowerCase().split(' ').filter(word => word.length > 3)
    for (const page of this.documents) {
      if (relevantPageNumbers.includes(page.pageNbr)) continue

      const contentLower = page.content.toLowerCase()
      const summaryLower = page.summary.toLowerCase()

      let relevanceScore = 0
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) relevanceScore += 1
        if (summaryLower.includes(keyword)) relevanceScore += 2
        if (page.tags.some(tag => tag.toLowerCase().includes(keyword))) relevanceScore += 1
      }

      if (relevanceScore > 2 && sources.length < 10) {
        sources.push({
          pageNbr: page.pageNbr,
          content: page.content.substring(0, 800),
          relevance: relevanceScore / keywords.length
        })
      }
    }

    // Sort sources by relevance
    sources.sort((a, b) => b.relevance - a.relevance)

    // Generate answer using all collected context
    const contextText = sources.map(s =>
      `Page ${s.pageNbr}: ${s.content}`
    ).join('\n\n')

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Forager, an expert document analysis assistant. Answer the user's question based on the provided document content. 

Rules:
1. Use only the information provided in the context
2. Be comprehensive and detailed in your answer
3. Reference specific pages when citing information
4. If information is not available, say so clearly
5. Follow cross-references and citations mentioned in the text`
        },
        {
          role: 'user',
          content: `Question: ${query}

Context from document pages:
${contextText}

Please provide a comprehensive answer based on the available information.`
        }
      ],
      temperature: 0.1,
      max_tokens: 5000
    })

    const answer = response.choices[0]?.message.content || 'No answer could be generated from the available content.'

    return {
      answer,
      relevantPages: Array.from(new Set([...relevantPageNumbers, ...sources.map(s => s.pageNbr)])),
      sources: sources.slice(0, 5), // Limit displayed sources
      steps: step
    }
  }
}
