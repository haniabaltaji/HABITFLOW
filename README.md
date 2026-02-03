# HabitFlow 🎯

A full-stack habit tracking application with customizable tasks, daily check-ins, leaderboard, and challenges.

## Features

- **User Authentication**: Sign up and login with email/password
- **Customizable Tasks**: Create task templates with different input types:
  - ✓ Simple Checkbox
  - 🔢 Number Input (with targets)
  - 🌙 Time Range (for sleep tracking)
  - 📝 Multiple Choice
  - ▼ Dropdown Selection
  - ✏️ Text Input
  - 💪 Workout Log (sets & reps)
  - ⭐ Rating (1-5 stars)
- **Daily Check-ins**: Track your progress each day
- **Leaderboard**: Compete with others (weekly, monthly, all-time)
- **Challenges**: Create and join challenges with friends

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Start the Backend**
   ```bash
   cd backend
   npm install
   node server.js
   ```
   Backend runs on http://localhost:3001

2. **Start the Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs on http://localhost:3000

3. Open http://localhost:3000 in your browser

### Or use the start script (Linux/Mac)
```bash
chmod +x start.sh
./start.sh
```

## Project Structure

```
habitflow/
├── backend/
│   ├── server.js          # Express API server
│   ├── package.json       # Backend dependencies
│   └── habitflow.db       # SQLite database (created on first run)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React application
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Styles
│   ├── index.html         # HTML template
│   ├── vite.config.js     # Vite configuration
│   └── package.json       # Frontend dependencies
├── start.sh               # Startup script
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/signup` - Create new account
- `POST /api/login` - Login to account

### Tasks
- `GET /api/tasks` - Get all task templates
- `POST /api/tasks` - Create new task template
- `PUT /api/tasks/:id` - Update task template
- `DELETE /api/tasks/:id` - Delete task template

### Check-ins
- `GET /api/checkins?date=YYYY-MM-DD` - Get check-ins for date
- `POST /api/checkins` - Save check-in

### Leaderboard
- `GET /api/leaderboard?period=week|month|all` - Get rankings

### Challenges
- `GET /api/challenges` - Get all challenges
- `POST /api/challenges` - Create challenge
- `POST /api/challenges/:id/join` - Join challenge
- `POST /api/challenges/:id/leave` - Leave challenge

### Stats
- `GET /api/stats` - Get user statistics

## Tech Stack

- **Frontend**: React 18, Vite
- **Backend**: Express.js, sql.js (SQLite)
- **Auth**: JWT tokens, bcrypt

## License

MIT
