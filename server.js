import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'habitflow-secret-key-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DB_FILE = './habitflow.db';
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

let db;

// Initialize database
async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS task_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT '📋',
      is_weekly INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      value TEXT,
      completed INTEGER DEFAULT 0,
      score REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (task_id) REFERENCES task_templates(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      creator_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT,
      end_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS challenge_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  saveDb();
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function runQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runExec(sql, params = []) {
  db.run(sql, params);
  saveDb();
  const result = db.exec("SELECT last_insert_rowid() as id");
  const lastId = result[0]?.values[0]?.[0] || null;
  return { lastInsertRowid: lastId };
}

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ============================================
// ADMIN PANEL ROUTES
// ============================================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid admin password' });
  }
});

// Admin middleware
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Not admin' });
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Dashboard Stats
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const users = runQuery('SELECT COUNT(*) as count FROM users')[0];
  const checkins = runQuery('SELECT COUNT(*) as count FROM checkins')[0];
  const tasks = runQuery('SELECT COUNT(*) as count FROM task_templates')[0];
  const challenges = runQuery('SELECT COUNT(*) as count FROM challenges')[0];
  const todayCheckins = runQuery("SELECT COUNT(*) as count FROM checkins WHERE date = date('now')")[0];
  const weeklyActiveUsers = runQuery("SELECT COUNT(DISTINCT user_id) as count FROM checkins WHERE date >= date('now', '-7 days')")[0];
  
  res.json({
    totalUsers: users.count,
    totalCheckins: checkins.count,
    totalTasks: tasks.count,
    totalChallenges: challenges.count,
    todayCheckins: todayCheckins.count,
    weeklyActiveUsers: weeklyActiveUsers.count
  });
});

