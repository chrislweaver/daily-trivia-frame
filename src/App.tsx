import { sdk } from '@farcaster/frame-sdk'
import { useEffect, useState, useCallback } from 'react'
import './index.css'

// Types
interface Question {
  id: number
  question: string
  options: string[]
  correct?: number
  category: string
  funFact?: string
}

interface UserData {
  fid: number
  username?: string
  currentStreak: number
  longestStreak: number
  lastPlayed: string | null
  lastCorrect: boolean
  totalPlayed: number
  totalCorrect: number
}

interface LeaderboardEntry {
  fid: number
  username?: string
  streak: number
  total: number
}

interface GameState {
  answered: boolean
  selectedOption: number | null
  isCorrect: boolean | null
  funFact: string | null
}

// API base URL - use env or relative path
const API_BASE = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)
  const [context, setContext] = useState<any>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  const [questionNumber, setQuestionNumber] = useState(0)
  const [gameState, setGameState] = useState<GameState>({
    answered: false,
    selectedOption: null,
    isCorrect: null,
    funFact: null,
  })
  const [showAnimation, setShowAnimation] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize SDK and load data
  useEffect(() => {
    const init = async () => {
      try {
        // Initialize Frame SDK
        const ctx = await sdk.context
        setContext(ctx)
        await sdk.actions.ready()
        
        const fid = ctx?.user?.fid
        if (fid) {
          // Fetch user data from API
          const response = await fetch(`${API_BASE}/api/user/${fid}`)
          const data = await response.json()
          
          setUserData(data.user)
          setQuestion(data.question)
          setQuestionNumber(data.questionNumber)
          
          if (data.hasPlayedToday && data.todaysAnswer) {
            setGameState({
              answered: true,
              selectedOption: null, // We don't track which option in the API
              isCorrect: data.todaysAnswer.correct,
              funFact: data.question.funFact,
            })
          }
        } else {
          // Fallback: just get the question
          const response = await fetch(`${API_BASE}/api/question`)
          const data = await response.json()
          setQuestion(data)
          setQuestionNumber(data.questionNumber)
        }
        
        // Load leaderboard
        const lbResponse = await fetch(`${API_BASE}/api/leaderboard`)
        const lbData = await lbResponse.json()
        setLeaderboard(lbData.leaderboard || [])
        
      } catch (e) {
        console.error('Init error:', e)
        setError('Failed to load trivia. Please try again.')
        
        // Fallback to question endpoint
        try {
          const response = await fetch(`${API_BASE}/api/question`)
          const data = await response.json()
          setQuestion(data)
          setQuestionNumber(data.questionNumber)
        } catch (e2) {
          console.error('Fallback error:', e2)
        }
      }
      
      setIsSDKLoaded(true)
      setLoading(false)
    }
    init()
  }, [])

  const handleAnswer = useCallback(async (optionIndex: number) => {
    if (gameState.answered || !context?.user?.fid) return

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: context.user.fid,
          username: context.user.username,
          answerIndex: optionIndex,
        }),
      })
      
      const data = await response.json()
      
      if (data.error && data.error !== 'Already played today') {
        setError(data.error)
        return
      }

      setShowAnimation(true)
      setGameState({
        answered: true,
        selectedOption: optionIndex,
        isCorrect: data.isCorrect,
        funFact: data.funFact || question?.funFact || null,
      })
      setUserData(data.user)

      // Update question with correct answer
      if (question) {
        setQuestion({ ...question, correct: data.correctAnswer })
      }

      setTimeout(() => setShowAnimation(false), 1000)
    } catch (e) {
      console.error('Answer error:', e)
      setError('Failed to submit answer. Please try again.')
    }
    setLoading(false)
  }, [gameState.answered, context, question])

  const shareResult = useCallback(async () => {
    if (!userData || !question) return
    
    const emoji = gameState.isCorrect ? '✅' : '❌'
    const streakEmoji = userData.currentStreak > 0 ? '🔥' : ''
    
    const castText = `Daily Trivia #${questionNumber} ${emoji}\n\n${streakEmoji}${userData.currentStreak > 0 ? ` ${userData.currentStreak} day streak!` : 'Building my streak...'}\n\nCategory: ${question.category}\n\nPlay today's question 👇`

    try {
      await sdk.actions.composeCast({
        text: castText,
        embeds: [window.location.origin],
      })
    } catch (e) {
      // Fallback for outside frame
      const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(window.location.origin)}`
      window.open(shareUrl, '_blank')
    }
  }, [gameState.isCorrect, userData, questionNumber, question])

  if (loading && !isSDKLoaded) {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-icon">🧠</span>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !question) {
    return (
      <div className="app">
        <div className="error-screen">
          <span className="error-icon">😵</span>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">🧠</div>
        <h1>Daily Trivia</h1>
        <p className="subtitle">Question #{questionNumber} • {question?.category}</p>
      </header>

      <main className="main">
        {showLeaderboard ? (
          // Leaderboard View
          <div className="leaderboard-card">
            <div className="leaderboard-header">
              <h2>🏆 Leaderboard</h2>
              <button className="close-btn" onClick={() => setShowLeaderboard(false)}>✕</button>
            </div>
            
            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <p className="no-entries">No entries yet. Be the first!</p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div key={entry.fid} className={`leaderboard-entry ${entry.fid === userData?.fid ? 'current-user' : ''}`}>
                    <span className="rank">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</span>
                    <span className="user-name">@{entry.username || `fid:${entry.fid}`}</span>
                    <span className="user-streak">🔥 {entry.streak}</span>
                    <span className="user-total">✓ {entry.total}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : gameState.answered && question ? (
          // Results View
          <div className={`result-card ${showAnimation ? (gameState.isCorrect ? 'correct-animation' : 'wrong-animation') : ''}`}>
            <div className={`result-header ${gameState.isCorrect ? 'correct' : 'wrong'}`}>
              <span className="result-emoji">{gameState.isCorrect ? '🎉' : '😅'}</span>
              <span className="result-text">{gameState.isCorrect ? 'Correct!' : 'Not quite!'}</span>
            </div>

            <div className="question-review">
              <p className="question-text">{question.question}</p>
              
              <div className="options-review">
                {question.options.map((option, index) => (
                  <div
                    key={index}
                    className={`option-review ${
                      index === question.correct ? 'correct-answer' : ''
                    } ${
                      index === gameState.selectedOption && index !== question.correct ? 'wrong-answer' : ''
                    }`}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                    <span className="option-text">{option}</span>
                    {index === question.correct && <span className="checkmark">✓</span>}
                    {index === gameState.selectedOption && index !== question.correct && (
                      <span className="crossmark">✗</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {gameState.funFact && (
              <div className="fun-fact">
                <span className="fact-icon">💡</span>
                <p>{gameState.funFact}</p>
              </div>
            )}

            {userData && (
              <div className="streak-display">
                <div className="streak-item">
                  <span className="streak-icon">🔥</span>
                  <span className="streak-number">{userData.currentStreak}</span>
                  <span className="streak-label">Current Streak</span>
                </div>
                <div className="streak-item">
                  <span className="streak-icon">🏆</span>
                  <span className="streak-number">{userData.longestStreak}</span>
                  <span className="streak-label">Best Streak</span>
                </div>
                <div className="streak-item">
                  <span className="streak-icon">📊</span>
                  <span className="streak-number">{userData.totalPlayed > 0 ? Math.round((userData.totalCorrect / userData.totalPlayed) * 100) : 0}%</span>
                  <span className="streak-label">Accuracy</span>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button className="share-btn" onClick={shareResult}>
                📢 Share Result
              </button>
              <button className="leaderboard-btn" onClick={() => setShowLeaderboard(true)}>
                🏆 Leaderboard
              </button>
            </div>

            <p className="comeback-text">Come back tomorrow for a new question!</p>
          </div>
        ) : question ? (
          // Question View
          <div className="question-card">
            <p className="question-text">{question.question}</p>
            
            <div className="options">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-btn ${loading ? 'disabled' : ''}`}
                  onClick={() => handleAnswer(index)}
                  disabled={loading || !context?.user?.fid}
                >
                  <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="option-text">{option}</span>
                </button>
              ))}
            </div>

            {!context?.user?.fid && (
              <p className="login-prompt">Open in Warpcast to play and track your streak!</p>
            )}

            {userData && userData.currentStreak > 0 && (
              <div className="streak-preview">
                <p>🔥 {userData.currentStreak} day streak! Keep it going!</p>
              </div>
            )}

            <button className="leaderboard-link" onClick={() => setShowLeaderboard(true)}>
              🏆 View Leaderboard
            </button>
          </div>
        ) : null}
      </main>

      <footer className="footer">
        <p>Built with 🧠 for Farcaster</p>
        {context?.user?.username && (
          <p className="user-info">Playing as @{context.user.username}</p>
        )}
      </footer>
    </div>
  )
}
