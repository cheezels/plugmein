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
    """Collect transcripts and generate comprehensive feedback using Google Gemini"""
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

        # Get presentation quality score
        score_prompt = """You are evaluating how well a hackathon team pitched their product to judges.
        Based on the transcript, give a single score from 0-100 measuring pitch effectiveness.
        
        Consider:
        - Clarity: Did they explain the product clearly?
        - Structure: Was it organized or all over the place?
        - Engagement: Did judges seem interested (asking questions, reacting)?
        - Confidence: Did presenters sound prepared or fumbling?
        - Impact: Would judges remember this pitch?

        IMPORTANT: Respond with ONLY a number between 0 and 100. No other text."""

        score_response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"Score how effectively this team pitched their product (0-100):\n\n{transcript}",
            config=types.GenerateContentConfig(
                system_instruction=score_prompt,
                temperature=0.3,
                max_output_tokens=10
            )
        )

        # Parse the presentation score
        presentation_score = 50
        try:
            presentation_score = int(score_response.text.strip())
            presentation_score = max(0, min(100, presentation_score))
        except ValueError:
            logger.warning(f"Failed to parse score: {score_response.text}")

        logger.info(f"Presentation score: {presentation_score}")

        # Clear storage
        del transcript_storage[session_id]
        logger.info(f"Cleared transcripts for session {session_id}")

        return jsonify({
            "feedback": feedback,
            "transcript": transcript,
            "presentationScore": presentation_score,
            "questionCount": question_count,
            "questionQuality": question_quality,
            "questionInsights": question_insights,
            "success": True
        }), 200

    except Exception as e:
        logger.error(f"Error in gemini_feedback: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8081)