// Get all users (admin)
app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = runQuery(`
    SELECT 
      u.id, u.username, u.email, u.created_at,
      COUNT(DISTINCT c.id) as total_checkins,
      COUNT(DISTINCT t.id) as total_tasks,
      MAX(c.date) as last_active
    FROM users u
    LEFT JOIN checkins c ON u.id = c.user_id
    LEFT JOIN task_templates t ON u.id = t.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  res.json(users);
});

// Get all checkins (admin)
app.get('/api/admin/checkins', adminAuth, (req, res) => {
  const checkins = runQuery(`
    SELECT 
      c.*, 
      u.username,
      t.name as task_name
    FROM checkins c
    JOIN users u ON c.user_id = u.id
    JOIN task_templates t ON c.task_id = t.id
    ORDER BY c.created_at DESC
    LIMIT 100
  `);
  res.json(checkins);
});

// Get all challenges (admin)
app.get('/api/admin/challenges', adminAuth, (req, res) => {
  const challenges = runQuery(`
    SELECT 
      ch.*,
      u.username as creator_name,
      COUNT(cp.id) as participant_count
    FROM challenges ch
    JOIN users u ON ch.creator_id = u.id
    LEFT JOIN challenge_participants cp ON ch.id = cp.challenge_id
    GROUP BY ch.id
    ORDER BY ch.created_at DESC
  `);
  res.json(challenges);
});

// Delete user (admin)
app.delete('/api/admin/users/:id', adminAuth, (req, res) => {
  const userId = req.params.id;
  runExec('DELETE FROM checkins WHERE user_id = ?', [userId]);
  runExec('DELETE FROM task_templates WHERE user_id = ?', [userId]);
  runExec('DELETE FROM challenge_participants WHERE user_id = ?', [userId]);
  runExec('DELETE FROM challenges WHERE creator_id = ?', [userId]);
  runExec('DELETE FROM users WHERE id = ?', [userId]);
  res.json({ success: true });
});

// Serve Admin Panel HTML
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HabitFlow Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; }
    .login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .login-box { background: #12121a; padding: 40px; border-radius: 16px; border: 1px solid #2a2a3a; width: 100%; max-width: 400px; }
    .login-box h1 { text-align: center; margin-bottom: 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    input { width: 100%; padding: 12px 16px; background: #1a1a25; border: 1px solid #2a2a3a; border-radius: 8px; color: #fff; font-size: 16px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #6366f1; }
    button { width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border: none; border-radius: 8px; color: white; font-size: 16px; cursor: pointer; }
    button:hover { opacity: 0.9; }
    .error { color: #ef4444; margin-bottom: 16px; text-align: center; }
    
    .dashboard { display: none; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #2a2a3a; }
    .header h1 { background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .logout-btn { background: #ef4444; padding: 8px 16px; border: none; border-radius: 6px; color: white; cursor: pointer; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; padding: 20px; }
    .stat-value { font-size: 36px; font-weight: 700; color: #6366f1; }
    .stat-label { color: #8888a0; margin-top: 4px; }
    
    .section { background: #12121a; border: 1px solid #2a2a3a; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .section h2 { margin-bottom: 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #2a2a3a; }
    th { color: #8888a0; font-weight: 500; }
    .delete-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
    .tab { padding: 10px 20px; background: #1a1a25; border: 1px solid #2a2a3a; border-radius: 8px; color: #8888a0; cursor: pointer; }
    .tab.active { background: #6366f1; border-color: #6366f1; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .badge-green { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .badge-blue { background: rgba(99, 102, 241, 0.2); color: #6366f1; }
  </style>
</head>
<body>
  <div class="login-container" id="loginContainer">
    <div class="login-box">
      <h1>🔐 Admin Panel</h1>
      <div class="error" id="error" style="display:none"></div>
      <input type="password" id="password" placeholder="Admin Password">
      <button onclick="login()">Login</button>
    </div>
  </div>

  <div class="dashboard" id="dashboard">
    <div class="header">
      <h1>📊 HabitFlow Admin</h1>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>

    <div class="stats-grid" id="statsGrid"></div>

    <div class="tabs">
      <div class="tab active" onclick="showTab('users')">👥 Users</div>
      <div class="tab" onclick="showTab('checkins')">✅ Checkins</div>
      <div class="tab" onclick="showTab('challenges')">🎯 Challenges</div>
    </div>

    <div id="users" class="tab-content active">
      <div class="section">
        <h2>All Users</h2>
        <table id="usersTable">
          <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Tasks</th><th>Checkins</th><th>Last Active</th><th>Actions</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div id="checkins" class="tab-content">
      <div class="section">
        <h2>Recent Checkins</h2>
        <table id="checkinsTable">
          <thead><tr><th>Date</th><th>User</th><th>Task</th><th>Completed</th><th>Score</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div id="challenges" class="tab-content">
      <div class="section">
        <h2>All Challenges</h2>
        <table id="challengesTable">
          <thead><tr><th>Title</th><th>Creator</th><th>Dates</th><th>Participants</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let token = localStorage.getItem('adminToken');
    
    if (token) showDashboard();

    async function login() {
      const password = document.getElementById('password').value;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok) {
          token = data.token;
          localStorage.setItem('adminToken', token);
          showDashboard();
        } else {
          document.getElementById('error').textContent = 'Invalid password';
          document.getElementById('error').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('error').textContent = 'Connection error';
        document.getElementById('error').style.display = 'block';
      }
    }

    function logout() {
      localStorage.removeItem('adminToken');
      location.reload();
    }

    async function showDashboard() {
      document.getElementById('loginContainer').style.display = 'none';
      document.getElementById('dashboard').style.display = 'block';
      await loadStats();
      await loadUsers();
      await loadCheckins();
      await loadChallenges();
    }

    async function api(endpoint) {
      const res = await fetch(endpoint, { headers: { 'Authorization': 'Bearer ' + token } });
      if (res.status === 401) { logout(); return null; }
      return res.json();
    }

    async function loadStats() {
      const stats = await api('/api/admin/stats');
      if (!stats) return;
      document.getElementById('statsGrid').innerHTML = \`
        <div class="stat-card"><div class="stat-value">\${stats.totalUsers}</div><div class="stat-label">Total Users</div></div>
        <div class="stat-card"><div class="stat-value">\${stats.weeklyActiveUsers}</div><div class="stat-label">Active This Week</div></div>
        <div class="stat-card"><div class="stat-value">\${stats.totalCheckins}</div><div class="stat-label">Total Checkins</div></div>
        <div class="stat-card"><div class="stat-value">\${stats.todayCheckins}</div><div class="stat-label">Today's Checkins</div></div>
        <div class="stat-card"><div class="stat-value">\${stats.totalTasks}</div><div class="stat-label">Task Templates</div></div>
        <div class="stat-card"><div class="stat-value">\${stats.totalChallenges}</div><div class="stat-label">Challenges</div></div>
      \`;
    }

    async function loadUsers() {
      const users = await api('/api/admin/users');
      if (!users) return;
      document.querySelector('#usersTable tbody').innerHTML = users.map(u => \`
        <tr>
          <td>\${u.id}</td>
          <td>\${u.username}</td>
          <td>\${u.email}</td>
          <td>\${u.total_tasks}</td>
          <td>\${u.total_checkins}</td>
          <td>\${u.last_active || 'Never'}</td>
          <td><button class="delete-btn" onclick="deleteUser(\${u.id})">Delete</button></td>
        </tr>
      \`).join('');
    }

    async function loadCheckins() {
      const checkins = await api('/api/admin/checkins');
      if (!checkins) return;
      document.querySelector('#checkinsTable tbody').innerHTML = checkins.map(c => \`
        <tr>
          <td>\${c.date}</td>
          <td>\${c.username}</td>
          <td>\${c.task_name}</td>
          <td><span class="badge \${c.completed ? 'badge-green' : ''}">\${c.completed ? 'Yes' : 'No'}</span></td>
          <td>\${c.score}</td>
        </tr>
      \`).join('');
    }

    async function loadChallenges() {
      const challenges = await api('/api/admin/challenges');
      if (!challenges) return;
      document.querySelector('#challengesTable tbody').innerHTML = challenges.map(c => \`
        <tr>
          <td>\${c.title}</td>
          <td>\${c.creator_name}</td>
          <td>\${c.start_date || ''} → \${c.end_date || ''}</td>
          <td><span class="badge badge-blue">\${c.participant_count} joined</span></td>
        </tr>
      \`).join('');
    }

    async function deleteUser(id) {
      if (!confirm('Delete this user and all their data?')) return;
      await fetch('/api/admin/users/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
      loadUsers();
      loadStats();
    }

    function showTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector(\`.tab[onclick="showTab('\${name}')"]\`).classList.add('active');
      document.getElementById(name).classList.add('active');
    }
  </script>
</body>
</html>
  `);
});

