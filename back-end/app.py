from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import whisper
from pydub import AudioSegment
from openai import OpenAI
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

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

# Initialize OpenAI client
#client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# In-memory storage for accumulated transcripts per session
# Key: session_id, Value: list of (chunk_index, text) tuples
transcript_storage = {}

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

@app.route("/get-transcripts", methods=["POST"])
def get_transcripts():
    """Retrieve all stored transcripts for the session and clear them"""
    try:
        data = request.get_json() or {}
        session_id = data.get('sessionId', 'default')

        # Check if transcripts exist for this session
        if session_id not in transcript_storage or not transcript_storage[session_id]:
            return jsonify({"error": "No transcripts found for this session"}), 400

        # Sort chunks by index and combine into full transcript
        chunks = transcript_storage[session_id]
        chunks.sort(key=lambda x: x[0])  # Sort by chunk_index
        transcript = " ".join([text for _, text in chunks])
        chunk_count = len(chunks)

        logger.info(f"Collected {chunk_count} chunks for session {session_id}")

        # Clear the transcripts for this session
        del transcript_storage[session_id]
        logger.info(f"Cleared transcripts for session {session_id}")

        return jsonify({
            "transcript": transcript,
            "chunkCount": chunk_count,
            "success": True
        }), 200

    except Exception as e:
        logger.error(f"Error in get_transcripts: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# @app.route("/gpt-feedback", methods=["POST"])
# def gpt_feedback():
#     """Collect all stored transcripts for the session and generate GPT feedback"""
#     try:
#         data = request.get_json() or {}
#         session_id = data.get('sessionId', 'default')

#         # Collect all stored transcripts for this session
#         if session_id not in transcript_storage or not transcript_storage[session_id]:
#             return jsonify({"error": "No transcripts found for this session"}), 400

#         # Sort chunks by index and combine into full transcript
#         chunks = transcript_storage[session_id]
#         chunks.sort(key=lambda x: x[0])  # Sort by chunk_index
#         transcript = " ".join([text for _, text in chunks])

#         logger.info(f"Collected {len(chunks)} chunks for session {session_id}")
#         logger.info(f"Generating feedback for transcript ({len(transcript)} characters)")
        
#         # Create prompt for GPT
#         system_prompt = """You are an judge giving feedback on a hackathon project presentation speech.
#         Analyze the provided speech transcript and give constructive feedback on:
#         1. Content and structure
#         2. Clarity and coherence
#         3. Engagement and impact
#         4. Areas for improvement
        
#         Provide specific, actionable feedback in a supportive and funny tone."""
        
#         user_prompt = f"Please analyze this speech transcript and provide feedback:\n\n{transcript}"
        
#         # Call OpenAI API
#         response = client.chat.completions.create(
#             model="gpt-4",
#             messages=[
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": user_prompt}
#             ],
#             temperature=0.7,
#             max_tokens=1000
#         )
        
#         feedback = response.choices[0].message.content

#         logger.info("Feedback generated successfully")

#         # Clear the stored transcripts for this session after generating feedback
#         del transcript_storage[session_id]
#         logger.info(f"Cleared transcripts for session {session_id}")

#         return jsonify({
#             "feedback": feedback,
#             "transcript": transcript,
#             "success": True
#         }), 200

#     except Exception as e:
#         logger.error(f"Error in gpt_feedback: {str(e)}")
#         return jsonify({"error": str(e)}), 500

@app.route("/transcribe-full", methods=["POST"])
def transcribe_full():
    """Transcribe a complete audio file (fallback for non-chunked uploads)"""
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "Empty filename"}), 400
        
        # Save the audio file
        file_path = os.path.join(UPLOAD_FOLDER, audio_file.filename)
        audio_file.save(file_path)
        
        logger.info(f"Processing full audio file: {audio_file.filename}")
        
        # Convert to WAV
        wav_path = file_path + ".wav"
        if not convert_to_wav(file_path, wav_path):
            return jsonify({"error": "Failed to convert audio"}), 500
        
        # Transcribe with Whisper
        result = whisper_model.transcribe(wav_path)
        text = result["text"].strip()
        
        logger.info(f"Full transcription complete: {len(text)} characters")
        
        # Clean up files
        try:
            os.remove(file_path)
            os.remove(wav_path)
        except:
            pass
        
        return jsonify({
            "text": text,
            "success": True
        }), 200
        
    except Exception as e:
        logger.error(f"Error in transcribe_full: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8081)
