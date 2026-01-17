from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import os
import whisper
from pydub import AudioSegment
from openai import OpenAI
from dotenv import load_dotenv
import logging
from google import genai
from google.genai import types

# Load environment variables (GEMINI_API_KEY, etc.) from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {'webm', 'wav', 'mp3', 'ogg', 'm4a'}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize Whisper model
logger.info("Loading Whisper model...")
whisper_model = whisper.load_model("base")
logger.info("Whisper model loaded successfully")

# Initialize Gemini client
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# In-memory storage for accumulated transcripts per session
# Key: session_id, Value: list of (chunk_index, text) tuples
transcript_storage = {}

# Track active WebSocket connections and their device type
# Structure: {socket_id: {sessionId, deviceType ('presenter' or 'controller')}}
active_sessions = {}

# Track which session IDs have active presenters
# Structure: {session_id: socket_id}
presenter_sessions = {}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_to_wav(input_path, output_path):
    """Convert audio file to WAV format (mono, 16kHz)"""
    try:
        sound = AudioSegment.from_file(input_path)
        sound = sound.set_channels(1).set_frame_rate(16000)
        sound.export(output_path, format="wav")
        return True
    except Exception as e:
        logger.error(f"Error converting audio: {str(e)}")
        return False

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    print("Health check requested")
    return jsonify({"status": "healthy", "message": "Backend is running"}), 200

@app.route("/transcribe-chunk", methods=["POST"])
def transcribe_chunk():
    """Process a single audio chunk, transcribe it, and store for later GPT feedback"""
    print("Transcribe chunk requested")
    try:
        # Validate request
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        chunk_index = int(request.form.get('chunkIndex', 0))
        session_id = request.form.get('sessionId', 'default')

        if audio_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400

        # Save the audio file
        filename = f"chunk_{chunk_index}_{audio_file.filename}"
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        audio_file.save(file_path)

        logger.info(f"Processing chunk {chunk_index} for session {session_id}")

        # Convert to WAV
        wav_path = file_path + ".wav"
        if not convert_to_wav(file_path, wav_path):
            return jsonify({"error": "Failed to convert audio"}), 500

        # Transcribe with Whisper
        result = whisper_model.transcribe(wav_path, language="en")
        text = result["text"].strip()

        logger.info(f"Chunk {chunk_index} transcribed: {len(text)} characters")

        # Store the transcript for this session
        if session_id not in transcript_storage:
            transcript_storage[session_id] = []
        transcript_storage[session_id].append((chunk_index, text))

        logger.info(f"Session {session_id} now has {len(transcript_storage[session_id])} chunks stored")

        # Clean up files
        try:
            os.remove(file_path)
            os.remove(wav_path)
        except:
            pass

        return jsonify({
            "chunkIndex": chunk_index,
            "text": text,
            "success": True
        }), 200

    except Exception as e:
        logger.error(f"Error in transcribe_chunk: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/gemini-feedback", methods=["POST"])