// ============================================
// USER AUTH ROUTES
// ============================================

app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existing = runQuery('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = runExec('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
    const token = jwt.sign({ id: result.lastInsertRowid, username, email }, JWT_SECRET);
    res.json({ token, user: { id: result.lastInsertRowid, username, email } });
  } catch (e) {
    res.status(400).json({ error: 'Signup failed: ' + e.message });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = runQuery('SELECT * FROM users WHERE email = ?', [email]);
  const user = users[0];
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// ============================================
// TASK TEMPLATES ROUTES
// ============================================

app.get('/api/tasks', authenticate, (req, res) => {
  const tasks = runQuery('SELECT * FROM task_templates WHERE user_id = ?', [req.user.id]);
  res.json(tasks.map(t => ({ ...t, config: JSON.parse(t.config || '{}') })));
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { name, type, config, color, icon, is_weekly } = req.body;
  const result = runExec(
    'INSERT INTO task_templates (user_id, name, type, config, color, icon, is_weekly) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, name, type, JSON.stringify(config || {}), color || '#6366f1', icon || '📋', is_weekly ? 1 : 0]
  );
  res.json({ id: result.lastInsertRowid, name, type, config, color, icon, is_weekly });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const { name, type, config, color, icon, is_weekly } = req.body;
  runExec(
    'UPDATE task_templates SET name = ?, type = ?, config = ?, color = ?, icon = ?, is_weekly = ? WHERE id = ? AND user_id = ?',
    [name, type, JSON.stringify(config || {}), color, icon, is_weekly ? 1 : 0, req.params.id, req.user.id]
  );
  res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  runExec('DELETE FROM task_templates WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  runExec('DELETE FROM checkins WHERE task_id = ?', [req.params.id]);
  res.json({ success: true });
});

// ============================================
// CHECKIN ROUTES
// ============================================

app.get('/api/checkins', authenticate, (req, res) => {
  const { date } = req.query;
  const checkins = runQuery(`
    SELECT c.*, t.name as task_name, t.type as task_type, t.config as task_config, t.color, t.icon
    FROM checkins c
    JOIN task_templates t ON c.task_id = t.id
    WHERE c.user_id = ? AND c.date = ?
  `, [req.user.id, date]);
  res.json(checkins.map(c => ({ ...c, task_config: JSON.parse(c.task_config || '{}') })));
});

app.post('/api/checkins', authenticate, (req, res) => {
  const { task_id, date, value, completed, score } = req.body;
  
  const existing = runQuery('SELECT id FROM checkins WHERE user_id = ? AND task_id = ? AND date = ?', [req.user.id, task_id, date]);
  
  if (existing.length > 0) {
    runExec('UPDATE checkins SET value = ?, completed = ?, score = ? WHERE id = ?', [value, completed ? 1 : 0, score || 0, existing[0].id]);
    res.json({ id: existing[0].id, updated: true });
  } else {
    const result = runExec(
      'INSERT INTO checkins (user_id, task_id, date, value, completed, score) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, task_id, date, value, completed ? 1 : 0, score || 0]
    );
    res.json({ id: result.lastInsertRowid, created: true });
  }
});

// ============================================
// LEADERBOARD ROUTE
// ============================================

app.get('/api/leaderboard', authenticate, (req, res) => {
  const { period } = req.query;
  const currentUserId = req.user.id;
  
  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND c.date >= date('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND c.date >= date('now', '-30 days')";
  }
  
  const users = runQuery('SELECT id, username FROM users');
  
  const leaderboard = users.map(user => {
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN completed = 1 THEN 1 END) as completed_tasks,
        COUNT(*) as total_checkins,
        COALESCE(ROUND(AVG(score), 1), 0) as avg_score,
        COALESCE(SUM(score), 0) as total_score
      FROM checkins c
      WHERE c.user_id = ? ${dateFilter}
    `;
    
    const stats = runQuery(statsQuery, [user.id])[0] || {};
    
    return {
      id: user.id,
      username: user.username,
      completed_tasks: stats.completed_tasks || 0,
      total_checkins: stats.total_checkins || 0,
      avg_score: stats.avg_score || 0,
      total_score: stats.total_score || 0
    };
  });
  
  leaderboard.sort((a, b) => b.total_score - a.total_score || b.completed_tasks - a.completed_tasks);
  
  const result = leaderboard.filter(player => 
    player.total_score > 0 || 
    player.completed_tasks > 0 || 
    player.id == currentUserId
  );
  
  if (result.length === 0) {
    const currentUserData = leaderboard.find(p => p.id == currentUserId);
    if (currentUserData) {
      result.push(currentUserData);
    }
  }
  
  res.json(result);
});

// ============================================
// CHALLENGES ROUTES
// ============================================

app.get('/api/challenges', authenticate, (req, res) => {
  const challenges = runQuery(`
    SELECT ch.*, u.username as creator_name
    FROM challenges ch
    JOIN users u ON ch.creator_id = u.id
    ORDER BY ch.created_at DESC
  `);
  
  const result = challenges.map(ch => {
    const countResult = runQuery('SELECT COUNT(*) as count FROM challenge_participants WHERE challenge_id = ?', [ch.id]);
    const joinedResult = runQuery('SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [ch.id, req.user.id]);
    return {
      ...ch,
      participant_count: countResult[0]?.count || 0,
      joined: joinedResult.length > 0 ? 1 : 0
    };
  });
  
  res.json(result);
});

app.post('/api/challenges', authenticate, (req, res) => {
  const { title, description, start_date, end_date } = req.body;
  try {
    const result = runExec(
      'INSERT INTO challenges (creator_id, title, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title, description, start_date, end_date]
    );
    // Auto-join creator to the challenge
    runExec('INSERT INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)', [result.lastInsertRowid, req.user.id]);
    res.json({ id: result.lastInsertRowid, title, description, start_date, end_date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/challenges/:id/join', authenticate, (req, res) => {
  try {
    const existing = runQuery('SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already joined' });
    }
    runExec('INSERT INTO challenge_participants (challenge_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Already joined' });
  }
});

app.post('/api/challenges/:id/leave', authenticate, (req, res) => {
  runExec('DELETE FROM challenge_participants WHERE challenge_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// ============================================
// USER STATS
// ============================================

app.get('/api/stats', authenticate, (req, res) => {
  const stats = runQuery(`
    SELECT 
      COUNT(DISTINCT date) as days_tracked,
      COUNT(CASE WHEN completed = 1 THEN 1 END) as tasks_completed,
      COUNT(*) as total_checkins,
      ROUND(AVG(score), 1) as avg_score
    FROM checkins
    WHERE user_id = ?
  `, [req.user.id]);
  
  const dates = runQuery(`
    SELECT DISTINCT date FROM checkins 
    WHERE user_id = ? AND completed = 1
    ORDER BY date DESC
  `, [req.user.id]);
  
  let streak = 0;
  if (dates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const mostRecent = dates[0].date;
    if (mostRecent === today || mostRecent === yesterday) {
      streak = 1;
      let expectedDate = new Date(mostRecent);
      
      for (let i = 1; i < dates.length; i++) {
        expectedDate.setDate(expectedDate.getDate() - 1);
        const expectedStr = expectedDate.toISOString().split('T')[0];
        
        if (dates[i].date === expectedStr) {
          streak++;
        } else {
          break;
        }
      }
    }
  }
  
  res.json({ ...stats[0], current_streak: streak });
});

// ============================================
// SERVE FRONTEND (Catch-all for SPA)
// ============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// START SERVER
// ============================================

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 HabitFlow running on port ${PORT}`);
    console.log(`📊 Admin panel: /admin`);
  });
});
