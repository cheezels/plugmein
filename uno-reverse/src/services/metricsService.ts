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

// Track session metrics for summary
interface MetricSnapshot {
  timestamp: Date;
  metrics: JudgeMetrics;
  detection: HumanDetectionResult;
}

interface SessionSummary {
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  totalSnapshots: number;
  averageMetrics: JudgeMetrics;
  metricTrends: {
    curiosityIndex: { min: number; max: number; trend: string };
    attentionStability: { min: number; max: number; trend: string };
    vibeAlignment: { min: number; max: number; trend: string };
  };
  keyInsights: string[];
}

const detectionHistory: DetectionHistory = {
  detections: [],
  gazeHistory: [],
  headRotationHistory: [],
  emotionHistory: [],
  handMovementHistory: [],
  maxHistorySize: 15, // Keep last 15 detections (30 seconds at 2-second intervals)
};

let sessionSnapshots: MetricSnapshot[] = [];
let sessionStartTime: Date | null = null;

export const metricsService = {
  calculateOverallScore(metrics: JudgeMetrics): number {
    // Weight distribution: Focus on attention and curiosity, minimal emotion weight
    const weights = {
      curiosityIndex: 0.45,      // Primary: Forward lean/engagement (45%)
      attentionStability: 0.45,   // Primary: Screen attention (45%)
      questionQuality: 0,         // Excluded (work in progress)
      vibeAlignment: 0.10,       // Minimal: Emotion only 10% of score
    };
    
    return Math.round(
      metrics.curiosityIndex * weights.curiosityIndex +
      metrics.attentionStability * weights.attentionStability +
      metrics.vibeAlignment * weights.vibeAlignment
    );
  },

  generateExplanations(metrics: JudgeMetrics, detection?: HumanDetectionResult): MetricExplanation[] {
    const insights: MetricExplanation[] = [];

    // Check if face is detected for all metrics
    const faceDetected = detection?.face?.detected ?? false;

    // Curiosity Index - Forward lean focused
    const curiosityInsights: string[] = [];
    if (!faceDetected) {
      curiosityInsights.push('⚠️ No face detected');
      curiosityInsights.push('Position yourself in front of the camera');
    } else if (detection?.face?.rotation) {
      const { pitch, yaw, roll } = detection.face.rotation;
      
      // Forward lean feedback
      if (pitch > 0.15) {
        curiosityInsights.push('🔥 Strong forward lean - highly engaged');
      } else if (pitch > 0.08) {
        curiosityInsights.push('✅ Leaning forward - interested');
      } else if (pitch > 0.03) {
        curiosityInsights.push('👀 Slight forward lean');
      } else if (pitch > -0.05) {
        curiosityInsights.push('📏 Neutral position');
      } else {
        curiosityInsights.push('⬅️ Leaning back');
      }
      
      // Head tilt feedback
      const rollAbs = Math.abs(roll);
      if (rollAbs > 0.08 && rollAbs < 0.25) {
        curiosityInsights.push('Head tilt shows engagement');
      }
      
      // Facing direction
      if (Math.abs(yaw) < 0.15) {
        curiosityInsights.push('Facing screen');
      }
    } else {
      curiosityInsights.push('Analyzing head position...');
    }

    insights.push({
      metric: 'curiosityIndex',
      label: 'Curiosity Index',
      score: metrics.curiosityIndex,
      description: 'Measures engagement through forward lean (closeness to screen) and head tilt patterns.',
      trend: metrics.curiosityIndex > 70 ? 'up' : metrics.curiosityIndex > 40 ? 'stable' : 'down',
      insights: curiosityInsights,
    });

    // Attention Stability - Screen focus measurement
    const attentionInsights: string[] = [];
    if (!faceDetected) {
      attentionInsights.push('⚠️ No face detected');
      attentionInsights.push('Ensure proper lighting and face visibility');
    } else if (detection?.face?.rotation) {
      const { yaw, pitch } = detection.face.rotation;
      const yawDeviation = Math.abs(yaw);
      
      // Head orientation feedback
      if (yawDeviation < 0.15) {
        attentionInsights.push('✅ Directly facing screen');
      } else if (yawDeviation < 0.3) {
        attentionInsights.push('👀 Mostly facing screen');
      } else if (yawDeviation < 0.5) {
        attentionInsights.push('👈 Slightly turned away');
      } else {
        attentionInsights.push('⚠️ Looking away from screen');
      }
      
      // Head position feedback
      if (pitch > -0.2 && pitch < 0.3) {
        attentionInsights.push('Head at screen level');
      } else if (pitch < -0.3) {
        attentionInsights.push('Head tilted down');
      } else if (pitch > 0.4) {
        attentionInsights.push('Head tilted up');
      }
      
      // Consistency check
      if (detectionHistory.headRotationHistory.length >= 5) {
        const yawValues = detectionHistory.headRotationHistory.map(h => Math.abs(h.yaw));
        const avgYaw = yawValues.reduce((sum, val) => sum + val, 0) / yawValues.length;
        
        if (avgYaw < 0.2) {
          attentionInsights.push('Sustained screen attention');
        } else if (avgYaw < 0.4) {
          attentionInsights.push('Moderate screen focus');
        } else {
          attentionInsights.push('Inconsistent screen attention');
        }
      }
      
      // Engagement feedback
      if (detection.face.emotion) {
        const { happy, surprised } = detection.face.emotion;
        if (happy > 0.3 || surprised > 0.3) {
          attentionInsights.push('Engaged and interested');
        }
      }
    } else {
      attentionInsights.push('Analyzing screen attention...');
    }

    insights.push({
      metric: 'attentionStability',
      label: 'Attention Stability',
      score: metrics.attentionStability,
      description: 'Measures if judge is looking at the screen through head orientation, position, and consistency over time.',
      trend: metrics.attentionStability > 70 ? 'up' : metrics.attentionStability > 40 ? 'stable' : 'down',
      insights: attentionInsights,
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
      score: 0,
      description: '⏸️ PAUSED: This metric is currently under development and not being calculated.',
      trend: 'stable',
      insights: ['Metric calculation paused', 'Under development'],
    });

    // Vibe Alignment
    const vibeInsights: string[] = [];
    if (!faceDetected) {
      vibeInsights.push('⚠️ No face detected');
      vibeInsights.push('Cannot analyze emotional state');
    } else if (detection?.face?.emotion) {
      const { happy, neutral, surprised, sad, angry } = detection.face.emotion;
      
      // Dominant emotion feedback
      if (happy > 0.3) {
        vibeInsights.push('😊 Positive emotions detected');
      } else if (happy > 0.15) {
        vibeInsights.push('🙂 Moderate positive engagement');
      }
      
      if (surprised > 0.3) {
        vibeInsights.push('🤩 Strong interest/surprise - excellent!');
      } else if (surprised > 0.15) {
        vibeInsights.push('😮 Interest/surprise expressions');
      }
      
      if (neutral > 0.4) {
        vibeInsights.push('😐 Professional composure - calm and focused');
      }
      
      // Only show negative if VERY high (genuinely distressed/upset)
      if ((sad || 0) > 0.7) {
        vibeInsights.push('😔 Strong disappointment detected');
      } else if ((sad || 0) > 0.6) {
        vibeInsights.push('🤔 Slight concern showing');
      }
      
      if ((angry || 0) > 0.8) {
        vibeInsights.push('😠 Strong frustration detected');
      } else if ((angry || 0) > 0.7) {
        vibeInsights.push('🤨 Mild skepticism detected');
      }
      
      if (vibeInsights.length === 0) {
        vibeInsights.push('Monitoring emotional state...');
      }
    } else {
      vibeInsights.push('Analyzing emotional resonance...');
    }

    insights.push({
      metric: 'vibeAlignment',
      label: 'Vibe Alignment',
      score: metrics.vibeAlignment,
      description: 'Measures emotional engagement - surprise is most valuable (shows genuine interest), followed by happiness. Neutral indicates professional composure. Only considers sadness and anger as negatives.',
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

    // CRITICAL: If no face detected, reset all metrics to 0
    if (!detection.face?.detected) {
      console.log('❌ No face detected - all metrics set to 0');
      // Clear gaze history when face is lost
      detectionHistory.gazeHistory = [];
      detectionHistory.emotionHistory = [];
      
      return {
        curiosityIndex: 0,
        attentionStability: 0,
        questionQuality: 0,
        vibeAlignment: 0,
      };
    }
    
    console.log('✅ Face detected - calculating metrics from:', {
      confidence: detection.face.confidence,
      hasRotation: !!detection.face.rotation,
      hasGaze: !!detection.face.gaze,
      gazeStrength: detection.face.gaze?.strength,
      hasIris: !!detection.face.iris,
      hasEmotion: !!detection.face.emotion,
    });

    // Calculate Curiosity Index (0-100)
    // Based on: Forward lean (pitch) primarily, with head tilt (roll) as secondary
    // Focus on "leaning in" = interested/engaged
    let curiosityIndex = 30; // Lower base for more dynamic range
    
    if (detection.face.rotation) {
      const { pitch, yaw, roll } = detection.face.rotation;
      
      console.log('🎯 Rotation Values:', { pitch, yaw, roll });
      
      // PRIMARY: Forward lean (positive pitch) = curiosity/interest (50 points max)
      // Pitch typically ranges -0.3 to +0.3
      if (pitch > 0.15) {
        // Strong forward lean - very engaged
        curiosityIndex += 50;
      } else if (pitch > 0.08) {
        // Good forward lean
        curiosityIndex += 40;
      } else if (pitch > 0.03) {
        // Slight forward lean
        curiosityIndex += 30;
      } else if (pitch > -0.05) {
        // Neutral position
        curiosityIndex += 20;
      } else if (pitch > -0.15) {
        // Leaning back slightly
        curiosityIndex += 10;
      }
      // else leaning far back = 0 additional points
      
      // SECONDARY: Head tilt (roll) indicates interest (15 points max)
      // Slight tilt shows active engagement, but not too much
      const rollAbs = Math.abs(roll);
      if (rollAbs > 0.08 && rollAbs < 0.25) {
        // Noticeable tilt - shows interest
        curiosityIndex += 15;
      } else if (rollAbs > 0.04 && rollAbs < 0.35) {
        // Slight tilt
        curiosityIndex += 10;
      } else if (rollAbs > 0.02) {
        // Minimal tilt
        curiosityIndex += 5;
      }
      
      // TERTIARY: Facing forward bonus (15 points)
      // Must be facing screen to be curious about content
      const yawAbs = Math.abs(yaw);
      if (yawAbs < 0.15) {
        curiosityIndex += 15;
      } else if (yawAbs < 0.3) {
        curiosityIndex += 8;
      } else if (yawAbs < 0.5) {
        curiosityIndex += 3;
      }
      
      // SMOOTHING: Use history to reduce fluctuation
      if (detectionHistory.headRotationHistory.length >= 3) {
        const recentPitches = detectionHistory.headRotationHistory
          .slice(-3)
          .map(h => h.pitch);
        const avgPitch = recentPitches.reduce((sum, val) => sum + val, 0) / recentPitches.length;
        
        // Bonus for sustained forward lean
        if (avgPitch > 0.05) {
          curiosityIndex += 10; // Consistently leaning forward
        } else if (avgPitch > 0) {
          curiosityIndex += 5;
        }
      }
    }
    
    // Face confidence (quality bonus)
    if (detection.face.confidence && detection.face.confidence > 0.8) {
      curiosityIndex += 5;
    }
    
    curiosityIndex = Math.max(0, Math.min(100, Math.round(curiosityIndex)));

    // Calculate Attention Stability (0-100)
    // Based on: Is the judge looking at the SCREEN (not necessarily at camera)?
    // Key: Head orientation (yaw/pitch) + consistency over time
    let attentionStability = 0; // Start from 0
    
    if (detection.face.rotation) {
      const { pitch, yaw, roll } = detection.face.rotation;
      
      console.log('👁️ Attention Tracking:', { yaw, pitch, roll });
      
      // PRIMARY: Is face pointed at screen? (45 points max)
      // Yaw = horizontal rotation (left/right)
      // More granular scoring to avoid jumping to max
      const yawDeviation = Math.abs(yaw);
      
      if (yawDeviation < 0.08) {
        // Very directly facing screen
        attentionStability += 45;
      } else if (yawDeviation < 0.15) {
        // Directly facing screen
        attentionStability += 38;
      } else if (yawDeviation < 0.25) {
        // Mostly facing screen
        attentionStability += 30;
      } else if (yawDeviation < 0.4) {
        // Somewhat facing screen
        attentionStability += 18;
      } else if (yawDeviation < 0.6) {
        // Slightly turned away
        attentionStability += 8;
      }
      // else 0 points - clearly looking away
      
      // SECONDARY: Head position (not looking down at phone, etc.) (25 points)
      // Pitch = vertical rotation (up/down)
      // More granular scoring
      if (pitch > -0.15 && pitch < 0.2) {
        // Optimal head position
        attentionStability += 25;
      } else if (pitch > -0.25 && pitch < 0.35) {
        // Good head position
        attentionStability += 18;
      } else if (pitch > -0.4 && pitch < 0.5) {
        // Acceptable range
        attentionStability += 10;
      }
      // else 0 points - head too far up/down
      
      // Track head orientation history for consistency
      detectionHistory.headRotationHistory.push({ pitch, yaw, roll });
      if (detectionHistory.headRotationHistory.length > detectionHistory.maxHistorySize) {
        detectionHistory.headRotationHistory.shift();
      }
      
      // TERTIARY: Consistency bonus (20 points)
      // Sustained screen attention over time
      if (detectionHistory.headRotationHistory.length >= 5) {
        // Need at least 5 samples (10 seconds)
        const yawValues = detectionHistory.headRotationHistory.map(h => Math.abs(h.yaw));
        const avgYaw = yawValues.reduce((sum, val) => sum + val, 0) / yawValues.length;
        const yawVariance = this.calculateVariance(yawValues);
        
        // Low average yaw + low variance = consistently facing screen
        if (avgYaw < 0.15 && yawVariance < 0.02) {
          attentionStability += 20; // Very sustained attention
        } else if (avgYaw < 0.25 && yawVariance < 0.05) {
          attentionStability += 15; // Good sustained attention
        } else if (avgYaw < 0.4) {
          attentionStability += 8; // Moderate consistency
        }
      }
      
      // BONUS: Engaged expression (10 points)
      // Positive/interested emotions while looking at screen
      if (detection.face.emotion) {
        const { happy, surprised, neutral } = detection.face.emotion;
        const engagementScore = (happy * 1.5 + surprised * 0.8 + neutral * 0.2);
        if (engagementScore > 0.4) {
          attentionStability += 10;
        } else if (engagementScore > 0.25) {
          attentionStability += 6;
        } else if (engagementScore > 0.15) {
          attentionStability += 3;
        }
      }
    } else {
      // No rotation data - can't measure attention
      attentionStability = 0;
    }
    
    attentionStability = Math.max(0, Math.min(100, Math.round(attentionStability)));

    // Calculate Question Quality (0-100)
    // PAUSED: This metric is under development - return fixed value
    const questionQuality = 0; // Paused - not calculating yet

    // Calculate Vibe Alignment (0-100)
    // Based on: emotion detection with emphasis on positive emotions
    // Note: Human library tends to detect neutral/sad more than positive emotions
    let vibeAlignment = 30; // Lower base to give more room for emotion scoring
    
    if (detection.face.emotion) {
      const { happy, surprised, neutral, sad, angry, fearful, disgusted } = detection.face.emotion;
      
      console.log('😊 Emotion Scores:', { happy, surprised, neutral, sad, angry });
      
      // POSITIVE EMOTIONS (highly amplified)
      vibeAlignment += happy * 70; // Strong positive indicator (0-70 points)
      vibeAlignment += surprised * 100; // Surprise is EXCELLENT - shows strong interest! (0-100 points) 🎯
      
      // NEUTRAL (highly valued - judges being calm and professional is good)
      vibeAlignment += neutral * 40; // 0-40 points (neutral = professional composure)
      
      // NEGATIVE EMOTIONS (only sadness and anger, very minimal penalties)
      // Fearful and disgust are IGNORED - judges naturally show concentration faces
      // Only penalize sadness/anger when VERY HIGH (> 0.6 = genuinely upset)
      if ((sad || 0) > 0.6) {
        vibeAlignment -= (sad - 0.6) * 30; // Reduced penalty, higher threshold
      } else if ((sad || 0) > 0.5) {
        vibeAlignment -= (sad - 0.5) * 10; // Very light penalty
      }
      
      if ((angry || 0) > 0.7) {
        vibeAlignment -= (angry - 0.7) * 25; // Minimal penalty, very high threshold
      } else if ((angry || 0) > 0.6) {
        vibeAlignment -= (angry - 0.6) * 8; // Barely noticeable penalty
      }
      
      // Fearful and disgusted emotions are COMPLETELY IGNORED
      // These often trigger during normal thinking/concentration
      
      // Track emotion history
      detectionHistory.emotionHistory.push({ happy, neutral });
      if (detectionHistory.emotionHistory.length > detectionHistory.maxHistorySize) {
        detectionHistory.emotionHistory.shift();
      }
    }
    
    // Average positive emotion over time (consistency bonus)
    if (detectionHistory.emotionHistory.length >= 3) {
      const avgHappy = detectionHistory.emotionHistory.reduce((sum, e) => sum + e.happy, 0) / 
                       detectionHistory.emotionHistory.length;
      const avgNeutral = detectionHistory.emotionHistory.reduce((sum, e) => sum + e.neutral, 0) / 
                         detectionHistory.emotionHistory.length;
      
      // Consistent positive/neutral emotions = good vibe
      if (avgHappy > 0.2) {
        vibeAlignment += avgHappy * 20; // Sustained happiness bonus (0-20 points)
      }
      if (avgNeutral > 0.4) {
        vibeAlignment += avgNeutral * 10; // Sustained neutral/calm (0-10 points)
      }
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

  // Start a new recording session
  startSession(): void {
    sessionSnapshots = [];
    sessionStartTime = new Date();
    console.log('📹 Session started at:', sessionStartTime.toLocaleTimeString());
  },

  // Log a metric snapshot during recording
  logSnapshot(metrics: JudgeMetrics, detection: HumanDetectionResult): void {
    const snapshot: MetricSnapshot = {
      timestamp: new Date(),
      metrics,
      detection,
    };
    sessionSnapshots.push(snapshot);
    
    console.log('📊 Snapshot logged:', {
      time: snapshot.timestamp.toLocaleTimeString(),
      metrics,
      total: sessionSnapshots.length,
    });
  },

  // Generate session summary when recording stops
  generateSessionSummary(): SessionSummary | null {
    if (!sessionStartTime || sessionSnapshots.length === 0) {
      return null;
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - sessionStartTime.getTime()) / 1000);

    // Calculate average metrics
    const avgCuriosity = sessionSnapshots.reduce((sum, s) => sum + s.metrics.curiosityIndex, 0) / sessionSnapshots.length;
    const avgAttention = sessionSnapshots.reduce((sum, s) => sum + s.metrics.attentionStability, 0) / sessionSnapshots.length;
    const avgVibe = sessionSnapshots.reduce((sum, s) => sum + s.metrics.vibeAlignment, 0) / sessionSnapshots.length;

    // Calculate min/max for each metric
    const curiosityValues = sessionSnapshots.map(s => s.metrics.curiosityIndex);
    const attentionValues = sessionSnapshots.map(s => s.metrics.attentionStability);
    const vibeValues = sessionSnapshots.map(s => s.metrics.vibeAlignment);

    // Determine trends (comparing first half vs second half)
    const midpoint = Math.floor(sessionSnapshots.length / 2);
    const firstHalfCuriosity = curiosityValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const secondHalfCuriosity = curiosityValues.slice(midpoint).reduce((a, b) => a + b, 0) / (curiosityValues.length - midpoint);
    const curiosityTrend = secondHalfCuriosity > firstHalfCuriosity + 5 ? 'improving' : 
                          secondHalfCuriosity < firstHalfCuriosity - 5 ? 'declining' : 'stable';

    const firstHalfAttention = attentionValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const secondHalfAttention = attentionValues.slice(midpoint).reduce((a, b) => a + b, 0) / (attentionValues.length - midpoint);
    const attentionTrend = secondHalfAttention > firstHalfAttention + 5 ? 'improving' : 
                          secondHalfAttention < firstHalfAttention - 5 ? 'declining' : 'stable';

    const firstHalfVibe = vibeValues.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const secondHalfVibe = vibeValues.slice(midpoint).reduce((a, b) => a + b, 0) / (vibeValues.length - midpoint);
    const vibeTrend = secondHalfVibe > firstHalfVibe + 5 ? 'improving' : 
                     secondHalfVibe < firstHalfVibe - 5 ? 'declining' : 'stable';

    // Generate key insights
    const insights: string[] = [];

    // Curiosity insights
    if (avgCuriosity >= 70) {
      insights.push('🔥 High engagement - Judge consistently leaned forward and showed interest');
    } else if (avgCuriosity >= 50) {
      insights.push('✅ Moderate engagement - Judge maintained good posture and attention');
    } else {
      insights.push('⚠️ Low engagement - Judge showed minimal forward lean or interest signals');
    }

    // Attention insights
    if (avgAttention >= 75) {
      insights.push('👀 Excellent focus - Judge consistently faced the screen throughout');
    } else if (avgAttention >= 50) {
      insights.push('👁️ Good focus - Judge mostly maintained screen attention');
    } else {
      insights.push('😑 Poor focus - Judge frequently looked away or lost attention');
    }

    // Vibe insights
    const avgEmotions = sessionSnapshots
      .filter(s => s.detection.face?.emotion)
      .map(s => s.detection.face.emotion!);
    
    if (avgEmotions.length > 0) {
      const avgHappy = avgEmotions.reduce((sum, e) => sum + (e.happy || 0), 0) / avgEmotions.length;
      const avgSurprised = avgEmotions.reduce((sum, e) => sum + (e.surprised || 0), 0) / avgEmotions.length;
      const avgSad = avgEmotions.reduce((sum, e) => sum + (e.sad || 0), 0) / avgEmotions.length;
      const avgAngry = avgEmotions.reduce((sum, e) => sum + (e.angry || 0), 0) / avgEmotions.length;

      if (avgSurprised > 0.25) {
        insights.push('🤩 Strong surprise reactions - Content generated significant interest');
      } else if (avgHappy > 0.25) {
        insights.push('😊 Positive emotions - Judge responded favorably to presentation');
      } else if (avgSad > 0.7 || avgAngry > 0.75) {
        insights.push('😔 Strong negative emotions detected - Judge showed significant concern or disappointment');
      } else if (avgSad > 0.6 || avgAngry > 0.65) {
        insights.push('🤔 Mild skepticism detected - Some concerns expressed');
      } else {
        insights.push('😐 Professional composure maintained - Calm and focused demeanor');
      }
    }

    // Trend insights
    if (curiosityTrend === 'improving' && attentionTrend === 'improving') {
      insights.push('📈 Strong finish - Judge engagement increased over time');
    } else if (curiosityTrend === 'declining' || attentionTrend === 'declining') {
      insights.push('📉 Lost interest - Judge engagement decreased toward the end');
    }

    // Face detection quality
    const faceDetectionRate = sessionSnapshots.filter(s => s.detection.face?.detected).length / sessionSnapshots.length;
    if (faceDetectionRate < 0.8) {
      insights.push(`⚠️ Detection issues - Face detected in only ${Math.round(faceDetectionRate * 100)}% of frames`);
    }

    const summary: SessionSummary = {
      startTime: sessionStartTime,
      endTime,
      duration,
      totalSnapshots: sessionSnapshots.length,
      averageMetrics: {
        curiosityIndex: Math.round(avgCuriosity),
        attentionStability: Math.round(avgAttention),
        questionQuality: 0,
        vibeAlignment: Math.round(avgVibe),
      },
      metricTrends: {
        curiosityIndex: {
          min: Math.min(...curiosityValues),
          max: Math.max(...curiosityValues),
          trend: curiosityTrend,
        },
        attentionStability: {
          min: Math.min(...attentionValues),
          max: Math.max(...attentionValues),
          trend: attentionTrend,
        },
        vibeAlignment: {
          min: Math.min(...vibeValues),
          max: Math.max(...vibeValues),
          trend: vibeTrend,
        },
      },
      keyInsights: insights,
    };

    console.log('📋 Session Summary Generated:', summary);
    return summary;
  },

  // Get current session snapshots (for debugging)
  getSessionSnapshots(): MetricSnapshot[] {
    return sessionSnapshots;
  },
};