def gemini_feedback():
    """Collect transcripts and generate feedback using Google Gemini"""
    try:
        data = request.get_json() or {}
        session_id = data.get('sessionId', 'default')

        if session_id not in transcript_storage or not transcript_storage[session_id]:
            return jsonify({"error": "No transcripts found for this session"}), 400

        # Combine transcripts
        chunks = transcript_storage[session_id]
        chunks.sort(key=lambda x: x[0])
        transcript = " ".join([text for _, text in chunks])

        logger.info(f"Generating Gemini feedback for session {session_id} ({len(transcript)} chars)")

        # Configuration for Gemini
        system_prompt = """
        ### ROLE
        You are a "Reverse Judge"—a witty, slightly arrogant, but ultimately helpful presentation coach. 
        You are judging a speech as if the tables have turned and YOU are judging the ones who gave feedback.

        ### TONE & PERSONALITY
        - Sarcastic, funny, and "nitpicky." 
        - Flame the user for small mistakes (stuttering, buzzwords) but pivot to supportive advice.
        - Never mention you are an AI. Do not be generic.

        ### EVALUATION CRITERIA
        1. Content & Structure: Did they explain the "How" or just the "Why"?
        2. Clarity & Coherence: Are transcription errors hiding a lack of thought?
        3. Engagement & Impact: Was there a "hook" or just boredom?
        4. The "Nitpick" List: Call out verbal tics and buzzword abuse.

        ### OUTPUT FORMAT
        - The Roasting (Summary): A 2-sentence witty "burn".
        - The Deep Dive: 4 Bullet points for the criteria above.
        - The "Judge's Mercy" (Action Plan): 3 specific actionable steps.
        """

        # Call Gemini API
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Please analyze this speech transcript and provide feedback:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=1000
            )
        )

        feedback = response.text

        logger.info("Gemini feedback generated successfully")

        # Second call to get a numeric score
        score_prompt = """You are a judge scoring a hackathon presentation.
        Based on the transcript provided, give a single number score from 0-100.
        Consider: content quality, clarity, structure, engagement, and overall impact.

        IMPORTANT: Respond with ONLY a number between 0 and 100. No other text."""

        # temperature=0.3: More deterministic for scoring (consistent results)
        score_response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Score this presentation transcript from 0-100:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=score_prompt,
                temperature=0.3,
                max_output_tokens=10
            )
        )

        # Parse the score, default to 50 if parsing fails
        try:
            score = int(score_response.text.strip())
            score = max(0, min(100, score))  # Clamp between 0-100
        except ValueError:
            logger.warning(f"Failed to parse score: {score_response.text}")
            score = 50

        logger.info(f"Score generated: {score}")

        # Clear storage
        del transcript_storage[session_id]
        logger.info(f"Cleared transcripts for session {session_id}")

        return jsonify({
            "feedback": feedback,
            "transcript": transcript,
            "score": score,
            "success": True
        }), 200

    except Exception as e:
        logger.error(f"Error in gemini_feedback: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/controller", methods=["GET"])
