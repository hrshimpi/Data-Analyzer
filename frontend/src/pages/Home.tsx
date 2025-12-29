import { useAppState } from '../context/AppContext'
import FileUpload from '../components/FileUpload'
import ChatHistory from '../components/ChatHistory'
import PromptInput from '../components/PromptInput'
import ContextualSuggestions from '../components/ContextualSuggestions'
import Suggestions from '../components/Suggestions'
import CosmicSidebar from '../components/CosmicSidebar'

export default function Home() {
  const { state } = useAppState()
  const hasFile = !!state.fileId
  const hasMessages = state.chats.length > 0
  const hasActiveThread = !!state.activeThreadId

  return (
    <div className="page cosmic-home">
      <div className="starry-background"></div>
      {/* <div className="app-header">
        <h1 className="app-title">ORION DATA ANALYZER</h1>
      </div> */}
      <div className="home-layout">
        <CosmicSidebar />
        <main className="cosmic-main">
          {!hasFile && hasActiveThread ? (
            <div className="welcome-screen">
              <div className="greeting-container">
                <h1 className="main-greeting">Hi, this is Orion</h1>
                <p className="sub-greeting">Please upload your file here</p>
              </div>
              <div className="upload-section">
                <FileUpload />
              </div>
            </div>
          ) : !hasFile ? (
            <div className="welcome-screen">
              <div className="greeting-container">
                <h1 className="main-greeting">Hi, this is Orion</h1>
                <p className="sub-greeting">Please upload your file here</p>
              </div>
              <div className="upload-section">
                <FileUpload />
              </div>
            </div>
          ) : (
            <div className="chat-screen">
              {!hasMessages && (
                <div className="greeting-container">
                  <h1 className="main-greeting">Hi, this is Orion</h1>
                  <p className="sub-greeting">Ask anything about your data</p>
                </div>
              )}
              <div className="chat-container">
                <ChatHistory />
                {hasFile && state.chats.length > 0 && <ContextualSuggestions />}
              </div>
              {hasFile && state.chats.length === 0 && (
                <div className="initial-suggestions-container">
                  <Suggestions />
                </div>
              )}
              <div className="input-section">
                <PromptInput />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
