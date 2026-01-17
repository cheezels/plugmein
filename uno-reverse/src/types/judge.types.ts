export interface JudgeMetrics {
  curiosityIndex: number;
  attentionStability: number;
  questionQuality: number;
  vibeAlignment: number;
}

export interface MetricExplanation {
  metric: keyof JudgeMetrics;
  label: string;
  score: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
  insights: string[];
}

export interface JudgeSession {
  id: string;
  startTime: Date;
  isRecording: boolean;
  metrics: JudgeMetrics;
  explanations: MetricExplanation[];
  overallScore: number;
}

export interface CameraState {
  isActive: boolean;
  stream: MediaStream | null;
  error: string | null;
}

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
