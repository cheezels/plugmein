export type Screenshot = {
  id: string;
  image: string;
  emotion: string;
  timestamp: number;
};

export class CameraService {
  private stream: MediaStream | null = null;
  private screenshots: Screenshot[] = [];
  private captureInterval: NodeJS.Timeout | null = null;

  async startCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      videoElement.srcObject = this.stream;
      this.screenshots = [];

      return this.stream;
    } catch (err) {
      console.error("Error accessing camera/microphone:", err);
      throw err;
    }
  }

  stopCamera(videoElement: HTMLVideoElement): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.stream?.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
    this.stream = null;
  }

  startScreenshotCapture(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    intervalMs: number = 3000
  ): void {
    this.captureInterval = setInterval(() => {
      this.captureScreenshot(videoElement, canvasElement);
    }, intervalMs);
  }

  stopScreenshotCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
  }

  captureScreenshot(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement
  ): void {
    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    //TODO: Replace with actual emotion detection logic
    const image = canvasElement.toDataURL("image/jpeg", 0.8);

    const emotions = ["Confused", "Skeptical", "Impressed", "Bored", "Surprised", "Amused"];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

    const screenshot: Screenshot = {
      id: Date.now().toString(),
      image,
      emotion: randomEmotion,
      timestamp: Date.now(),
    };

    this.screenshots.push(screenshot);
  }

  getScreenshots(): Screenshot[] {
    return [...this.screenshots];
  }

  clearScreenshots(): void {
    this.screenshots = [];
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  isActive(): boolean {
    return this.stream !== null && this.stream.active;
  }
}
