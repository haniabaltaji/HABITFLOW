#!/bin/bash

echo "🚀 Starting HabitFlow..."

# Kill any existing processes
pkill -f "node server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Start backend
echo "Starting backend server..."
cd backend
npm install
node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "Starting frontend..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ HabitFlow is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for both processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
