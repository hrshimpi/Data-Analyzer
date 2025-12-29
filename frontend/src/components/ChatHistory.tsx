import { useAppState } from '../context/AppContext'
import ChartRenderer from './ChartRenderer'

export default function ChatHistory() {
  const { state } = useAppState()

  // Get messages from active thread or fallback to legacy chats
  const activeThread = state.activeThreadId 
    ? state.chatThreads.find(t => t.id === state.activeThreadId)
    : null
  const messages = activeThread?.messages || state.chats

  if (messages.length === 0) {
    return (
      <div className="chat-history empty">
        <p>No conversations yet. Ask a question to get started!</p>
      </div>
    )
  }

  return (
    <div className="chat-history">
      {messages.map((message) => (
        <div key={message.id} className={`chat-message ${message.role}`}>
          <div className="message-header">
            <span className="message-role">
              {message.role === 'user' ? 'You' : 'Orion'}
            </span>
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="message-content">
            {message.content.split('\n').map((line, idx) => {
              // Check if line is a status note
              if (line.trim().startsWith('*Note:') && line.trim().endsWith('*')) {
                return (
                  <div key={idx} className="chart-status-message">
                    {line.replace(/^\*Note:\s*/, '').replace(/\*$/, '')}
                  </div>
                )
              }
              return <div key={idx}>{line}</div>
            })}
          </div>
          {message.charts && message.charts.length > 0 && (
            <div className="message-charts">
              <ChartRenderer charts={message.charts} />
            </div>
          )}
          {message.chartStatus && message.chartStatus !== 'success' && (
            <div className={`chart-status-notice ${message.chartStatus}`}>
              {message.chartMessage || 'Chart generation encountered an issue.'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

