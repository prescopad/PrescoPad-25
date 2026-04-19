#!/bin/bash

# PrescoPad Development Startup Script (macOS/Linux)
# This script starts both backend and frontend services

echo "==================================="
echo "   PrescoPad Development Server"
echo "==================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

echo "[1/5] Checking Node.js version..."
node --version
echo ""

# Check if backend exists
if [ ! -f "backend/package.json" ]; then
    echo "[ERROR] Backend not found in backend/"
    exit 1
fi

# Check if frontend exists
if [ ! -f "frontend/package.json" ]; then
    echo "[ERROR] Frontend not found in frontend/"
    exit 1
fi

echo "[2/5] Starting Backend Server..."
echo ""

# Start backend in background
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

echo "[3/5] Waiting for backend to initialize..."
sleep 5

# Test backend health
echo "[4/5] Testing backend connection..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "[SUCCESS] Backend is running!"
else
    echo "[WARNING] Backend may still be starting..."
    echo "Check backend.log for details"
fi
echo ""

echo "[5/5] Starting Frontend (Expo)..."
echo ""

# Start frontend
cd frontend
npm start

# When frontend exits (Ctrl+C), kill backend
echo ""
echo "Shutting down backend..."
kill $BACKEND_PID 2>/dev/null

echo ""
echo "==================================="
echo "  Services Stopped"
echo "==================================="
