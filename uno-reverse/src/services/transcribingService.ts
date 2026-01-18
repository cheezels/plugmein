const BACKEND_URL = 'http://localhost:8081';
const CHUNK_INTERVAL_MS = 30000; // 30 seconds

class TranscribingService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunkIndex: number = 0;
  private sessionId: string = '';
  private isRecording: boolean = false;
  private onTranscriptCallback: ((text: string, chunkIndex: number) => void) | null = null;
  private chunkTimer: ReturnType<typeof setInterval> | null = null;
  private pendingChunks: number = 0; // Track chunks being processed

  async startRecording(onTranscript?: (text: string, chunkIndex: number) => void): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Generate unique session ID
      this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      this.chunkIndex = 0;
      this.onTranscriptCallback = onTranscript || null;
      this.isRecording = true;
      this.pendingChunks = 0;

      // Start the first recorder
      this.startNewRecorder();

      // Restart recorder every 30 seconds to ensure each chunk has a valid header
      this.chunkTimer = setInterval(() => {
        if (this.isRecording) {
          this.restartRecorder();
        }
      }, CHUNK_INTERVAL_MS);

      console.log(`Recording started with session ID: ${this.sessionId}`);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private startNewRecorder(): void {
    if (!this.stream) return;

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.getSupportedMimeType(),
    });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const currentChunkIndex = this.chunkIndex++;
        await this.sendChunkToBackend(event.data, currentChunkIndex);
      }
    };

    this.mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
    };

    this.mediaRecorder.start();
  }

  private restartRecorder(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Stop current recorder - this triggers ondataavailable with the recorded data
      this.mediaRecorder.stop();
    }
    // Start a new recorder immediately
    this.startNewRecorder();
  }

  async stopRecording(faceMetrics?: any): Promise<{ 
    transcript: string; 
    feedback: string; 
    presentationScore: number;
    questionCount: number;
    questionQuality: number;
    questionInsights: string;
    comedyVerdict?: string;
    comedyPainRating?: number;
    comedyAnalysis?: string;
    taggedTranscript?: string;
    segments?: any[];
  } | null> {
    if (!this.isRecording) {
      console.warn('Not currently recording');
      return null;
    }

    // Clear the chunk timer
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }

    // Wait for the final chunk to be sent
    await new Promise<void>((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.onstop = () => {
          resolve();
        };
        this.mediaRecorder.stop();
      } else {
        resolve();
      }
    });

    // Wait for all pending chunks to be processed by the backend
    console.log(`Waiting for ${this.pendingChunks} pending chunks to complete...`);
    while (this.pendingChunks > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log('All chunks processed');

    // Collate all transcripts and get feedback from the backend
    const result = await this.collateTranscripts(faceMetrics);

    this.cleanup();

    return result;
  }

  private async collateTranscripts(faceMetrics?: any): Promise<{ 
    transcript: string; 
    feedback: string; 
    presentationScore: number;
    questionCount: number;
    questionQuality: number;
    questionInsights: string;
    comedyVerdict?: string;
    comedyPainRating?: number;
    comedyAnalysis?: string;
    taggedTranscript?: string;
    segments?: any[];
  } | null> {
    if (!this.sessionId) {
      console.warn('No session ID available');
      return null;
    }

    try {
      console.log(`Fetching transcripts and feedback for session: ${this.sessionId}`);
      console.log(`Sending face metrics for presentation score calculation:`, faceMetrics);

      const response = await fetch(`${BACKEND_URL}/gemini-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: this.sessionId,
          faceMetrics: faceMetrics || {}
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to get feedback:', error);
        return null;
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Got transcript (${data.transcript.length} chars), feedback, presentation score: ${data.presentationScore}, questions: ${data.questionCount}`);
        return { 
          transcript: data.transcript, 
          feedback: data.feedback, 
          presentationScore: data.presentationScore,
          questionCount: data.questionCount,
          questionQuality: data.questionQuality,
          questionInsights: data.questionInsights,
          comedyVerdict: data.comedyVerdict,
          comedyPainRating: data.comedyPainRating,
          comedyAnalysis: data.comedyAnalysis,
          taggedTranscript: data.taggedTranscript,
          segments: data.segments
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return null;
    }
  }

  private async sendChunkToBackend(audioBlob: Blob, chunkIndex: number): Promise<void> {
    this.pendingChunks++;
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `chunk-${chunkIndex}.webm`);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('sessionId', this.sessionId);

      console.log(`Sending chunk ${chunkIndex} to backend... (pending: ${this.pendingChunks})`);

      const response = await fetch(`${BACKEND_URL}/transcribe-chunk`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.text) {
        console.log(`Chunk ${chunkIndex} transcribed: "${data.text.substring(0, 50)}..."`);

        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(data.text, chunkIndex);
        }
      }
    } catch (error) {
      console.error(`Failed to send chunk ${chunkIndex}:`, error);
    } finally {
      this.pendingChunks--;
      console.log(`Chunk ${chunkIndex} done. (pending: ${this.pendingChunks})`);
    }
  }

  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return 'audio/webm';
  }

  private cleanup(): void {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.isRecording = false;
    this.pendingChunks = 0;
    console.log('Recording stopped and cleaned up');
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

export const transcribingService = new TranscribingService();
export default transcribingService;
