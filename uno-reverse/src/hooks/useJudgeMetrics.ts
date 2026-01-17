import { useState, useEffect, useCallback } from 'react';
import { JudgeMetrics, MetricExplanation, JudgeSession } from '@/types/judge.types';
import { metricsService } from '@/services/metricsService';

const initialMetrics: JudgeMetrics = {
  curiosityIndex: 0,
  attentionStability: 0,
  questionQuality: 0,
  vibeAlignment: 0,
};

export function useJudgeMetrics(isRecording: boolean) {
  const [session, setSession] = useState<JudgeSession>({
    id: crypto.randomUUID(),
    startTime: new Date(),
    isRecording: false,
    metrics: initialMetrics,
    explanations: [],
    overallScore: 0,
  });

  const updateMetrics = useCallback((newMetrics: JudgeMetrics) => {
    const explanations = metricsService.generateExplanations(newMetrics);
    const overallScore = metricsService.calculateOverallScore(newMetrics);
    
    setSession(prev => ({
      ...prev,
      metrics: newMetrics,
      explanations,
      overallScore,
    }));
  }, []);

  // Simulate real-time updates when recording
  useEffect(() => {
    if (!isRecording) return;

    // Initial metrics
    const initialUpdate = metricsService.simulateMetricsUpdate();
    updateMetrics(initialUpdate);

    const interval = setInterval(() => {
      const newMetrics = metricsService.simulateMetricsUpdate();
      updateMetrics(newMetrics);
    }, 2000);

    return () => clearInterval(interval);
  }, [isRecording, updateMetrics]);

  useEffect(() => {
    setSession(prev => ({ ...prev, isRecording }));
  }, [isRecording]);

  return {
    session,
    updateMetrics,
  };
}