def controller():
    """
    Serve a simple mobile controller page for remote recording control.
    
    This page can be opened on a mobile phone/tablet to remotely control
    the presentation recording on the main presenter device.
    
    Features:
    - Input field for session ID (to connect to correct presentation)
    - Toggle Recording button (sends command to presenter device)
    - Real-time WebSocket connection for instant feedback
    
    Usage:
    1. Open http://presenter-ip:8081/controller on your phone
    2. Enter the session ID shown on presenter screen
    3. Click "Toggle Recording" to start/stop recording on presenter device
    """
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recording Controller</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                padding: 40px;
                max-width: 400px;
                width: 100%;
            }
            h1 {
                text-align: center;
                color: #333;
                margin-bottom: 10px;
                font-size: 28px;
            }
            .subtitle {
                text-align: center;
                color: #999;
                margin-bottom: 30px;
                font-size: 14px;
            }
            .form-group {
                margin-bottom: 20px;
            }
            label {
                display: block;
                margin-bottom: 8px;
                color: #555;
                font-weight: 600;
                font-size: 14px;
            }
            input {
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #667eea;
            }
            .status {
                text-align: center;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 14px;
                font-weight: 600;
            }
            .status.connected {
                background: #e8f5e9;
                color: #2e7d32;
            }
            .status.disconnected {
                background: #ffebee;
                color: #c62828;
            }
            button {
                width: 100%;
                padding: 16px;
                border: none;
                border-radius: 8px;
                font-size: 18px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.3s;
            }
            .toggle-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            .toggle-btn:active {
                transform: scale(0.98);
            }
            .toggle-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
            }
            .recording {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .info-box {
                background: #f5f5f5;
                border-left: 4px solid #667eea;
                padding: 15px;
                border-radius: 4px;
                margin-top: 20px;
                font-size: 13px;
                color: #666;
                line-height: 1.6;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎥 Recording Controller</h1>
            <p class="subtitle">Remote Presentation Control</p>
            
            <div id="status" class="status disconnected">
                🔴 Disconnected
            </div>
            
            <div class="form-group">
                <label for="sessionId">Session ID:</label>
                <input 
                    type="text" 
                    id="sessionId" 
                    placeholder="Enter session ID from presenter screen"
                    autocomplete="off"
                >
            </div>
            
            <button id="connectBtn" class="toggle-btn">
                Connect to Session
            </button>
            
            <button id="toggleBtn" class="toggle-btn" style="margin-top: 10px;" disabled>
                ▶️ Start Recording
            </button>
            
            <div class="info-box">
                <strong>How to use:</strong><br>
                1. Get the session ID from the presenter screen<br>
                2. Enter it above and click "Connect"<br>
                3. Click "Start Recording" to begin<br>
                4. Click "Stop Recording" when done
            </div>
        </div>

        <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
        <script>
            let socket = null;
            let isConnected = false;
            let isRecording = false;
            let currentSessionId = null;
            
            const statusEl = document.getElementById('status');
            const sessionIdEl = document.getElementById('sessionId');
            const connectBtn = document.getElementById('connectBtn');
            const toggleBtn = document.getElementById('toggleBtn');
            
            // Initialize Socket.IO connection
            function initSocket() {
                socket = io();
                
                socket.on('connect', () => {
                    console.log('✅ WebSocket connected to backend');
                });
                
                socket.on('disconnect', () => {
                    updateStatus(false);
                });
                
                // Listen for session verification response
                socket.on('session_verified', (data) => {
                    if (data.valid) {
                        console.log('✅ Session verified successfully');
                        updateStatus(true);
                    } else {
                        console.log('❌ Session not found');
                        alert('❌ Session not found! Please check the session ID.');
                        updateStatus(false);
                    }
                });
                
                // Listen for errors
                socket.on('error', (data) => {
                    alert('❌ Error: ' + data.message);
                    console.error('Error from server:', data.message);
                });
                
                // Listen for recording state changes from presenter
                socket.on('recording_state_changed', (data) => {
                    isRecording = data.isRecording;
                    updateRecordingButton();
                });
            }
            
            function updateStatus(connected) {
                isConnected = connected;
                if (connected) {
                    statusEl.textContent = '🟢 Connected';
                    statusEl.className = 'status connected';
                    sessionIdEl.disabled = true;
                    connectBtn.textContent = 'Disconnect';
                    toggleBtn.disabled = false;
                } else {
                    statusEl.textContent = '🔴 Disconnected';
                    statusEl.className = 'status disconnected';
                    sessionIdEl.disabled = false;
                    connectBtn.textContent = 'Connect to Session';
                    toggleBtn.disabled = true;
                    isRecording = false;
                    currentSessionId = null;
                    updateRecordingButton();
                }
            }
            
            function updateRecordingButton() {
                if (isRecording) {
                    toggleBtn.textContent = '⏹️ Stop Recording';
                    toggleBtn.classList.add('recording');
                } else {
                    toggleBtn.textContent = '▶️ Start Recording';
                    toggleBtn.classList.remove('recording');
                }
            }
            
            connectBtn.addEventListener('click', () => {
                if (!isConnected) {
                    const sessionId = sessionIdEl.value.trim();
                    if (!sessionId) {
                        alert('❌ Please enter a session ID');
                        return;
                    }
                    
                    // Emit join session event - backend will verify the session exists
                    console.log('📱 Attempting to join session:', sessionId);
                    currentSessionId = sessionId;
                    socket.emit('join_session', {
                        sessionId: sessionId,
                        deviceType: 'controller'
                    });
                    
                    // Wait for verification response (handled in socket.on('session_verified'))
                } else {
                    socket.disconnect();
                    updateStatus(false);
                }
            });
            
            toggleBtn.addEventListener('click', () => {
                if (isConnected && currentSessionId) {
                    const sessionId = currentSessionId;
                    console.log('📱 Sending toggle recording command for session:', sessionId);
                    socket.emit('toggle_recording', {
                        sessionId: sessionId
                    });
                }
            });
            
            // Initialize on page load
            initSocket();
        </script>
    </body>
    </html>
    """


# WEBSOCKET EVENT HANDLERS (for remote control functionality)
@socketio.on('connect')
def handle_connect():

    print(f"Client connected: {request.sid}")

@socketio.on('join_session')
def handle_join(data):
    session_id = data.get('sessionId')
    device_type = data.get('deviceType')  # 'presenter' or 'controller'
    
    # Track this connection
    active_sessions[request.sid] = {'sessionId': session_id, 'type': device_type}
    
    # If this is a presenter, register the session
    if device_type == 'presenter':
        presenter_sessions[session_id] = request.sid
        logger.info(f"Presenter registered for session {session_id}")
    
    # If this is a controller, verify the session exists
    if device_type == 'controller':
        if session_id in presenter_sessions:
            # Session exists and presenter is active
            emit('session_verified', {'valid': True, 'message': 'Session found'})
            logger.info(f"Controller connected to valid session {session_id}")
        else:
            # Session does not exist
            emit('session_verified', {'valid': False, 'message': 'Session not found'})
            logger.warning(f"Controller attempted to join non-existent session {session_id}")
            return  # Don't add to room if session doesn't exist
    
    # Add to room (all devices in same room can communicate)
    join_room(session_id)
    
    logger.info(f"Device ({device_type}) joined session {session_id}")
    print(f"Active sessions: {active_sessions}")
    print(f"Presenter sessions: {presenter_sessions}")

@socketio.on('toggle_recording')
def handle_toggle_recording(data):
    session_id = data.get('sessionId')
    
    # Verify the session exists and has an active presenter
    if session_id not in presenter_sessions:
        emit('error', {'message': 'Session not found or presenter is offline'})
        logger.warning(f"Toggle recording failed - session {session_id} not found")
        return
    
    logger.info(f"Toggle recording command received for session {session_id}")
    
    # Emit to all devices in this session (except sender)
    emit('toggle_recording_command', {'action': 'toggle'}, room=session_id, skip_sid=request.sid)
    
    print(f"Broadcasting toggle command to session: {session_id}")

@socketio.on('recording_state_update')
def handle_recording_state_update(data):
    """
    Handle recording state updates from the presenter.
    Broadcasts the current recording state to all connected devices (including controller).
    """
    session_id = data.get('sessionId')
    is_recording = data.get('isRecording')
    
    logger.info(f"Recording state update for session {session_id}: {is_recording}")
    
    # Broadcast to all devices in this session (except sender)
    emit('recording_state_changed', {
        'isRecording': is_recording
    }, room=session_id, skip_sid=request.sid)
    
    print(f"Broadcasting recording state to session {session_id}: {is_recording}")

@socketio.on('disconnect')
def handle_disconnect():
    """
    Handle client disconnection and cleanup.
    Remove from active sessions and presenter sessions if applicable.
    """
    if request.sid in active_sessions:
        session_info = active_sessions[request.sid]
        session_id = session_info['sessionId']
        device_type = session_info['type']
        
        # Remove from tracking
        del active_sessions[request.sid]
        
        # If it was a presenter, remove the session
        if device_type == 'presenter' and session_id in presenter_sessions:
            del presenter_sessions[session_id]
            logger.info(f"Presenter disconnected from session {session_id} - session closed")
        
        logger.info(f"Device ({device_type}) disconnected from session {session_id}")


if __name__ == "__main__":
    # Run Flask app with SocketIO (WebSocket support)
    # debug=True: Auto-reload on code changes, verbose error messages
    # host='0.0.0.0': Listen on all network interfaces (allows mobile connections)
    # port=8081: Backend API runs on port 8081
    socketio.run(app, debug=True, host="0.0.0.0", port=8081)
