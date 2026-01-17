# Audio Transcription Backend

Flask backend for chunked audio transcription with Whisper and GPT-powered feedback.

## Features

- **Chunked Audio Processing**: Process audio in ~30-second chunks for faster feedback
- **Real-time Transcription**: Uses OpenAI Whisper for accurate speech-to-text
- **GPT Feedback**: Analyzes full transcripts and provides coaching feedback
- **CORS Enabled**: Ready for frontend integration

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Note: You may also need to install ffmpeg:
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`
- Windows: Download from https://ffmpeg.org/

### 2. Configure Environment

Copy `.env.example` to `.env` and add your OpenAI API key:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "message": "Backend is running"
}
```

### `POST /transcribe-chunk`
Process a single audio chunk.

**Request:**
- `audio`: Audio file (multipart/form-data)
- `chunkIndex`: Integer index of the chunk

**Response:**
```json
{
  "chunkIndex": 0,
  "text": "Transcribed text from this chunk...",
  "success": true
}
```

### `POST /gpt-feedback`
Generate feedback from full transcript.

**Request:**
```json
{
  "transcript": "Full transcript text...",
  "context": "public speaking" // optional
}
```

**Response:**
```json
{
  "feedback": "Detailed feedback from GPT...",
  "transcript": "Original transcript...",
  "success": true
}
```

### `POST /transcribe-full`
Transcribe a complete audio file (fallback for non-chunked uploads).

**Request:**
- `audio`: Audio file (multipart/form-data)

**Response:**
```json
{
  "text": "Full transcribed text...",
  "success": true
}
```

## Architecture

1. **Frontend** records audio in 30-second chunks
2. Each chunk is sent to `/transcribe-chunk` immediately
3. Backend processes with Whisper and returns partial transcript
4. When recording ends, frontend combines all transcripts
5. Combined transcript sent to `/gpt-feedback` for analysis
6. GPT returns coaching feedback

## Configuration

Edit `app.py` to customize:

- `WHISPER_MODEL_SIZE`: Change Whisper model (`tiny`, `base`, `small`, `medium`, `large`)
- `UPLOAD_FOLDER`: Directory for temporary audio files
- `ALLOWED_EXTENSIONS`: Supported audio formats

## Notes

- Audio files are automatically cleaned up after processing
- Chunks are converted to mono 16kHz WAV for optimal Whisper performance
- GPT-4 is used for feedback generation (can be changed to GPT-3.5-turbo for cost savings)
