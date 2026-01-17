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


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8081)
