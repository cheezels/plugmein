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
          detector: { 
            modelPath: 'blazeface.json',
            return: true, // Return face detection box
          },
          mesh: { enabled: true },
          iris: { enabled: true },
          emotion: { enabled: true },
          description: { enabled: true },
          antispoof: { enabled: false },
          gaze: { enabled: true }, // Enable gaze detection for attention tracking
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
        gesture: {
          enabled: true, // Enable gesture detection
        },
        object: {
          enabled: false,
        },
        segmentation: {
          enabled: false,
        },
        filter: {
          enabled: true, // Smooth out jittery tracking
          equalization: true,
        },
        cacheSensitivity: 0.9, // Skip frames if no significant movement
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
    
    // DEBUG: Log raw Human library result structure
    console.log('🔬 RAW Human Library Result:', {
      faceCount: result.face?.length || 0,
      face: face ? {
        score: face.score,
        rotation: face.rotation,
        emotion: face.emotion,
        gaze: face.gaze,
        iris: face.iris,
        irisLength: face.iris?.length,
        mesh: face.mesh ? { length: face.mesh.length } : null,
        age: face.age,
        gender: face.gender,
      } : null,
      handCount: result.hand?.length || 0,
      bodyCount: result.body?.length || 0,
      gestures: result.gesture,
    });
    
    // Log specific rotation and emotion values to debug stuck metrics
    if (face) {
      console.log('📐 Face Details:', {
        rotation: {
          angle: face.rotation?.angle,
          gaze: face.rotation?.gaze, 
          matrix: face.rotation?.matrix ? 'exists' : null,
          pitch: face.rotation?.angle?.pitch,
          yaw: face.rotation?.angle?.yaw,
          roll: face.rotation?.angle?.roll,
        },
        emotion: Array.isArray(face.emotion) ? face.emotion : face.emotion,
        iris: {
          exists: !!face.iris,
          isArray: Array.isArray(face.iris),
          length: face.iris?.length,
          data: face.iris,
        },
        gaze: face.gaze,
      });
    }

    // Parse emotion - handle both array and object formats
    let emotionData: any = undefined;
    if (face?.emotion) {
      if (Array.isArray(face.emotion)) {
        // Convert array format to object format
        emotionData = {};
        face.emotion.forEach((e: any) => {
          emotionData[e.emotion] = e.score;
        });
      } else {
        emotionData = face.emotion;
      }
    }

    // Extract gaze from rotation.gaze (Human library stores it there)
    // IMPORTANT: Gaze strength represents SUSTAINED FOCUS/EYE CONTACT
    // Human library gaze strength is typically 0-1 range but can vary
    let gazeData = face?.rotation?.gaze || face?.gaze;
    
    if (gazeData) {
      // Normalize gaze strength if it's very small (Human library sometimes returns 0-0.1 range)
      // We want 0-1 range for our calculations
      const normalizedStrength = Math.min(1, Math.max(0, gazeData.strength * 10)); // Scale up if too small
      gazeData = {
        bearing: gazeData.bearing || 0,
        strength: normalizedStrength,
      };
    } else if (face?.iris && Array.isArray(face.iris) && face.iris.length >= 2) {
      // Fallback: Use iris positions if available
      const leftIris = face.iris[0];
      const rightIris = face.iris[1];
      const irisCenter = {
        x: (leftIris.x + rightIris.x) / 2,
        y: (leftIris.y + rightIris.y) / 2,
      };
      const bearing = Math.atan2(irisCenter.y - 0.5, irisCenter.x - 0.5) * (180 / Math.PI);
      gazeData = { strength: 0.8, bearing };
    } else if (face) {
      // Face detected but no gaze/iris data - assume moderate attention
      gazeData = { strength: 0.5, bearing: 0 };
    }

    return {
      face: {
        detected: !!face,
        confidence: face?.score,
        rotation: face?.rotation
          ? {
              pitch: face.rotation.angle?.pitch || face.rotation.pitch || 0,
              yaw: face.rotation.angle?.yaw || face.rotation.yaw || 0,
              roll: face.rotation.angle?.roll || face.rotation.roll || 0,
            }
          : undefined,
        emotion: emotionData
          ? {
              happy: emotionData.happy || 0,
              sad: emotionData.sad || 0,
              angry: emotionData.angry || 0,
              fearful: emotionData.fearful || 0,
              disgusted: emotionData.disgusted || 0,
              surprised: emotionData.surprised || 0,
              neutral: emotionData.neutral || 0,
            }
          : undefined,
        age: face?.age,
        gender: face?.gender,
        gaze: gazeData
          ? {
              bearing: gazeData.bearing || 0,
              strength: gazeData.strength || 0,
            }
          : undefined,
        iris: face?.iris && Array.isArray(face.iris) && face.iris.length >= 2
          ? {
              left: { x: face.iris[0].x || 0, y: face.iris[0].y || 0 },
              right: { x: face.iris[1].x || 0, y: face.iris[1].y || 0 },
            }
          : undefined,
      },
      hand: {
        detected: !!hand,
        confidence: hand?.score,
        landmarks: Array.isArray(hand?.keypoints) 
          ? hand.keypoints.map((kp) => ({
              x: kp.position?.[0] || kp.x || 0,
              y: kp.position?.[1] || kp.y || 0,
              z: kp.position?.[2] || kp.z,
            }))
          : undefined,
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

  // Expose raw Human instance for drawing utilities
  getHumanInstance(): Human | null {
    return this.human;
  }

  // Expose raw result for drawing utilities
  getLastRawResult(): Result | null {
    return this.lastResult;
  }
}

// Singleton instance
export const humanService = new HumanDetectionService();
