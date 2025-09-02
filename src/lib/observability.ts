import { promises as fs } from 'fs'
import { join } from 'path'
import { UploadedDocument, DocumentPage } from '@/types/document'

export interface ProcessingLog {
  timestamp: Date
  step: string
  details?: any
  duration?: number
}

class DocumentObserver {
  private logs: ProcessingLog[] = []
  private startTime: Date = new Date()
  
  constructor(private documentId: string, private filename: string) {}

  log(step: string, details?: any) {
    const timestamp = new Date()
    const duration = timestamp.getTime() - this.startTime.getTime()
    
    const logEntry: ProcessingLog = {
      timestamp,
      step,
      details,
      duration
    }
    
    this.logs.push(logEntry)
    console.log(`[${this.documentId}] ${step}${details ? `: ${JSON.stringify(details)}` : ''}`)
  }

  async dumpToFiles(document: UploadedDocument) {
    try {
      const dumpDir = join(process.cwd(), 'temp-dumps', this.documentId)
      
      // Ensure dump directory exists
      await fs.mkdir(dumpDir, { recursive: true })
      
      // Dump complete UploadedDocument object
      const uploadedDocPath = join(dumpDir, 'uploaded-document.json')
      await fs.writeFile(uploadedDocPath, JSON.stringify(document, null, 2))
      
      // Dump DocumentPage objects separately for easier inspection
      const pagesPath = join(dumpDir, 'document-pages.json')
      await fs.writeFile(pagesPath, JSON.stringify(document.pages, null, 2))
      
      // Dump processing log
      const logPath = join(dumpDir, 'processing-log.txt')
      const logContent = this.formatProcessingLog()
      await fs.writeFile(logPath, logContent)
      
      // Create summary file
      const summaryPath = join(dumpDir, 'summary.txt')
      const summaryContent = this.createSummary(document)
      await fs.writeFile(summaryPath, summaryContent)
      
      console.log(`📁 Document dumps created in: ${dumpDir}`)
      
    } catch (error) {
      console.error('Error creating document dumps:', error)
    }
  }

  private formatProcessingLog(): string {
    let output = `Processing Log for Document: ${this.filename}\n`
    output += `Document ID: ${this.documentId}\n`
    output += `Processing Started: ${this.startTime.toISOString()}\n`
    output += `Total Processing Time: ${this.logs[this.logs.length - 1]?.duration || 0}ms\n`
    output += `\n${'='.repeat(60)}\n\n`
    
    this.logs.forEach((log, index) => {
      output += `[${log.timestamp.toISOString()}] Step ${index + 1}: ${log.step}\n`
      if (log.details) {
        output += `  Details: ${JSON.stringify(log.details, null, 2)}\n`
      }
      output += `  Duration from start: ${log.duration}ms\n\n`
    })
    
    return output
  }

  private createSummary(document: UploadedDocument): string {
    const totalPages = document.pages.length
    const totalContent = document.pages.reduce((acc, page) => acc + page.content.length, 0)
    const avgContentPerPage = Math.round(totalContent / totalPages)
    
    const allTags = document.pages.flatMap(page => page.tags)
    const uniqueTags = [...new Set(allTags)]
    
    const allReferences = document.pages.flatMap(page => page.references)
    const uniqueReferences = [...new Set(allReferences)]
    
    let summary = `Document Processing Summary\n`
    summary += `${'='.repeat(40)}\n\n`
    summary += `Filename: ${document.filename}\n`
    summary += `Document ID: ${document.id}\n`
    summary += `Upload Time: ${document.uploadedAt.toISOString()}\n`
    summary += `Total Pages: ${totalPages}\n`
    summary += `Total Content Characters: ${totalContent.toLocaleString()}\n`
    summary += `Average Content per Page: ${avgContentPerPage.toLocaleString()} characters\n`
    summary += `\nSemantic Analysis:\n`
    summary += `  Unique Tags: ${uniqueTags.length}\n`
    summary += `  Unique References: ${uniqueReferences.length}\n`
    summary += `\nMost Common Tags:\n`
    
    // Count tag frequencies
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
    
    topTags.forEach(([tag, count]) => {
      summary += `  - ${tag}: ${count} pages\n`
    })
    
    summary += `\nAll Unique Tags:\n`
    uniqueTags.slice(0, 50).forEach(tag => {
      summary += `  - ${tag}\n`
    })
    
    if (uniqueReferences.length > 0) {
      summary += `\nReferences Found:\n`
      uniqueReferences.slice(0, 20).forEach(ref => {
        summary += `  - ${ref}\n`
      })
    }
    
    return summary
  }
}

export function createDocumentObserver(documentId: string, filename: string): DocumentObserver {
  return new DocumentObserver(documentId, filename)
}

export async function dumpObject(filename: string, obj: any, directory = 'temp-dumps'): Promise<void> {
  try {
    const dumpDir = join(process.cwd(), directory)
    await fs.mkdir(dumpDir, { recursive: true })
    
    const filePath = join(dumpDir, filename)
    await fs.writeFile(filePath, JSON.stringify(obj, null, 2))
    
    console.log(`🔍 Object dumped to: ${filePath}`)
  } catch (error) {
    console.error('Error dumping object:', error)
  }
}