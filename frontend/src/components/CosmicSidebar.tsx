import { useState, useEffect } from 'react'
import { useAppState } from '../context/AppContext'
import type { AppAction } from '../context/reducer'
import type { ChatThread } from '../types'

export default function CosmicSidebar() {
  const { state, dispatch } = useAppState()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleNewChat = () => {
    // Create a new blank chat thread and set it active
    const newThread: ChatThread = {
      id: Date.now().toString(),
      title: `Untitled Chat`,
      messages: [],
      fileId: null,
      schema: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    dispatch({ type: 'CREATE_CHAT_THREAD', payload: newThread } as AppAction)
  }

  const handleSelectThread = (threadId: string) => {
    dispatch({ type: 'SET_ACTIVE_THREAD', payload: threadId } as AppAction)
  }

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: 'DELETE_THREAD', payload: threadId } as AppAction)
  }

  const handleEditThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const thread = state.chatThreads.find(t => t.id === threadId)
    if (thread) {
      const newTitle = prompt('Edit chat name:', thread.title)
      if (newTitle !== null && newTitle.trim() !== '') {
        dispatch({ 
          type: 'UPDATE_THREAD_TITLE', 
          payload: { threadId, title: newTitle.trim() } 
        } as AppAction)
      }
    }
  }

  // Keyboard shortcut for New Chat (Ctrl+I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={`cosmic-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          {!isCollapsed && (
            <>
              <div className="logo-icon">⚡</div>
              <span>Orion AI</span>
            </>
          )}
        </div>
        <button
          className="collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <button className="new-thread-btn" onClick={handleNewChat}>
            <span>+ New Chat</span>
            <span className="shortcut-hint">Ctrl+I</span>
          </button>

          <nav className="sidebar-nav">
            <a href="#" className="nav-item active">
              <span className="nav-icon">🏠</span>
              <span>Home</span>
            </a>
          </nav>

          <div className="chat-threads">
            <div className="threads-header">Recent Chats</div>
            <div className="threads-list">
              {state.chatThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`thread-item ${state.activeThreadId === thread.id ? 'active' : ''}`}
                  onClick={() => handleSelectThread(thread.id)}
                >
                  <span className="thread-title">{thread.title}</span>
                  <div className="thread-actions">
                    <button
                      className="edit-thread-btn"
                      onClick={(e) => handleEditThread(thread.id, e)}
                      title="Edit chat name"
                    >
                      ✎
                    </button>
                    <button
                      className="delete-thread-btn"
                      onClick={(e) => handleDeleteThread(thread.id, e)}
                      title="Delete thread"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
