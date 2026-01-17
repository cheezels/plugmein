from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import whisper
from pydub import AudioSegment
from openai import OpenAI
from dotenv import load_dotenv
import logging
from google import genai
from google.genai import types

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

# Initialize Gemini client
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

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


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8081)
