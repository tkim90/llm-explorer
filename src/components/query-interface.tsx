'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-provider'

interface QueryResult {
  answer: string
  relevantPages: number[]
  sources: Array<{
    pageNbr: number
    content: string
    relevance: number
    summary: string
    tags: string[]
    references: string[]
  }>
}

export function QueryInterface() {
  const [query, setQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [result, setResult] = useState<QueryResult | null>(null)

  const { data: documents } = trpc.getDocuments.useQuery()
  
  const queryMutation = trpc.queryDocument.useMutation({
    onSuccess: (data) => {
      console.log('Query response:', data)
      console.log('Sources structure:', data.sources)
      setResult(data)
    },
    onError: (error) => {
      console.error('Query failed:', error)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    await queryMutation.mutateAsync({
      query: query.trim(),
      documentId: selectedDocument || undefined,
    })
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="document-select" className="block text-sm font-medium text-gray-700 mb-2">
            Document (optional)
          </label>
          <select
            id="document-select"
            value={selectedDocument}
            onChange={(e) => setSelectedDocument(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Search all documents</option>
            {documents?.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename} ({doc.pageCount} pages)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="query-input" className="block text-sm font-medium text-gray-700 mb-2">
            Your Question
          </label>
          <div className="relative">
            <textarea
              id="query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to know about the document? e.g., 'What is the termination policy?'"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={!query.trim() || queryMutation.isPending}
              className="absolute bottom-2 right-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {queryMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Searching...</span>
                </div>
              ) : (
                'Ask Question'
              )}
            </button>
          </div>
        </div>
      </form>

      {queryMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            Error: {queryMutation.error?.message}
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Answer</h3>
            <div className="prose text-gray-800 leading-relaxed">
              {result.answer}
            </div>
          </div>

          {result.relevantPages.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Relevant Pages
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.relevantPages.map((pageNbr) => (
                  <span
                    key={pageNbr}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    Page {pageNbr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.sources.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900">Sources</h4>
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      Page {source.pageNbr}
                    </span>
                    <span className="text-xs text-gray-500">
                      Relevance: {(source.relevance * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <strong className="text-sm text-gray-900">Summary:</strong>
                    <p className="text-sm text-gray-700 mt-1">{source.summary}</p>
                  </div>
                  
                  <div className="mb-3">
                    <strong className="text-sm text-gray-900">Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {source.tags.map((tag, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {source.references.length > 0 && (
                    <div className="mb-3">
                      <strong className="text-sm text-gray-900">References:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {source.references.map((ref, idx) => (
                          <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                            {ref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
                      Show source content
                    </summary>
                    <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm text-gray-700 max-h-40 overflow-y-auto">
                      {source.content}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!documents?.length && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No documents uploaded yet. Upload a PDF to start querying.
          </p>
        </div>
      )}
    </div>
  )
}