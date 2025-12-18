/**
 * Franchise Form Components
 */

import React from 'react'
import PropTypes from 'prop-types'
import {
  Box,
  TextField,
  Typography,
  Link,
  CircularProgress,
  LinearProgress,
  Chip,
} from '@mui/material'
import { formatFileSize } from '../../../utils/fileValidation'

/** File upload field with compression progress */
export const FileUploadField = React.memo(function FileUploadField({ 
  name, 
  label, 
  required = true, 
  accept = 'image/jpeg,image/png,application/pdf',
  formData,
  processingFiles,
  compressionProgress,
  handleFileChange,
}) {
  const isProcessing = processingFiles[name] ?? false
  const progress = compressionProgress[name] ?? 0
  const fileData = formData[name]
  
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1 }}>
        {label}
      </Typography>
      <TextField
        type="file"
        name={name}
        onChange={handleFileChange}
        fullWidth
        required={required}
        size="small"
        disabled={isProcessing}
        InputLabelProps={{ shrink: true }}
        inputProps={{ accept }}
      />
      
      {/* Compression Progress Bar */}
      {isProcessing && (
        <Box sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CircularProgress size={14} sx={{ color: '#0A356B' }} />
            <Typography variant="caption" sx={{ color: '#0A356B', fontWeight: 500 }}>
              Compressing... {progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 6, 
              borderRadius: 3,
              backgroundColor: '#E5E7EB',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#0A356B',
                borderRadius: 3,
              },
            }} 
          />
        </Box>
      )}
      
      {/* File Info Display */}
      {fileData && !isProcessing && (
        <Box sx={{ 
          mt: 1, 
          p: 1, 
          backgroundColor: '#F0FDF4', 
          borderRadius: 1,
          border: '1px solid #86EFAC',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <Typography variant="caption" sx={{ color: '#166534', fontWeight: 500 }}>
            ✓ {fileData.name}
          </Typography>
          {fileData.originalSize && fileData.compressedSize && fileData.originalSize !== fileData.compressedSize && (
            <Chip 
              label={`${formatFileSize(fileData.originalSize)} → ${formatFileSize(fileData.compressedSize)}`}
              size="small"
              sx={{ 
                backgroundColor: '#DCFCE7',
                color: '#166534',
                fontSize: '0.7rem',
                height: 20,
              }}
            />
          )}
        </Box>
      )}
    </Box>
  )
})

FileUploadField.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  accept: PropTypes.string,
  formData: PropTypes.object.isRequired,
  processingFiles: PropTypes.object.isRequired,
  compressionProgress: PropTypes.object.isRequired,
  handleFileChange: PropTypes.func.isRequired,
}

/** Document link with preview capability */
export const DocumentLink = React.memo(function DocumentLink({ 
  label, 
  document, 
  onPreview, 
  getFileIcon 
}) {
  return (
    <>
      <Typography variant="subtitle2" className="label">{label}:</Typography>
      {document ? (
        <Link className="document-link" onClick={() => onPreview(document)}>
          {getFileIcon(document?.type)}
          <span>{document?.name}</span>
        </Link>
      ) : (
        <Typography sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          Not uploaded
        </Typography>
      )}
    </>
  )
})

DocumentLink.propTypes = {
  label: PropTypes.string.isRequired,
  document: PropTypes.object,
  onPreview: PropTypes.func.isRequired,
  getFileIcon: PropTypes.func.isRequired,
}
