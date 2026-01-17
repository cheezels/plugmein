import { useState, useEffect, useCallback } from 'react';
import { JudgeMetrics, MetricExplanation, JudgeSession, HumanDetectionResult } from '@/types/judge.types';
import { metricsService } from '@/services/metricsService';

const initialMetrics: JudgeMetrics = {
  curiosityIndex: 0,
  attentionStability: 0,
  questionQuality: 0,
  vibeAlignment: 0,
};

export function useJudgeMetrics(isRecording: boolean, detectionResult?: HumanDetectionResult | null) {
  const [session, setSession] = useState<JudgeSession>({
    id: crypto.randomUUID(),
    startTime: new Date(),
    isRecording: false,
    metrics: initialMetrics,
    explanations: [],
    overallScore: 0,
  });

  const updateMetrics = useCallback((newMetrics: JudgeMetrics, detection?: HumanDetectionResult | null) => {
    const explanations = metricsService.generateExplanations(newMetrics, detection);
    const overallScore = metricsService.calculateOverallScore(newMetrics);
    
    setSession(prev => ({
      ...prev,
      metrics: newMetrics,
      explanations,
      overallScore,
    }));
  }, []);

  // Update metrics when detection result changes
  useEffect(() => {
    if (detectionResult && isRecording) {
      const newMetrics = metricsService.calculateMetricsFromDetection(detectionResult);
      updateMetrics(newMetrics, detectionResult);
    }
  }, [detectionResult, isRecording, updateMetrics]);

  // Fallback: Simulate real-time updates when recording but no detection
  useEffect(() => {
    if (!isRecording || detectionResult) return;

    // Initial metrics
    const initialUpdate = metricsService.simulateMetricsUpdate();
    updateMetrics(initialUpdate);

    const interval = setInterval(() => {
      const newMetrics = metricsService.simulateMetricsUpdate();
      updateMetrics(newMetrics);
    }, 2000);

    return () => clearInterval(interval);
  }, [isRecording, detectionResult, updateMetrics]);

  useEffect(() => {
    setSession(prev => ({ ...prev, isRecording }));
  }, [isRecording]);

  return {
    session,
    updateMetrics,
  };
}
