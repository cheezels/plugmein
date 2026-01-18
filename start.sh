#!/bin/bash

# PlugMeIn Startup Script
# Starts both backend and frontend services

echo "🚀 Starting PlugMeIn..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if Node is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install Node.js first."
    exit 1
fi

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start backend
echo "📡 Starting Flask backend on port 8081..."
cd "$SCRIPT_DIR/back-end"
if [ ! -d ".venv" ]; then
    echo "⚠️  Virtual environment not found. Please set up the backend first:"
    echo "   cd back-end && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

source .venv/bin/activate
python app.py &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo ""

# Wait a bit for backend to start
sleep 3

# Start frontend
echo "🎨 Starting React frontend on port 8080..."
cd "$SCRIPT_DIR/filler"
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "🎉 PlugMeIn is running!"
echo ""
echo "   Frontend:  http://localhost:8080"
echo "   Backend:   http://localhost:8081"
echo ""
echo "   Routes:"
echo "   • http://localhost:8080/            - Prank Login"
echo "   • http://localhost:8080/transcription - Audio Transcription"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both services"
echo ""

# Trap Ctrl+C and kill both processes
trap "echo ''; echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT

# Wait for both processes
wait
