import { useAppState } from '../context/AppContext'
import PromptInput from '../components/PromptInput'
import ChatHistory from '../components/ChatHistory'
import ContextualSuggestions from '../components/ContextualSuggestions'
import Suggestions from '../components/Suggestions'
import CosmicSidebar from '../components/CosmicSidebar'

export default function Dashboard() {
  const { state } = useAppState()

  return (
    <div className="page cosmic-home">
      <div className="starry-background"></div>
      {/* <div className="app-header">
        <h1 className="app-title">ORION DATA ANALYZER</h1>
      </div> */}
      <div className="home-layout">
        <CosmicSidebar />
        <main className="cosmic-main">
          <div className="chat-screen">
            <div className="chat-container">
              <ChatHistory />
              {state.chats.length > 0 && <ContextualSuggestions />}
            </div>
            {state.chats.length === 0 && (
              <div className="initial-suggestions-container">
                <Suggestions />
              </div>
            )}
            <div className="input-section">
              <PromptInput />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
