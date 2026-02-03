import { useState, useEffect } from 'react'

const API_URL = '/api'

// Task types configuration
const TASK_TYPES = {
  checkbox: { label: 'Simple Checkbox', icon: '✓' },
  number: { label: 'Number Input', icon: '🔢' },
  time_range: { label: 'Time Range (Sleep)', icon: '🌙' },
  mcq: { label: 'Multiple Choice', icon: '📝' },
  dropdown: { label: 'Dropdown', icon: '▼' },
  text: { label: 'Text Input', icon: '✏️' },
  workout: { label: 'Workout Log', icon: '💪' },
  rating: { label: 'Rating (1-5)', icon: '⭐' }
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6']
const ICONS = ['📋', '💧', '🏃', '📖', '🧘', '🙏', '💤', '🍎', '💊', '✍️', '🎯', '⏰', '🔥', '💪', '🧠', '❤️', '🌟', '☀️', '🌙', '🎨']

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [activeTab, setActiveTab] = useState('checkin')
  const [tasks, setTasks] = useState([])
  const [checkins, setCheckins] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [challenges, setChallenges] = useState([])
  const [stats, setStats] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('week')

  // Auth state
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' })
  const [authError, setAuthError] = useState('')

  // Fetch headers with auth
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // Load user from token
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser(payload)
      } catch (e) {
        setToken(null)
        localStorage.removeItem('token')
      }
    }
  }, [token])

  // Fetch data when logged in
  useEffect(() => {
    if (token) {
      fetchTasks()
      fetchStats()
    }
  }, [token])

  useEffect(() => {
    if (token && activeTab === 'checkin') {
      fetchCheckins()
    }
  }, [token, selectedDate, activeTab])

  useEffect(() => {
    if (token && activeTab === 'leaderboard') {
      fetchLeaderboard()
    }
  }, [token, activeTab, leaderboardPeriod])

  useEffect(() => {
    if (token && activeTab === 'challenges') {
      fetchChallenges()
    }
  }, [token, activeTab])

  // API calls
  const fetchTasks = async () => {
    const res = await fetch(`${API_URL}/tasks`, { headers: authHeaders })
    const data = await res.json()
    setTasks(data)
  }

  const fetchCheckins = async () => {
    const res = await fetch(`${API_URL}/checkins?date=${selectedDate}`, { headers: authHeaders })
    const data = await res.json()
    setCheckins(data)
  }

  const fetchLeaderboard = async () => {
    const res = await fetch(`${API_URL}/leaderboard?period=${leaderboardPeriod}`, { headers: authHeaders })
    const data = await res.json()
    setLeaderboard(data)
  }

  const fetchChallenges = async () => {
    const res = await fetch(`${API_URL}/challenges`, { headers: authHeaders })
    const data = await res.json()
    setChallenges(data)
  }

  const fetchStats = async () => {
    const res = await fetch(`${API_URL}/stats`, { headers: authHeaders })
    const data = await res.json()
    setStats(data)
  }

  // Auth handlers
  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError('')
    
    const endpoint = authMode === 'login' ? '/login' : '/signup'
    const body = authMode === 'login' 
      ? { email: authForm.email, password: authForm.password }
      : authForm

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      
      if (res.ok) {
        setToken(data.token)
        localStorage.setItem('token', data.token)
        setUser(data.user)
      } else {
        setAuthError(data.error)
      }
    } catch (e) {
      setAuthError('Connection error. Please try again.')
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  // Task handlers
  const saveTask = async (taskData) => {
    const method = editingTask ? 'PUT' : 'POST'
    const url = editingTask ? `${API_URL}/tasks/${editingTask.id}` : `${API_URL}/tasks`
    
    await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(taskData)
    })
    
    fetchTasks()
    setShowTaskModal(false)
    setEditingTask(null)
  }

  const deleteTask = async (taskId) => {
    if (confirm('Delete this task template?')) {
      await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: authHeaders
      })
      fetchTasks()
    }
  }

  // Checkin handlers
  const saveCheckin = async (taskId, value, completed, score) => {
    await fetch(`${API_URL}/checkins`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ task_id: taskId, date: selectedDate, value, completed, score })
    })
    fetchCheckins()
    fetchStats()
  }

  // Challenge handlers
  const saveChallenge = async (challengeData) => {
    await fetch(`${API_URL}/challenges`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(challengeData)
    })
    fetchChallenges()
    setShowChallengeModal(false)
  }

  const joinChallenge = async (challengeId) => {
    await fetch(`${API_URL}/challenges/${challengeId}/join`, {
      method: 'POST',
      headers: authHeaders
    })
    fetchChallenges()
  }

  const leaveChallenge = async (challengeId) => {
    await fetch(`${API_URL}/challenges/${challengeId}/leave`, {
      method: 'POST',
      headers: authHeaders
    })
    fetchChallenges()
  }

  // Date navigation
  const changeDate = (days) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  // Auth Page
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">HabitFlow</div>
          <p className="auth-subtitle">Track your daily habits & compete with friends</p>
          
          {authError && <div className="error-message">{authError}</div>}
          
          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={authForm.username}
                  onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  placeholder="Choose a username"
                  required
                />
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={authForm.email}
                onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          
          <p className="auth-toggle">
            {authMode === 'login' ? (
              <>Don't have an account? <a onClick={() => setAuthMode('signup')}>Sign up</a></>
            ) : (
              <>Already have an account? <a onClick={() => setAuthMode('login')}>Sign in</a></>
            )}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="logo">HabitFlow</div>
        <p className="logo-sub">Track • Compete • Grow</p>
        
        <nav>
          <div className={`nav-item ${activeTab === 'checkin' ? 'active' : ''}`} onClick={() => setActiveTab('checkin')}>
            <span className="nav-icon">📋</span>
            <span>Daily Check-in</span>
          </div>
          <div className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>
            <span className="nav-icon">⚙️</span>
            <span>My Tasks</span>
          </div>
          <div className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
            <span className="nav-icon">🏆</span>
            <span>Leaderboard</span>
          </div>
          <div className={`nav-item ${activeTab === 'challenges' ? 'active' : ''}`} onClick={() => setActiveTab('challenges')}>
            <span className="nav-icon">🎯</span>
            <span>Challenges</span>
          </div>
        </nav>
        
        <div className="user-section">
          <div className="user-info">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.username}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Daily Check-in Tab */}
        {activeTab === 'checkin' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Daily Check-in</h1>
              <p className="page-subtitle">Track your progress and build habits</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.current_streak || 0}</div>
                <div className="stat-label">Day Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.tasks_completed || 0}</div>
                <div className="stat-label">Tasks Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.avg_score || 0}</div>
                <div className="stat-label">Avg Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.days_tracked || 0}</div>
                <div className="stat-label">Days Tracked</div>
              </div>
            </div>

            <div className="date-nav">
              <button className="date-btn" onClick={() => changeDate(-1)}>← Previous</button>
              <span className="current-date">
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <button className="date-btn" onClick={() => changeDate(1)}>Next →</button>
              <button className="date-btn" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>Today</button>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">No tasks yet</div>
                <p>Create your first task template to start tracking</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setActiveTab('tasks'); setShowTaskModal(true) }}>
                  Create Task
                </button>
              </div>
            ) : (
              <div className="tasks-grid">
                {tasks.map(task => {
                  const checkin = checkins.find(c => c.task_id === task.id) || {}
                  return (
                    <TaskCheckinCard
                      key={task.id}
                      task={task}
                      checkin={checkin}
                      onSave={(value, completed, score) => saveCheckin(task.id, value, completed, score)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Tasks Management Tab */}
        {activeTab === 'tasks' && (
          <>
            <div className="page-header">
              <h1 className="page-title">My Tasks</h1>
              <p className="page-subtitle">Create and customize your habit templates</p>
            </div>

            <button className="btn btn-primary" onClick={() => { setEditingTask(null); setShowTaskModal(true) }} style={{ marginBottom: 24 }}>
              + Add New Task
            </button>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">⚙️</div>
                <div className="empty-title">No tasks created</div>
                <p>Create task templates with different input types</p>
              </div>
            ) : (
              <div className="tasks-grid">
                {tasks.map(task => (
                  <div key={task.id} className="task-card">
                    <div className="task-header">
                      <div className="task-icon" style={{ background: task.color + '22', color: task.color }}>
                        {task.icon}
                      </div>
                      <div>
                        <div className="task-name">{task.name}</div>
                        <div className="task-type">{TASK_TYPES[task.type]?.label || task.type}</div>
                      </div>
                    </div>
                    <div className="task-actions">
                      <button className="task-action-btn edit" onClick={() => { setEditingTask(task); setShowTaskModal(true) }}>
                        Edit
                      </button>
                      <button className="task-action-btn delete" onClick={() => deleteTask(task.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Leaderboard</h1>
              <p className="page-subtitle">See how you rank against others</p>
            </div>

            <div className="filter-tabs">
              <button className={`filter-tab ${leaderboardPeriod === 'week' ? 'active' : ''}`} onClick={() => setLeaderboardPeriod('week')}>
                This Week
              </button>
              <button className={`filter-tab ${leaderboardPeriod === 'month' ? 'active' : ''}`} onClick={() => setLeaderboardPeriod('month')}>
                This Month
              </button>
              <button className={`filter-tab ${leaderboardPeriod === 'all' ? 'active' : ''}`} onClick={() => setLeaderboardPeriod('all')}>
                All Time
              </button>
            </div>

            <div className="card">
              {leaderboard.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏆</div>
                  <div className="empty-title">No rankings yet</div>
                  <p>Complete some check-ins to appear on the leaderboard</p>
                </div>
              ) : (
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Tasks Done</th>
                      <th>Avg Score</th>
                      <th>Total Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, i) => (
                      <tr key={player.id} style={player.id === user?.id ? { background: 'rgba(99, 102, 241, 0.1)' } : {}}>
                        <td>
                          <span className={`rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                            #{i + 1}
                          </span>
                        </td>
                        <td>
                          <div className="player-info">
                            <div className="player-avatar">{player.username[0].toUpperCase()}</div>
                            <span>{player.username} {player.id === user?.id && '(You)'}</span>
                          </div>
                        </td>
                        <td>{player.completed_tasks || 0}</td>
                        <td>{player.avg_score || 0}</td>
                        <td><span className="score-badge">{player.total_score || 0}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Challenges</h1>
              <p className="page-subtitle">Join challenges and compete with friends</p>
            </div>

            <button className="btn btn-primary" onClick={() => setShowChallengeModal(true)} style={{ marginBottom: 24 }}>
              + Create Challenge
            </button>

            {challenges.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <div className="empty-title">No challenges yet</div>
                <p>Create a challenge to compete with others</p>
              </div>
            ) : (
              challenges.map(ch => (
                <div key={ch.id} className="challenge-card">
                  <div className="challenge-header">
                    <div>
                      <div className="challenge-title">{ch.title}</div>
                      <div className="challenge-meta">
                        <span>by {ch.creator_name}</span>
                        {ch.start_date && <span>📅 {ch.start_date} → {ch.end_date}</span>}
                      </div>
                    </div>
                    <span className="participants-badge">👥 {ch.participant_count} joined</span>
                  </div>
                  {ch.description && <p className="challenge-description">{ch.description}</p>}
                  {ch.joined ? (
                    <button className="btn btn-outline btn-sm" onClick={() => leaveChallenge(ch.id)}>Leave Challenge</button>
                  ) : (
                    <button className="btn btn-success btn-sm" onClick={() => joinChallenge(ch.id)}>Join Challenge</button>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={editingTask}
          onClose={() => { setShowTaskModal(false); setEditingTask(null) }}
          onSave={saveTask}
        />
      )}

      {/* Challenge Modal */}
      {showChallengeModal && (
        <ChallengeModal
          onClose={() => setShowChallengeModal(false)}
          onSave={saveChallenge}
        />
      )}
    </div>
  )
}

// Task Checkin Card Component
function TaskCheckinCard({ task, checkin, onSave }) {
  const [value, setValue] = useState(checkin.value || '')
  const [completed, setCompleted] = useState(checkin.completed === 1)

  useEffect(() => {
    setValue(checkin.value || '')
    setCompleted(checkin.completed === 1)
  }, [checkin])

  const handleSave = (newValue, newCompleted) => {
    // Calculate score based on task type and completion
    let score = 0
    if (newCompleted) {
      score = 10 // Full completion
    } else if (newValue && newValue !== '' && newValue !== '[]' && newValue !== '{}') {
      score = 5 // Partial (has value but not complete)
    }
    onSave(typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue || ''), newCompleted, score)
  }

  const renderInput = () => {
    const config = task.config || {}
    
    switch (task.type) {
      case 'checkbox':
        return (
          <div className="checkbox-wrapper" onClick={() => { setCompleted(!completed); handleSave(value, !completed) }}>
            <div className={`checkbox ${completed ? 'checked' : ''}`}></div>
            <span>{completed ? 'Completed!' : 'Mark as done'}</span>
          </div>
        )
      
      case 'number':
        const numVal = parseInt(value) || 0
        return (
          <div className="number-input">
            <button onClick={() => { setValue(Math.max(0, numVal - 1)); handleSave(Math.max(0, numVal - 1), numVal - 1 >= (config.target || 0)) }}>-</button>
            <input type="number" className="form-input" value={numVal} onChange={e => setValue(e.target.value)} onBlur={() => handleSave(numVal, numVal >= (config.target || 0))} />
            <button onClick={() => { setValue(numVal + 1); handleSave(numVal + 1, numVal + 1 >= (config.target || 0)) }}>+</button>
            {config.unit && <span style={{ color: '#8888a0' }}>{config.unit}</span>}
            {config.target && <span style={{ color: '#8888a0' }}>/ {config.target}</span>}
          </div>
        )
      
      case 'time_range':
        const times = value ? (typeof value === 'string' ? JSON.parse(value) : value) : { sleep: '', wake: '' }
        return (
          <div className="time-inputs">
            <input 
              type="time" 
              className="form-input" 
              value={times.sleep || ''} 
              onChange={e => { const t = { ...times, sleep: e.target.value }; setValue(JSON.stringify(t)); handleSave(t, t.sleep && t.wake) }} 
              style={{ width: 'auto' }}
            />
            <span>→</span>
            <input 
              type="time" 
              className="form-input" 
              value={times.wake || ''} 
              onChange={e => { const t = { ...times, wake: e.target.value }; setValue(JSON.stringify(t)); handleSave(t, t.sleep && t.wake) }}
              style={{ width: 'auto' }}
            />
          </div>
        )
      
      case 'mcq':
        const mcqOptions = config.options && config.options.length > 0 ? config.options : ['Option 1', 'Option 2', 'Option 3']
        return (
          <div className="mcq-options">
            {mcqOptions.filter(opt => opt.trim()).map((opt, i) => (
              <div key={i} className={`mcq-option ${value === opt ? 'selected' : ''}`} onClick={() => { setValue(opt); handleSave(opt, true) }}>
                {opt}
              </div>
            ))}
          </div>
        )
      
      case 'dropdown':
        const dropdownOptions = config.options && config.options.length > 0 ? config.options : ['Option 1', 'Option 2', 'Option 3']
        return (
          <select className="form-input" value={value} onChange={e => { setValue(e.target.value); handleSave(e.target.value, !!e.target.value) }}>
            <option value="">Select...</option>
            {dropdownOptions.filter(opt => opt.trim()).map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        )
      
      case 'text':
        return (
          <textarea 
            className="form-input" 
            placeholder="Enter your notes..." 
            value={value} 
            onChange={e => setValue(e.target.value)}
            onBlur={() => handleSave(value, !!value)}
            rows={3}
          />
        )
      
      case 'workout':
        const workoutData = value ? (typeof value === 'string' ? JSON.parse(value) : value) : { title: '', exercises: [] }
        const updateWorkout = (newData) => {
          setValue(JSON.stringify(newData))
          const hasContent = newData.title || newData.exercises.some(ex => ex.name || ex.sets.some(s => s.reps))
          handleSave(newData, hasContent)
        }
        const addExercise = () => {
          const newData = { ...workoutData, exercises: [...workoutData.exercises, { name: '', sets: [{ reps: '', weight: '' }] }] }
          updateWorkout(newData)
        }
        const updateExerciseName = (exIdx, name) => {
          const newData = { ...workoutData }
          newData.exercises[exIdx].name = name
          updateWorkout(newData)
        }
        const addSetToExercise = (exIdx) => {
          const newData = { ...workoutData }
          newData.exercises[exIdx].sets.push({ reps: '', weight: '' })
          updateWorkout(newData)
        }
        const updateSetInExercise = (exIdx, setIdx, field, val) => {
          const newData = { ...workoutData }
          newData.exercises[exIdx].sets[setIdx][field] = val
          updateWorkout(newData)
        }
        const removeExercise = (exIdx) => {
          const newData = { ...workoutData, exercises: workoutData.exercises.filter((_, i) => i !== exIdx) }
          updateWorkout(newData)
        }
        return (
          <div className="workout-log">
            <input 
              type="text" 
              className="form-input workout-title" 
              placeholder="Workout Title (e.g., Push Day, Leg Day)" 
              value={workoutData.title || ''} 
              onChange={e => updateWorkout({ ...workoutData, title: e.target.value })}
              style={{ marginBottom: 12, fontWeight: 600 }}
            />
            {workoutData.exercises.map((exercise, exIdx) => (
              <div key={exIdx} className="exercise-block" style={{ background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Exercise name (e.g., Bench Press)" 
                    value={exercise.name} 
                    onChange={e => updateExerciseName(exIdx, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-outline btn-sm" onClick={() => removeExercise(exIdx)} style={{ color: '#ef4444', borderColor: '#ef4444' }}>✕</button>
                </div>
                {exercise.sets.map((set, setIdx) => (
                  <div key={setIdx} className="workout-set" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#8888a0', width: 45 }}>Set {setIdx + 1}:</span>
                    <input type="number" className="form-input" placeholder="Reps" value={set.reps} onChange={e => updateSetInExercise(exIdx, setIdx, 'reps', e.target.value)} style={{ width: 70 }} />
                    <span style={{ color: '#8888a0' }}>×</span>
                    <input type="number" className="form-input" placeholder="lbs" value={set.weight} onChange={e => updateSetInExercise(exIdx, setIdx, 'weight', e.target.value)} style={{ width: 70 }} />
                    <span style={{ fontSize: 12, color: '#8888a0' }}>lbs</span>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" onClick={() => addSetToExercise(exIdx)} style={{ marginTop: 4, fontSize: 11 }}>+ Add Set</button>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" onClick={addExercise} style={{ marginTop: 8 }}>+ Add Exercise</button>
          </div>
        )
      
      case 'rating':
        const rating = parseInt(value) || 0
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <span 
                key={n} 
                style={{ fontSize: 28, cursor: 'pointer', opacity: n <= rating ? 1 : 0.3 }}
                onClick={() => { setValue(n); handleSave(n, true) }}
              >
                ⭐
              </span>
            ))}
          </div>
        )
      
      default:
        return <input type="text" className="form-input" value={value} onChange={e => setValue(e.target.value)} onBlur={() => handleSave(value, !!value)} />
    }
  }

  return (
    <div className={`task-card ${completed ? 'completed' : ''}`}>
      <div className="task-header">
        <div className="task-icon" style={{ background: task.color + '22', color: task.color }}>
          {task.icon}
        </div>
        <div>
          <div className="task-name">{task.name}</div>
          <div className="task-type">{TASK_TYPES[task.type]?.label || task.type}</div>
        </div>
      </div>
      <div className="task-input">
        {renderInput()}
      </div>
    </div>
  )
}

// Task Modal Component
function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState({
    name: task?.name || '',
    type: task?.type || 'checkbox',
    color: task?.color || '#6366f1',
    icon: task?.icon || '📋',
    is_weekly: task?.is_weekly || false,
    config: task?.config || {}
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{task ? 'Edit Task' : 'Create New Task'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Task Name</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Drink Water, Meditate, Workout"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Input Type</label>
            <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value, config: {} })}>
              {Object.entries(TASK_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>

          {/* Type-specific config */}
          {form.type === 'number' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Unit (optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.config.unit || ''}
                  onChange={e => setForm({ ...form, config: { ...form.config, unit: e.target.value } })}
                  placeholder="e.g., glasses, minutes"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Daily Target</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.config.target || ''}
                  onChange={e => setForm({ ...form, config: { ...form.config, target: e.target.value } })}
                  placeholder="e.g., 8"
                />
              </div>
            </div>
          )}

          {(form.type === 'mcq' || form.type === 'dropdown') && (
            <div className="form-group">
              <label className="form-label">Options (one per line)</label>
              <textarea
                className="form-input"
                value={(form.config.options || ['Option 1', 'Option 2', 'Option 3']).join('\n')}
                onChange={e => setForm({ ...form, config: { ...form.config, options: e.target.value.split('\n') } })}
                placeholder="Enter each option on a new line:&#10;Option 1&#10;Option 2&#10;Option 3"
                rows={5}
                style={{ resize: 'vertical' }}
              />
              <small style={{ color: '#8888a0', fontSize: 12 }}>Press Enter to add each option on a new line</small>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-options">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`color-option ${form.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Icon</label>
            <div className="icon-options">
              {ICONS.map(ic => (
                <div
                  key={ic}
                  className={`icon-option ${form.icon === ic ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, icon: ic })}
                >
                  {ic}
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Task</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Challenge Modal Component
function ChallengeModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create Challenge</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Challenge Title</label>
            <input
              type="text"
              className="form-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., 30 Day Fitness Challenge"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the challenge..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Challenge</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default App
