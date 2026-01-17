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

        # Transcribe with Whisper (with word-level timestamps)
        result = whisper_model.transcribe(
            wav_path, 
            language="en",
            word_timestamps=True,
            verbose=False
        )
        text = result["text"].strip()

        logger.info(f"Chunk {chunk_index} transcribed: {len(text)} characters")

        # Store the transcript with timestamps for this session
        if session_id not in transcript_storage:
            transcript_storage[session_id] = []
        
        # Store chunk data with segments (which contain word-level timestamps)
        chunk_data = {
            "chunk_index": chunk_index,
            "text": text,
            "segments": result.get("segments", []),
            "start_time": chunk_index * 30  # Each chunk is 30 seconds
        }
        transcript_storage[session_id].append(chunk_data)

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
    """Collect transcripts and generate comprehensive feedback using Google Gemini"""
    try:
        data = request.get_json() or {}
        session_id = data.get('sessionId', 'default')
        
        # Receive face metrics from frontend for presentation score calculation
        face_metrics = data.get('faceMetrics', {
            'avgCuriosity': 0,
            'avgAttention': 0,
            'avgVibe': 0,
            'trend': 'stable'
        })

        if session_id not in transcript_storage or not transcript_storage[session_id]:
            return jsonify({"error": "No transcripts found for this session"}), 400

        # Combine transcripts
        chunks = transcript_storage[session_id]
        chunks.sort(key=lambda x: x["chunk_index"])
        
        # Combine text from all chunks
        transcript = " ".join([chunk["text"] for chunk in chunks])
        
        # Build timestamped segments list
        all_segments = []
        for chunk in chunks:
            chunk_start = chunk["start_time"]
            for segment in chunk.get("segments", []):
                segment_copy = segment.copy()
                # Adjust timestamps relative to entire session
                if "start" in segment_copy:
                    segment_copy["start"] = chunk_start + segment_copy["start"]
                if "end" in segment_copy:
                    segment_copy["end"] = chunk_start + segment_copy["end"]
                all_segments.append(segment_copy)

        logger.info(f"Generating Gemini feedback for session {session_id} ({len(transcript)} chars)")

        # Configuration for Gemini
        system_prompt = """
        ### ROLE
        You are a brutally honest pitch coach analyzing how judges reacted to a hackathon presentation.
        Your job is to help the product makers understand what worked, what bombed, and how to improve.

        ### TONE & PERSONALITY
        - Direct, witty, and constructive—no sugarcoating, but always helpful
        - Roast the presenters' mistakes (not the judges) but pivot to actionable advice
        - Focus on judge engagement patterns: Did they ask questions? Did they sound interested?
        - Never mention you are an AI. Keep it real and specific.

        ### EVALUATION CRITERIA
        Analyze the transcript to understand:
        1. **Judge Engagement**: Were judges asking questions? Nodding along? Or silent and confused?
        2. **Pitch Clarity**: Did the presenters explain the "How" clearly, or just buzzword salad?
        3. **Hook Factor**: Did judges seem excited (interrupting with questions) or bored (crickets)?
        4. **Red Flags**: Identify hesitations, unclear answers, or missed opportunities to engage judges

        ### OUTPUT FORMAT
        - **The Reality Check** (2 sentences): A direct assessment of how the judges received the pitch
        - **What Worked / What Flopped** (4 bullet points): Specific examples from the transcript
        - **Your Game Plan** (3 actionable steps): How to pitch better and engage judges more effectively next time
        
        Remember: The goal is to help presenters understand judge reactions and improve their pitch game.
        """

        # Call Gemini API for feedback
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Analyze this hackathon pitch transcript. Focus on how the judges reacted and what the presenters could improve:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
                max_output_tokens=1000
            )
        )

        feedback = response.text
        logger.info("Gemini feedback generated successfully")

        # Analyze questions from transcript
        question_prompt = """You are analyzing a hackathon pitch to understand how engaged the judges were based on their questions.

        Your task:
        1. Identify questions asked BY THE JUDGE (not by the presenter)
        2. Count the total number of distinct questions
        3. Evaluate how engaged/interested the judges seemed (0-100 scale)
        
        Judge Engagement Scoring Guidelines:
        - 90-100: Judges asked deep, probing questions about implementation, scalability, challenges (shows HIGH interest)
        - 70-89: Judges asked clarifying questions about features, use cases, methodology (shows solid interest)
        - 50-69: Judges asked basic questions (what/why/how) but nothing deep (moderate curiosity)
        - 30-49: Judges asked few surface-level or yes/no questions (low engagement)
        - 0-29: No meaningful questions or only procedural ones (judges weren't hooked)
        
        Context: More/deeper questions = pitch successfully engaged judges. Fewer questions = presenters need to improve hook.

        IMPORTANT: Respond ONLY in this exact format:
        QUESTION_COUNT: [number]
        QUALITY_SCORE: [number 0-100]
        INSIGHTS: [1-2 sentence analysis telling presenters what judge questions reveal about their pitch effectiveness]"""

        question_response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Analyze how engaged the judges were based on their questions in this hackathon pitch:\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=question_prompt,
                temperature=0.3,
                max_output_tokens=200
            )
        )

        # Parse question analysis
        question_count = 0
        question_quality = 50
        question_insights = "Analyzing questions..."
        
        try:
            lines = question_response.text.strip().split('\n')
            for line in lines:
                if line.startswith('QUESTION_COUNT:'):
                    question_count = int(line.split(':')[1].strip())
                elif line.startswith('QUALITY_SCORE:'):
                    question_quality = int(line.split(':')[1].strip())
                    question_quality = max(0, min(100, question_quality))
                elif line.startswith('INSIGHTS:'):
                    question_insights = line.split(':', 1)[1].strip()
        except Exception as parse_error:
            logger.warning(f"Failed to parse question analysis: {parse_error}")

        logger.info(f"Question Analysis: {question_count} questions, quality score: {question_quality}")

        # Calculate presentation score from ACTUAL METRICS (not AI opinion)
        # This score reflects objective data collected during the pitch
        
        # 1. Face Metrics Component (40%) - Average judge engagement
        avg_face_metrics = (
            face_metrics.get('avgCuriosity', 0) + 
            face_metrics.get('avgAttention', 0) + 
            face_metrics.get('avgVibe', 0)
        ) / 3
        face_component = avg_face_metrics * 0.40
        
        # 2. Question Quality Component (30%) - Judge engagement depth
        question_component = question_quality * 0.30
        
        # 3. Transcript Quality Component (20%) - Length and completeness
        # Longer transcript = more content shared (assuming 30-sec chunks)
        transcript_length_score = min(100, (len(transcript) / 20))  # 2000+ chars = 100
        words_count = len(transcript.split())
        word_density_score = min(100, (words_count / 2) if words_count > 0 else 0)  # 200+ words = 100
        transcript_component = ((transcript_length_score + word_density_score) / 2) * 0.20
        
        # 4. Engagement Trend Component (10%) - Did it improve over time?
        trend = face_metrics.get('trend', 'stable')
        trend_score = 80 if trend == 'improving' else 50 if trend == 'stable' else 30
        trend_component = trend_score * 0.10
        
        # Calculate final presentation score
        presentation_score = int(face_component + question_component + transcript_component + trend_component)
        
        # Apply artificial boost to make scores more positive
        presentation_score += 10
        
        presentation_score = max(0, min(100, presentation_score))
        
        logger.info(f"Calculated Presentation Score: {presentation_score}")
        logger.info(f"  - Face Metrics ({avg_face_metrics:.1f}): {face_component:.1f}")
        logger.info(f"  - Question Quality ({question_quality}): {question_component:.1f}")
        logger.info(f"  - Transcript Quality: {transcript_component:.1f}")
        logger.info(f"  - Trend ({trend}): {trend_component:.1f}")

        # Add AI speaker identification
        speaker_prompt = """You are analyzing a hackathon pitch transcript to identify who is speaking.

        Tag each line or segment with [PRESENTER] or [JUDGE].

        **Presenter indicators:**
        - Explaining features, answering questions
        - Using words like "we built", "our app", "I developed"
        - Describing technical implementation
        - Responding to questions with explanations

        **Judge indicators:**
        - Asking questions
        - Requesting clarification
        - Using phrases like "How does", "Can you explain", "What about", "Why did you"
        - Making brief comments or acknowledgments

        Format each line as:
        [SPEAKER] text

        Example:
        [PRESENTER] We built an app that helps teams collaborate in real-time.
        [JUDGE] How does it handle authentication?
        [PRESENTER] We're using OAuth 2.0 with JWT tokens for secure authentication.

        IMPORTANT: Output ONLY the tagged transcript, no other commentary."""

        try:
            speaker_response = gemini_client.models.generate_content(
                model="gemini-2.0-flash",
                contents=f"Tag this hackathon pitch transcript with speaker labels:\n\n{transcript}",
                config=types.GenerateContentConfig(
                    system_instruction=speaker_prompt,
                    temperature=0.3,
                    max_output_tokens=2000
                )
            )
            
            tagged_transcript = speaker_response.text.strip()
            logger.info("Speaker identification complete")
        except Exception as e:
            logger.warning(f"Speaker identification failed: {e}")
            tagged_transcript = transcript  # Fallback to untagged transcript

        # Clear storage
        del transcript_storage[session_id]
        logger.info(f"Cleared transcripts for session {session_id}")

        return jsonify({
            "feedback": feedback,
            "transcript": transcript,
            "taggedTranscript": tagged_transcript,
            "segments": all_segments,
            "presentationScore": presentation_score,
            "questionCount": question_count,
            "questionQuality": question_quality,
            "questionInsights": question_insights,
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
