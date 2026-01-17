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
    if (isRecording && detectionResult) {
      console.log('🔍 Detection Result:', {
        faceDetected: detectionResult.face?.detected,
        confidence: detectionResult.face?.confidence,
        hasGaze: !!detectionResult.face?.gaze,
        gazeStrength: detectionResult.face?.gaze?.strength,
        gazeBearing: detectionResult.face?.gaze?.bearing,
        hasEmotion: !!detectionResult.face?.emotion,
        hasRotation: !!detectionResult.face?.rotation,
      });
      
      const newMetrics = metricsService.calculateMetricsFromDetection(detectionResult);
      
      console.log('📊 Calculated Metrics:', newMetrics);
      
      // Log snapshot for session summary
      metricsService.logSnapshot(newMetrics, detectionResult);
      
      updateMetrics(newMetrics, detectionResult);
    } else if (isRecording && !detectionResult) {
      console.log('⚠️ Recording but no detection result yet');
    }
  }, [detectionResult, isRecording, updateMetrics]);

  // Start session when recording starts
  useEffect(() => {
    if (isRecording) {
      metricsService.startSession();
    }
  }, [isRecording]);

  useEffect(() => {
    setSession(prev => ({ ...prev, isRecording }));
  }, [isRecording]);

  return {
    session,
    updateMetrics,
  };
}
