'use client'

import { PDFUpload } from '@/components/pdf-upload'
import { QueryInterface } from '@/components/query-interface'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Forager RAG System
        </h1>
        
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Upload PDF Document
            </h2>
            <PDFUpload />
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Query Document
            </h2>
            <QueryInterface />
          </section>
        </div>
      </div>
    </main>
  )
}