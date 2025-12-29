import { useState, useRef } from 'react'
import { uploadFile } from '../api/backend'
import { useAppState } from '../context/AppContext'
import type { AppAction } from '../context/reducer'
import type { ChatThread } from '../types'

// Helper function to generate unique thread title based on file name
function generateThreadTitle(fileName: string, dispatch: any): string {
  const { state } = useAppState()
  const baseName = fileName.replace(/\.[^/.]+$/, '') // Remove extension
  const existingTitles = state.chatThreads.map(t => t.title)
  
  let title = baseName
  let counter = 1
  
  // Check if title exists, if so add counter
  while (existingTitles.includes(title)) {
    title = `${baseName} (${counter})`
    counter++
  }
  
  return title
}

export default function FileUpload() {
  const { state, dispatch } = useAppState()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    try {
      const schema = await uploadFile(file)
      // Add fileName to schema
      const schemaWithFileName = { ...schema, fileName: file.name }
      
      // If there's an active thread, update it with the file
      if (state.activeThreadId) {
        // Update the active thread with file and schema
        const baseName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
        const existingTitles = state.chatThreads.map(t => t.title)
        
        let title = baseName
        let counter = 1
        
        // Check if title exists, if so add counter
        while (existingTitles.includes(title)) {
          title = `${baseName} (${counter})`
          counter++
        }
        
        // Update the thread with file info
        dispatch({ 
          type: 'UPDATE_THREAD_FILE', 
          payload: {
            threadId: state.activeThreadId,
            fileId: schemaWithFileName.fileId,
            schema: schemaWithFileName,
            title: title,
          }
        } as AppAction)
      } else {
        // Create a new chat thread with file name
        const baseName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
        const existingTitles = state.chatThreads.map(t => t.title)
        
        let title = baseName
        let counter = 1
        
        // Check if title exists, if so add counter
        while (existingTitles.includes(title)) {
          title = `${baseName} (${counter})`
          counter++
        }
        
        const newThread: ChatThread = {
          id: Date.now().toString(),
          title: title,
          messages: [],
          fileId: schemaWithFileName.fileId,
          schema: schemaWithFileName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        dispatch({ type: 'SET_SCHEMA', payload: schemaWithFileName } as AppAction)
        dispatch({ type: 'CREATE_CHAT_THREAD', payload: newThread } as AppAction)
      }
    } catch (err: any) {
      // Enhanced error handling
      let errorMessage = 'Failed to upload file. Please try again.'
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.message) {
        errorMessage = err.message
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Upload timeout. The file may be too large or the connection is slow.'
      }

      // Log error for debugging (only in development)
      if (import.meta.env.DEV) {
        console.error('File upload error:', {
          error: err,
          message: err.message,
          status: err.response?.status,
          requestId: err.requestId || err.response?.data?.requestId,
        })
      }

      setError(errorMessage)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      const fakeEvent = {
        target: { files: [file] },
      } as any
      handleFileSelect(fakeEvent)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  return (
    <div className="file-upload">
      <div
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ display: 'none' }}
          id="file-input"
        />
        <label htmlFor="file-input" className="upload-label">
          {uploading ? (
            <span>Uploading...</span>
          ) : (
            <>
              <span className="upload-icon">📁</span>
              <span>Click to upload or drag and drop</span>
              <span className="upload-hint">CSV or Excel files (max 10MB)</span>
            </>
          )}
        </label>
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

