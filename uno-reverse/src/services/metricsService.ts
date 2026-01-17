import { JudgeMetrics, MetricExplanation, HumanDetectionResult } from '@/types/judge.types';

// Track historical data for trend analysis
interface DetectionHistory {
  detections: HumanDetectionResult[];
  gazeHistory: number[];
  headRotationHistory: Array<{ pitch: number; yaw: number; roll: number }>;
  emotionHistory: Array<{ happy: number; neutral: number }>;
  handMovementHistory: boolean[];
  maxHistorySize: number;
}

const detectionHistory: DetectionHistory = {
  detections: [],
  gazeHistory: [],
  headRotationHistory: [],
  emotionHistory: [],
  handMovementHistory: [],
  maxHistorySize: 30, // Keep last 30 detections (~1 second at 30fps)
};

export const metricsService = {
  calculateOverallScore(metrics: JudgeMetrics): number {
    // Temporarily exclude questionQuality from overall score (work in progress)
    const weights = {
      curiosityIndex: 0.4,      // Increased from 0.3
      attentionStability: 0.35,   // Increased from 0.25
      questionQuality: 0,         // Excluded (work in progress)
      vibeAlignment: 0.25,       // Increased from 0.2
    };
    
    return Math.round(
      metrics.curiosityIndex * weights.curiosityIndex +
      metrics.attentionStability * weights.attentionStability +
      metrics.vibeAlignment * weights.vibeAlignment
    );
  },

  generateExplanations(metrics: JudgeMetrics, detection?: HumanDetectionResult): MetricExplanation[] {
    const insights: MetricExplanation[] = [];

    // Curiosity Index - Head movements only
    const curiosityInsights: string[] = [];
    if (detection?.face?.rotation) {
      const { pitch, yaw, roll } = detection.face.rotation;
      if (pitch > 0.1) curiosityInsights.push('Forward lean detected');
      if (Math.abs(yaw) < 0.2) curiosityInsights.push('Facing forward');
      if (Math.abs(roll) > 0.1) curiosityInsights.push('Head tilt indicates interest');
    }
    if (!curiosityInsights.length) {
      curiosityInsights.push('Standard head position');
    }

    insights.push({
      metric: 'curiosityIndex',
      label: 'Curiosity Index',
      score: metrics.curiosityIndex,
      description: 'Measures engagement through head movements: forward leans, tilts, and rotation patterns.',
      trend: metrics.curiosityIndex > 70 ? 'up' : metrics.curiosityIndex > 40 ? 'stable' : 'down',
      insights: curiosityInsights,
    });

    // Attention Stability - Gaze strength focused
    const attentionInsights: string[] = [];
    if (detection?.face?.detected) {
      if (detection.face.gaze) {
        const gazeStrength = detection.face.gaze.strength;
        if (gazeStrength > 0.7) {
          attentionInsights.push('Very strong eye contact');
        } else if (gazeStrength > 0.5) {
          attentionInsights.push('Strong eye contact maintained');
        } else if (gazeStrength > 0.3) {
          attentionInsights.push('Moderate focus observed');
        } else {
          attentionInsights.push('Weak gaze detected');
        }
      } else {
        attentionInsights.push('Gaze data unavailable');
      }
    } else {
      attentionInsights.push('Face not detected');
    }
    if (detectionHistory.gazeHistory.length > 10) {
      const gazeVariance = this.calculateVariance(detectionHistory.gazeHistory);
      const avgGaze = detectionHistory.gazeHistory.reduce((sum, val) => sum + val, 0) / detectionHistory.gazeHistory.length;
      if (gazeVariance < 0.05) {
        attentionInsights.push('Highly stable gaze pattern');
      } else if (gazeVariance < 0.1) {
        attentionInsights.push('Stable gaze pattern');
      } else {
        attentionInsights.push('Gaze movement detected');
      }
      attentionInsights.push(`Average gaze strength: ${Math.round(avgGaze * 100)}%`);
    }

    insights.push({
      metric: 'attentionStability',
      label: 'Attention Stability',
      score: metrics.attentionStability,
      description: 'Measures focus through gaze strength, eye contact consistency, and gaze stability over time.',
      trend: metrics.attentionStability > 70 ? 'up' : metrics.attentionStability > 40 ? 'stable' : 'down',
      insights: attentionInsights.length > 0 ? attentionInsights : ['Analyzing gaze patterns...'],
    });

    // Question Quality
    const questionInsights: string[] = [];
    if (detection?.hand?.detected) {
      if (detection.hand.gestures && detection.hand.gestures.length > 0) {
        questionInsights.push(`Gestures detected: ${detection.hand.gestures.join(', ')}`);
      } else {
        questionInsights.push('Hand movements observed');
      }
    }
    if (detection?.face?.rotation?.roll) {
      const roll = Math.abs(detection.face.rotation.roll);
      if (roll > 0.15) {
        questionInsights.push('Head tilt suggests contemplation');
      }
    }
    if (!questionInsights.length) {
      questionInsights.push('Analyzing thought patterns...');
    }

    insights.push({
      metric: 'questionQuality',
      label: 'Question Quality',
      score: metrics.questionQuality,
      description: 'Work in progress: Analyzes thoughtfulness via hand gestures and contemplative expressions.',
      trend: metrics.questionQuality > 70 ? 'up' : metrics.questionQuality > 40 ? 'stable' : 'down',
      insights: ['This metric is currently under development', ...questionInsights],
    });

    // Vibe Alignment
    const vibeInsights: string[] = [];
    if (detection?.face?.emotion) {
      const { happy, neutral, surprised } = detection.face.emotion;
      if (happy > 0.5) {
        vibeInsights.push('Positive emotions detected');
      } else if (happy > 0.3) {
        vibeInsights.push('Moderate positive engagement');
      }
      if (surprised > 0.4) {
        vibeInsights.push('Surprise/interest expressions');
      }
      if (neutral > 0.7 && happy < 0.2) {
        vibeInsights.push('Neutral emotional state');
      }
    }
    if (!vibeInsights.length) {
      vibeInsights.push('Analyzing emotional resonance...');
    }

    insights.push({
      metric: 'vibeAlignment',
      label: 'Vibe Alignment',
      score: metrics.vibeAlignment,
      description: 'Measures emotional resonance through micro-expressions and body language.',
      trend: metrics.vibeAlignment > 70 ? 'up' : metrics.vibeAlignment > 40 ? 'stable' : 'down',
      insights: vibeInsights,
    });

    return insights;
  },

  // Calculate metrics from Human detection results
  calculateMetricsFromDetection(detection: HumanDetectionResult): JudgeMetrics {
    // Update history
    detectionHistory.detections.push(detection);
    if (detectionHistory.detections.length > detectionHistory.maxHistorySize) {
      detectionHistory.detections.shift();
    }

    // Calculate Curiosity Index (0-100)
    // Based on: head movements only (forward lean, head tilt, rotation)
    // REMOVED: gaze strength (moved to Attention Stability)
    let curiosityIndex = 50; // Base score
    if (detection.face?.detected) {
      if (detection.face.confidence) {
        curiosityIndex += (detection.face.confidence - 0.5) * 30; // Confidence contributes less
      }
      if (detection.face.rotation) {
        const { pitch, yaw, roll } = detection.face.rotation;
        // Forward lean (positive pitch) increases curiosity - more weight
        if (pitch > 0) curiosityIndex += Math.min(pitch * 40, 25);
        // Head tilt (roll) indicates interest - more weight
        if (Math.abs(roll) > 0.1) curiosityIndex += Math.min(Math.abs(roll) * 30, 20);
        // Facing forward (low yaw) indicates engagement
        if (Math.abs(yaw) < 0.2) curiosityIndex += 10;
      }
    } else {
      curiosityIndex -= 30; // Penalty for no face detection
    }
    curiosityIndex = Math.max(0, Math.min(100, Math.round(curiosityIndex)));

    // Calculate Attention Stability (0-100)
    // Based on: gaze strength and gaze stability over time (primary focus)
    let attentionStability = 30; // Lower base since we focus on gaze
    if (detection.face?.detected) {
      attentionStability += 20; // Face detected bonus
      if (detection.face.confidence && detection.face.confidence > 0.7) {
        attentionStability += 10;
      }
      if (detection.face.gaze) {
        const gazeStrength = detection.face.gaze.strength;
        // Gaze strength is the primary factor - more weight
        attentionStability += gazeStrength * 30; // Increased from 10
        // Track gaze history for stability
        detectionHistory.gazeHistory.push(gazeStrength);
        if (detectionHistory.gazeHistory.length > detectionHistory.maxHistorySize) {
          detectionHistory.gazeHistory.shift();
        }
        // Lower variance = more stable - more weight
        if (detectionHistory.gazeHistory.length > 5) {
          const variance = this.calculateVariance(detectionHistory.gazeHistory);
          attentionStability += (1 - Math.min(variance, 1)) * 20; // Increased from 10
        }
      } else {
        // Penalty for no gaze data
        attentionStability -= 15;
      }
    } else {
      attentionStability -= 30; // Larger penalty for no face detection
    }
    attentionStability = Math.max(0, Math.min(100, Math.round(attentionStability)));

    // Calculate Question Quality (0-100)
    // Based on: hand gestures, head tilts (contemplation), hand movement patterns
    let questionQuality = 50;
    if (detection.hand?.detected) {
      questionQuality += 20;
      if (detection.hand.gestures && detection.hand.gestures.length > 0) {
        // Different gestures indicate engagement
        questionQuality += detection.hand.gestures.length * 10;
      }
      // Track hand movement
      detectionHistory.handMovementHistory.push(true);
    } else {
      detectionHistory.handMovementHistory.push(false);
    }
    if (detectionHistory.handMovementHistory.length > detectionHistory.maxHistorySize) {
      detectionHistory.handMovementHistory.shift();
    }
    // Head tilt (roll) suggests contemplation
    if (detection.face?.rotation?.roll) {
      const roll = Math.abs(detection.face.rotation.roll);
      if (roll > 0.1) {
        questionQuality += Math.min(roll * 30, 20);
      }
    }
    // Hand movement frequency indicates engagement
    if (detectionHistory.handMovementHistory.length > 10) {
      const movementRate = detectionHistory.handMovementHistory.filter(Boolean).length / 
                           detectionHistory.handMovementHistory.length;
      questionQuality += movementRate * 10;
    }
    questionQuality = Math.max(0, Math.min(100, Math.round(questionQuality)));

    // Calculate Vibe Alignment (0-100)
    // Based on: emotion detection (happy, surprised), positive expressions
    let vibeAlignment = 50;
    if (detection.face?.emotion) {
      const { happy, surprised, neutral, sad, angry } = detection.face.emotion;
      // Positive emotions boost vibe
      vibeAlignment += happy * 30;
      vibeAlignment += surprised * 15; // Surprise can be positive (interest)
      // Negative emotions reduce vibe
      vibeAlignment -= sad * 20;
      vibeAlignment -= angry * 25;
      // Track emotion history
      detectionHistory.emotionHistory.push({ happy, neutral });
      if (detectionHistory.emotionHistory.length > detectionHistory.maxHistorySize) {
        detectionHistory.emotionHistory.shift();
      }
    }
    // Average positive emotion over time
    if (detectionHistory.emotionHistory.length > 5) {
      const avgHappy = detectionHistory.emotionHistory.reduce((sum, e) => sum + e.happy, 0) / 
                       detectionHistory.emotionHistory.length;
      vibeAlignment += avgHappy * 10;
    }
    vibeAlignment = Math.max(0, Math.min(100, Math.round(vibeAlignment)));

    return {
      curiosityIndex,
      attentionStability,
      questionQuality,
      vibeAlignment,
    };
  },

  calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  },

  // Simulate real-time updates - fallback if no detection available
  simulateMetricsUpdate(): JudgeMetrics {
    const randomInRange = (min: number, max: number) => 
      Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      curiosityIndex: randomInRange(55, 95),
      attentionStability: randomInRange(60, 90),
      questionQuality: randomInRange(50, 85),
      vibeAlignment: randomInRange(45, 88),
    };
  },

  resetHistory(): void {
    detectionHistory.detections = [];
    detectionHistory.gazeHistory = [];
    detectionHistory.headRotationHistory = [];
    detectionHistory.emotionHistory = [];
    detectionHistory.handMovementHistory = [];
  },
};
