# PlugMeIn - HacknRoll Project

Audio transcription application with prank login flow and real-time speech analysis.

## Project Structure

```
.
├── back-end/          # Flask backend with Whisper AI transcription
├── filler/            # Prank login frontend (port 3000)
├── uno-reverse/       # Real analysis frontend (port 8080)
└── README.md          # This file
```

## Quick Start

### 1. Backend Setup (Flask + Whisper)

```bash
cd back-end
pip install -r requirements.txt
python app.py
```

Backend runs on **http://localhost:8081**

### 2. Real Frontend Setup (uno-reverse)

```bash
cd uno-reverse
npm install
npm run dev
```

Main app runs on **http://localhost:8080**

### 3. Prank Frontend Setup (filler) - Optional

```bash
cd filler
npm install
npm run dev
```

Prank UI runs on **http://localhost:3000**

## User Flow

1. **Prank Login** (http://localhost:3000)
   - User goes through fake login screens
   - Camera/mic access requested during "biometric verification"
   - Backend secretly starts recording and analyzing

2. **Fake Reveal Dashboard** 
   - Shows fake "analysis" data
   - Reveals it was a prank

3. **Real Analysis** (Redirect to http://localhost:8080)
   - Shows actual transcription of what user said
   - Real metrics and analysis from backend

## Integration Overview

### Architecture

```
┌──────────────────────┐         ┌──────────────────────┐
│  Filler (Prank)      │         │   Flask Backend      │
│  Port 3000           │         │   Port 8081          │
│                      │         │                      │
│  → Redirects to →    │ ──────► │ • Whisper AI         │
│                      │   API   │ • Transcription      │
└──────────────────────┘         │ • Session Storage    │
                                 └──────────────────────┘
                                          ▲
┌──────────────────────┐                 │
│  Uno-Reverse (Real)  │                 │
│  Port 8080           │ ────────────────┘
│                      │       API
│ • Real transcription │
│ • Metrics display    │
│ • Judge dashboard    │
└──────────────────────┘
```

### Key Integration Features

1. **Vite Proxy Configuration** (both frontends)
   - Frontend proxies `/api/*` requests to backend
   - Eliminates CORS issues in development

2. **Seamless Redirect Flow**
   - Filler (port 3000) redirects to Uno-Reverse (port 8080)
   - Backend session maintained across redirect

3. **Real-Time Transcription**
   - 30-second audio chunks
   - Persistent session storage
   - Live transcript updates

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Check backend status |
| `/api/transcribe-chunk` | POST | Transcribe audio chunk |
| `/api/get-transcripts` | POST | Get full session transcript |

## Development Workflow

1. Start backend first (Flask on 8081)
2. Start uno-reverse (main app on 8080)
3. Optionally start filler (prank on 3000)
4. Both frontends proxy API calls to backend
5. All support hot reload

## Technologies

### Filler Frontend (Prank UI)
- React 18 + TypeScript
- Vite
- Shadcn/ui components
- Framer Motion
- Redirects to main app

### Uno-Reverse Frontend (Real App)
- React 18 + TypeScript  
- Vite
- Real-time transcription
- Judge metrics display
- Camera feed integration

### Backend
- Flask
- OpenAI Whisper
- Flask-CORS
- Pydub (audio processing)
- Python-dotenv

## Features

✅ **Prank Login Flow** - Fake biometric verification  
✅ **Real-time Transcription** - 30-second chunks  
✅ **Session Management** - Multiple concurrent sessions  
✅ **Seamless Redirect** - From prank to real app  
✅ **Judge Metrics** - Live analysis display  
✅ **Modern UI** - Responsive design with animations  

## Troubleshooting

**"Backend Offline" message:**
- Ensure Flask is running: `cd back-end && python app.py`
- Check port 8081 is not blocked

**Port conflicts:**
- Filler: port 3000
- Uno-Reverse: port 8080
- Backend: port 8081

**Microphone not working:**
- Allow microphone permissions in browser
- Use HTTPS in production (required for mic access)

**Transcription errors:**
- Verify Whisper model loaded (check backend logs)
- Ensure audio format is supported (webm/wav)

**Redirect not working:**
- Make sure uno-reverse is running on port 8080
- Check console for errors

## Project Context

This is a HacknRoll hackathon project featuring:
- A prank login flow that secretly records the user
- Real-time speech transcription using Whisper AI
- "Uno reverse" reveal - the user was being judged all along!
- Full-stack integration with React + Flask
