'use client'

import { trpc } from '@/lib/trpc-provider'
import { useState } from 'react'

// Upload icon component
const UploadIcon = () => (
  <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
    <path
      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// File preview component
const FilePreview = ({ file, onRemove, onUpload, isUploading }: {
  file: File
  onRemove: () => void
  onUpload: () => void
  isUploading: boolean
}) => (
  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-900">{file.name}</p>
        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
      </div>
      <div className="space-x-2">
        <button onClick={onRemove} className="text-sm text-gray-500 hover:text-gray-700">
          Remove
        </button>
        <button
          onClick={onUpload}
          disabled={isUploading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isUploading ? 'Processing...' : 'Upload & Process'}
        </button>
      </div>
    </div>
  </div>
)

// Status message component
const StatusMessage = ({ type, message }: { type: 'success' | 'error', message: string }) => {
  const styles = type === 'success' 
    ? 'bg-green-50 border-green-200 text-green-800'
    : 'bg-red-50 border-red-200 text-red-800'
  
  return (
    <div className={`mt-4 p-4 border rounded-lg ${styles}`}>
      <p>{type === 'error' ? `Error: ${message}` : message}</p>
    </div>
  )
}

// Main upload component
export function PDFUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const uploadMutation = trpc.uploadDocument.useMutation({
    onSuccess: () => setSelectedFile(null),
    onError: (error) => console.error('Upload failed:', error),
  })

  const handleDragEvents = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    handleDragEvents(e)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }
    setSelectedFile(file)
  }

  const uploadFile = async () => {
    if (!selectedFile) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = e.target?.result as string
      if (result) {
        const base64Data = result.split(',')[1] // Remove data:application/pdf;base64, prefix
        await uploadMutation.mutateAsync({
          filename: selectedFile.name,
          fileData: base64Data,
        })
      }
    }
    reader.readAsDataURL(selectedFile)
  }

  const dropzoneClass = `border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
  }`

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={dropzoneClass}
        onDragEnter={handleDragEvents}
        onDragLeave={handleDragEvents}
        onDragOver={handleDragEvents}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <UploadIcon />
          <div>
            <p className="text-lg font-medium text-gray-900">
              {selectedFile ? selectedFile.name : 'Upload PDF Document'}
            </p>
            <p className="text-sm text-gray-500">Drag and drop or click to select</p>
          </div>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
            id="file-input"
          />
          <label
            htmlFor="file-input"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
          >
            Choose File
          </label>
        </div>
      </div>

      {selectedFile && (
        <FilePreview
          file={selectedFile}
          onRemove={() => setSelectedFile(null)}
          onUpload={uploadFile}
          isUploading={uploadMutation.isPending}
        />
      )}

      {uploadMutation.isSuccess && (
        <StatusMessage type="success" message={uploadMutation.data?.message || 'Upload successful'} />
      )}

      {uploadMutation.isError && (
        <StatusMessage type="error" message={uploadMutation.error?.message || 'Upload failed'} />
      )}
    </div>
  )
}