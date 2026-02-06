import express from 'express';
import cors from 'cors';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';

const app = express();
const JWT_SECRET = 'habitflow-secret-key-2024';
const DB_FILE = './habitflow.db';

app.use(cors());
app.use(express.json());

let db;

// Initialize database
async function initDb() {
  const SQL = await initSqlJs();
  
  // Load existing db or create new
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
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

// Helper to run queries
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
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
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

// AUTH ROUTES
app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if user exists
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

// TASK TEMPLATES ROUTES
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

// CHECKIN ROUTES
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
  
  // Check if checkin exists for this task and date
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

// LEADERBOARD ROUTE
app.get('/api/leaderboard', authenticate, (req, res) => {
  const { period } = req.query;
  const currentUserId = req.user.id;
  
  console.log('Leaderboard request - Period:', period, 'User ID:', currentUserId);
  
  // Build date filter
  let dateFilter = '';
  if (period === 'week') {
    dateFilter = "AND c.date >= date('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = "AND c.date >= date('now', '-30 days')";
  }
  
  // Get all users first
  const users = runQuery('SELECT id, username FROM users');
  console.log('Found users:', users);
  
  // Build leaderboard with scores for each user
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
    console.log('Stats for user', user.username, ':', stats);
    
    return {
      id: user.id,
      username: user.username,
      completed_tasks: stats.completed_tasks || 0,
      total_checkins: stats.total_checkins || 0,
      avg_score: stats.avg_score || 0,
      total_score: stats.total_score || 0
    };
  });
  
  // Sort by total_score descending
  leaderboard.sort((a, b) => b.total_score - a.total_score || b.completed_tasks - a.completed_tasks);
  
  // Filter: keep users with activity OR the current user (always show yourself)
  const result = leaderboard.filter(player => 
    player.total_score > 0 || 
    player.completed_tasks > 0 || 
    player.id == currentUserId
  );
  
  console.log('Final leaderboard result:', result);
  
  // Safety net: if result is empty but we have a current user, add them
  if (result.length === 0) {
    const currentUserData = leaderboard.find(p => p.id == currentUserId);
    if (currentUserData) {
      result.push(currentUserData);
    }
  }
  
  res.json(result);
});

// CHALLENGES ROUTES
app.get('/api/challenges', authenticate, (req, res) => {
  const challenges = runQuery(`
    SELECT 
      ch.*,
      u.username as creator_name
    FROM challenges ch
    JOIN users u ON ch.creator_id = u.id
    ORDER BY ch.created_at DESC
  `);
  
  // Get participant counts and joined status
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
  const result = runExec(
    'INSERT INTO challenges (creator_id, title, description, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, title, description, start_date, end_date]
  );
  res.json({ id: result.lastInsertRowid, title, description, start_date, end_date });
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

// USER STATS
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
  
  // Calculate actual consecutive day streak (ending today or yesterday)
  const dates = runQuery(`
    SELECT DISTINCT date FROM checkins 
    WHERE user_id = ? AND completed = 1
    ORDER BY date DESC
  `, [req.user.id]);
  
  let streak = 0;
  if (dates.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Check if most recent checkin is today or yesterday
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

// Start server
const PORT = 3001;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`HabitFlow API running on http://localhost:${PORT}`);
  });
});
