import { useRef, useState } from 'react'
import { Alert, Box, LinearProgress, Paper, Stack, Typography } from '@mui/material'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { createThread, uploadFile } from '../api/backend'
import { useAppState } from '../context/AppContext'
import type { AppAction } from '../context/reducer'
import { normalizeError } from '../utils/errorMessage'

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB, mirrors the backend's limit

function validateFileClientSide(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type "${ext || 'unknown'}". Upload a CSV or Excel file (.csv, .xlsx, .xls).`
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return `File is ${sizeMb} MB, which exceeds the 10 MB limit.`
  }
  return null
}

function nextThreadTitle(fileName: string, existingTitles: string[]): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '')
  let title = baseName
  let counter = 1
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
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)

    const validationError = validateFileClientSide(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setUploading(true)
    try {
      const schema = await uploadFile(file)
      const existingTitles = state.threads.map((t) => t.title)
      const title = nextThreadTitle(file.name, existingTitles)

      // Create the backend thread right away (rather than waiting for the
      // user's first question) so it shows up in the sidebar immediately,
      // matching the previous local-only behavior.
      const detail = await createThread(schema.fileId, title)

      dispatch({
        type: 'UPSERT_THREAD',
        payload: { id: detail.threadId, title: detail.title, datasetId: schema.fileId, updatedAt: new Date().toISOString() },
      } as AppAction)
      dispatch({
        type: 'SET_ACTIVE_THREAD_DATA',
        payload: { threadId: detail.threadId, schema: detail.schema, messages: detail.messages },
      } as AppAction)
    } catch (err) {
      setError(normalizeError(err, 'Failed to upload file. Please try again.').message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 520, mx: 'auto' }}>
      <Paper
        variant="outlined"
        component="label"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          textAlign: 'center',
          px: 4,
          py: 6,
          borderRadius: 3,
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: isDragging ? 'primary.main' : 'divider',
          bgcolor: isDragging ? 'action.hover' : 'background.paper',
          cursor: uploading ? 'default' : 'pointer',
          transition: 'border-color .15s ease, background-color .15s ease',
          '&:hover': uploading ? undefined : { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleInputChange}
          disabled={uploading}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <Stack spacing={1.5} alignItems="center" sx={{ width: '100%', maxWidth: 260 }}>
            <UploadFileOutlinedIcon color="primary" sx={{ fontSize: 36 }} />
            <Typography variant="body2" color="text.secondary">
              Uploading and analyzing your file…
            </Typography>
            <LinearProgress sx={{ width: '100%', borderRadius: 1 }} />
          </Stack>
        ) : (
          <>
            <UploadFileOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
            <Typography variant="body1" fontWeight={600}>
              Click to upload or drag and drop
            </Typography>
            <Typography variant="caption" color="text.secondary">
              CSV or Excel files, up to 10 MB
            </Typography>
          </>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
