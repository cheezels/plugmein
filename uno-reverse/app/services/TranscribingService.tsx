import { CameraService, Screenshot } from "./CameraService";

export type JudgeResult = {
  transcript: string;
  emotion: string;
  score: number;
  screenshots: Screenshot[];
};

export class TranscribingService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private cameraService: CameraService;

  constructor(cameraService: CameraService) {
    this.cameraService = cameraService;
  }

  async startRecording(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ): Promise<void> {
    try {
      // Use CameraService to start the camera
      const stream = await this.cameraService.startCamera(videoElement);

      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      // Start capturing screenshots every 3 seconds
      this.cameraService.startScreenshotCapture(videoElement, canvasElement, 3000);

      this.mediaRecorder.start();
    } catch (err) {
      console.error("Error starting recording:", err);
      throw err;
    }
  }

  stopRecording(videoElement: HTMLVideoElement): Promise<JudgeResult> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error("No active recording");
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        console.log("Recording stopped, blob size:", blob.size);

        //TODO: Replace with actual analysis logic
        const result: JudgeResult = {
          transcript: `Judge: "So tell me about your project..."

You: "We built an app that uses AI to analyze hackathon judges."

Judge: "That's... interesting. How does it work exactly?"

You: "It records video and audio, then uses computer vision and speech-to-text to analyze your reactions and feedback."

Judge: "Wait, are you recording me right now?"

You: "...maybe."

Judge: "I'm not sure how I feel about this."`,
          emotion: "Skeptical",
          score: 6,
          screenshots: this.cameraService.getScreenshots(),
        };

        resolve(result);
      };

      // Stop camera and screenshot capture
      this.cameraService.stopCamera(videoElement);

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === "recording";
  }
}
