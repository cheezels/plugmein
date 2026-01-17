import { Human, Config, Result } from '@vladmandic/human';

export interface HumanDetectionResult {
  face: {
    detected: boolean;
    confidence?: number;
    rotation?: {
      pitch: number;
      yaw: number;
      roll: number;
    };
    emotion?: {
      happy: number;
      sad: number;
      angry: number;
      fearful: number;
      disgusted: number;
      surprised: number;
      neutral: number;
    };
    age?: number;
    gender?: string;
    gaze?: {
      bearing: number;
      strength: number;
    };
    iris?: {
      left: { x: number; y: number };
      right: { x: number; y: number };
    };
  };
  hand: {
    detected: boolean;
    confidence?: number;
    landmarks?: Array<{ x: number; y: number; z?: number }>;
    gestures?: string[];
  };
  body: {
    detected: boolean;
    keypoints?: Array<{ name: string; x: number; y: number; confidence: number }>;
  };
}

export class HumanDetectionService {
  private human: Human | null = null;
  private isInitialized = false;
  private lastResult: Result | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized && this.human) {
      return;
    }

    try {
      const config: Partial<Config> = {
        backend: 'webgl',
        modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
        face: {
          enabled: true,
          detector: { modelPath: 'blazeface.json' },
          mesh: { enabled: true },
          iris: { enabled: true },
          emotion: { enabled: true },
          description: { enabled: true },
          antispoof: { enabled: false },
        },
        hand: {
          enabled: true,
          detector: { modelPath: 'handtrack.json' },
          skeleton: { enabled: true },
          landmarks: { enabled: true },
        },
        body: {
          enabled: true,
          modelPath: 'movenet-lightning.json',
        },
        object: {
          enabled: false,
        },
        segmentation: {
          enabled: false,
        },
      };

      this.human = new Human(config);
      await this.human.warmup();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Human:', error);
      throw error;
    }
  }

  async detect(input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<HumanDetectionResult> {
    if (!this.human || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.human) {
      throw new Error('Human not initialized');
    }

    try {
      const result = await this.human.detect(input);
      this.lastResult = result;

      return this.parseResult(result);
    } catch (error) {
      console.error('Detection error:', error);
      return this.getEmptyResult();
    }
  }

  getInterpolatedResult(): HumanDetectionResult {
    if (!this.human || !this.lastResult) {
      return this.getEmptyResult();
    }

    try {
      const interpolated = this.human.next(this.lastResult);
      return this.parseResult(interpolated);
    } catch (error) {
      console.error('Interpolation error:', error);
      return this.getEmptyResult();
    }
  }

  private parseResult(result: Result): HumanDetectionResult {
    const face = result.face && result.face.length > 0 ? result.face[0] : null;
    const hand = result.hand && result.hand.length > 0 ? result.hand[0] : null;
    const body = result.body && result.body.length > 0 ? result.body[0] : null;

    return {
      face: {
        detected: !!face,
        confidence: face?.score,
        rotation: face?.rotation
          ? {
              pitch: face.rotation.pitch || 0,
              yaw: face.rotation.yaw || 0,
              roll: face.rotation.roll || 0,
            }
          : undefined,
        emotion: face?.emotion
          ? {
              happy: face.emotion.happy || 0,
              sad: face.emotion.sad || 0,
              angry: face.emotion.angry || 0,
              fearful: face.emotion.fearful || 0,
              disgusted: face.emotion.disgusted || 0,
              surprised: face.emotion.surprised || 0,
              neutral: face.emotion.neutral || 0,
            }
          : undefined,
        age: face?.age,
        gender: face?.gender,
        gaze: face?.gaze
          ? {
              bearing: face.gaze.bearing || 0,
              strength: face.gaze.strength || 0,
            }
          : undefined,
        iris: face?.iris && face.iris.length >= 2
          ? {
              left: { x: face.iris[0].x || 0, y: face.iris[0].y || 0 },
              right: { x: face.iris[1].x || 0, y: face.iris[1].y || 0 },
            }
          : undefined,
      },
      hand: {
        detected: !!hand,
        confidence: hand?.score,
        landmarks: hand?.landmarks?.map((lm) => ({
          x: lm[0] || 0,
          y: lm[1] || 0,
          z: lm[2],
        })),
        gestures: hand?.gestures,
      },
      body: {
        detected: !!body,
        keypoints: body?.keypoints?.map((kp) => ({
          name: kp.name || '',
          x: kp.position?.[0] || 0,
          y: kp.position?.[1] || 0,
          confidence: kp.score || 0,
        })),
      },
    };
  }

  private getEmptyResult(): HumanDetectionResult {
    return {
      face: { detected: false },
      hand: { detected: false },
      body: { detected: false },
    };
  }

  async warmup(): Promise<void> {
    if (!this.human) {
      await this.initialize();
    }
    if (this.human) {
      await this.human.warmup();
    }
  }

  dispose(): void {
    if (this.human) {
      // Human library doesn't have explicit dispose, but we can clear references
      this.human = null;
      this.isInitialized = false;
      this.lastResult = null;
    }
  }
}

// Singleton instance
export const humanService = new HumanDetectionService();
