import { JudgeMetrics, MetricExplanation } from '@/types/judge.types';

// Mock service - replace with your actual library integration
export const metricsService = {
  calculateOverallScore(metrics: JudgeMetrics): number {
    const weights = {
      curiosityIndex: 0.3,
      attentionStability: 0.25,
      questionQuality: 0.25,
      vibeAlignment: 0.2,
    };
    
    return Math.round(
      metrics.curiosityIndex * weights.curiosityIndex +
      metrics.attentionStability * weights.attentionStability +
      metrics.questionQuality * weights.questionQuality +
      metrics.vibeAlignment * weights.vibeAlignment
    );
  },

  generateExplanations(metrics: JudgeMetrics): MetricExplanation[] {
    return [
      {
        metric: 'curiosityIndex',
        label: 'Curiosity Index',
        score: metrics.curiosityIndex,
        description: 'Measures engagement through eyebrow raises, forward leans, and pupil dilation patterns.',
        trend: metrics.curiosityIndex > 70 ? 'up' : metrics.curiosityIndex > 40 ? 'stable' : 'down',
        insights: [
          metrics.curiosityIndex > 70 ? 'High engagement detected' : 'Moderate interest observed',
          'Peak curiosity during technical demo',
        ],
      },
      {
        metric: 'attentionStability',
        label: 'Attention Stability',
        score: metrics.attentionStability,
        description: 'Tracks focus duration, gaze patterns, and distraction frequency.',
        trend: metrics.attentionStability > 70 ? 'up' : metrics.attentionStability > 40 ? 'stable' : 'down',
        insights: [
          metrics.attentionStability > 70 ? 'Sustained focus maintained' : 'Some attention drift noted',
          'Eye contact consistency: Good',
        ],
      },
      {
        metric: 'questionQuality',
        label: 'Question Quality',
        score: metrics.questionQuality,
        description: 'Analyzes thoughtfulness via pause patterns and contemplative expressions.',
        trend: metrics.questionQuality > 70 ? 'up' : metrics.questionQuality > 40 ? 'stable' : 'down',
        insights: [
          metrics.questionQuality > 70 ? 'Deep analytical thinking detected' : 'Surface-level inquiry observed',
          'Head tilts indicate processing',
        ],
      },
      {
        metric: 'vibeAlignment',
        label: 'Vibe Alignment',
        score: metrics.vibeAlignment,
        description: 'Measures emotional resonance through micro-expressions and body language.',
        trend: metrics.vibeAlignment > 70 ? 'up' : metrics.vibeAlignment > 40 ? 'stable' : 'down',
        insights: [
          metrics.vibeAlignment > 70 ? 'Strong positive resonance' : 'Neutral emotional state',
          'Genuine smile frequency: Moderate',
        ],
      },
    ];
  },

  // Simulate real-time updates - replace with actual library
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
};
