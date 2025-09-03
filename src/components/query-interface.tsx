'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc-provider'
import Markdown from '@/components/markdown'

interface QueryResult {
  answer: string
  relevantPages: number[]
  sources: Array<{
    pageNbr: number
    content: string
    relevance: number
  }>
}

export function QueryInterface() {
  const [query, setQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [result, setResult] = useState<QueryResult | null>(null)

  const utils = trpc.useUtils()
  const { data: documents, isLoading: docsLoading, error: docsError } = trpc.getDocuments.useQuery()
  const deleteMutation = trpc.deleteDocument.useMutation({
    onSuccess: async (_, vars) => {
      if (vars.documentId === selectedDocument) setSelectedDocument('')
      await utils.getDocuments.invalidate()
    },
  })

  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const previewQuery = trpc.getDocumentDetail.useQuery(
    { documentId: previewDocId || '' },
    { enabled: !!previewDocId && previewOpen }
  )
  
  const queryMutation = trpc.queryDocument.useMutation({
    onSuccess: (data) => {
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

  console.log({
    documents,
    result,
  })

  const onDelete = async (id: string) => {
    const ok = window.confirm('Delete this document and its stored data?')
    if (!ok) return
    await deleteMutation.mutateAsync({ documentId: id })
  }

  const hasDocuments = (documents?.length ?? 0) > 0

  const openPreview = async (id: string) => {
    setPreviewDocId(id)
    setPreviewOpen(true)
  }

  const closePreview = () => {
    setPreviewOpen(false)
    // keep previewDocId to preserve cache; clear if you prefer
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Document (optional)
            </label>
            {docsLoading && <span className="text-xs text-gray-500">Loading…</span>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="doc-all"
                type="radio"
                name="doc-select"
                checked={!selectedDocument}
                onChange={() => setSelectedDocument('')}
              />
              <label htmlFor="doc-all" className="text-sm text-gray-700">Search all documents</label>
            </div>

            {docsError && (
              <div className="p-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded">
                Failed to load documents
              </div>
            )}

            {hasDocuments && (
              <div className="border border-gray-200 rounded-md divide-y">
                {documents!.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="doc-select"
                        checked={selectedDocument === doc.id}
                        onChange={() => setSelectedDocument(doc.id)}
                      />
                      <span className="text-sm text-gray-900">{doc.filename}</span>
                      <span className="text-xs text-gray-500">({doc.pageCount} pages)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openPreview(doc.id)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(doc.id)}
                        className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            <Markdown className="prose text-gray-800 leading-relaxed max-w-none">
              {result.answer}
            </Markdown>
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
                  <Markdown className="prose text-gray-700 leading-relaxed max-w-none">
                    {source.content}
                  </Markdown>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasDocuments && (
        <div className="text-center py-8">
          <p className="text-gray-500">
            No documents uploaded yet. Upload a PDF to start querying.
          </p>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button className="absolute inset-0 bg-black/50" onClick={closePreview} />
          <div className="relative bg-white w-full max-w-4xl max-h-[80vh] rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {previewQuery.data?.filename || 'Document Preview'}
                </h3>
                {previewQuery.data?.uploadedAt && (
                  <p className="text-xs text-gray-500">
                    Uploaded: {(previewQuery.data.uploadedAt as Date).toLocaleString()}
                  </p>
                )}
              </div>
              <button onClick={closePreview} className="text-gray-500 hover:text-gray-700 text-sm">Close</button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {previewQuery.isLoading && (
                <div className="text-sm text-gray-500">Loading preview…</div>
              )}
              {previewQuery.error && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                  Failed to load document
                </div>
              )}
              {previewQuery.data && previewQuery.data.pages.map((page) => (
                <div key={page.pageNbr} className="border border-gray-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900">Page {page.pageNbr}</h4>
                    {page.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {page.tags.map((t, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-sm bg-gray-100 text-gray-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div className="bg-gray-100 rounded-md p-2">
                      <h5 className="font-semibold text-gray-700">Summary (AI generated)</h5>
                      <Markdown className="prose prose-sm max-w-none text-gray-800">{page.summary}</Markdown>
                    </div>
                    <div className="space-y-1 bg-gray-100 rounded-md p-2">
                      <h5 className="font-semibold text-gray-700">Content (extracted from page)</h5>
                      <Markdown className="prose prose-sm max-w-none text-gray-800">{page.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
