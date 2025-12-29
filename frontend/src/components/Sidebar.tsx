import { useState } from 'react'
import { useAppState } from '../context/AppContext'
import DataPreview from './DataPreview'

export default function Sidebar() {
  const { state } = useAppState()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  if (!state.schema) {
    return null
  }

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h3>Data Schema</h3>
        <div className="sidebar-controls">
          <button
            className="sidebar-toggle"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▼' : '▲'}
          </button>
          <button
            className="sidebar-collapse"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className="sidebar-content">
          <DataPreview />
        </div>
      )}
    </div>
  )
}

