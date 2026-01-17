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
