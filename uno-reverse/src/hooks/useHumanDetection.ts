import { useState, useEffect, useRef, useCallback } from 'react';
import { humanService, HumanDetectionResult } from '@/services/humanService';
import { metricsService } from '@/services/metricsService';
import { JudgeMetrics } from '@/types/judge.types';

interface UseHumanDetectionOptions {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  isRecording: boolean;
  onMetricsUpdate?: (metrics: JudgeMetrics) => void;
}

export function useHumanDetection({
  videoElement,
  isActive,
  isRecording,
  onMetricsUpdate,
}: UseHumanDetectionOptions) {
  const [detectionResult, setDetectionResult] = useState<HumanDetectionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const detectionFrameRef = useRef<number | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);
  const isInitializedRef = useRef(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(videoElement);

  // Update video element ref when it changes
  useEffect(() => {
    videoElementRef.current = videoElement;
  }, [videoElement]);

  // Initialize Human service
  useEffect(() => {
    if (isActive && !isInitializedRef.current) {
      humanService
        .initialize()
        .then(() => {
          isInitializedRef.current = true;
          console.log('Human detection initialized');
        })
        .catch((error) => {
          console.error('Failed to initialize Human detection:', error);
        });
    }

    return () => {
      if (!isActive) {
        isInitializedRef.current = false;
      }
    };
  }, [isActive]);

  // Reset history when recording starts
  useEffect(() => {
    if (isRecording) {
      metricsService.resetHistory();
    }
  }, [isRecording]);

  // Detection loop
  const detectFrame = useCallback(async () => {
    const currentVideo = videoElementRef.current;
    if (!currentVideo || !isActive || !isRecording || isProcessing) {
      return;
    }

    // Throttle detection to ~15-20 FPS to avoid overloading
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < 50) {
      // Skip this frame if too soon
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastDetectionTimeRef.current = now;

    setIsProcessing(true);
    try {
      const result = await humanService.detect(currentVideo);
      setDetectionResult(result);

      // Calculate metrics from detection
      const metrics = metricsService.calculateMetricsFromDetection(result);
      onMetricsUpdate?.(metrics);
    } catch (error) {
      console.error('Detection error:', error);
    } finally {
      setIsProcessing(false);
      // Continue detection loop
      if (isActive && isRecording && videoElementRef.current) {
        detectionFrameRef.current = requestAnimationFrame(detectFrame);
      }
    }
  }, [isActive, isRecording, isProcessing, onMetricsUpdate]);

  // Start/stop detection loop
  useEffect(() => {
    if (isActive && isRecording && videoElementRef.current && isInitializedRef.current) {
      // Start detection loop
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
    } else {
      // Stop detection loop
      if (detectionFrameRef.current !== null) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }
    }

    return () => {
      if (detectionFrameRef.current !== null) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }
    };
  }, [isActive, isRecording, detectFrame]);

  // Get interpolated result for smooth visualization
  const getInterpolatedResult = useCallback((): HumanDetectionResult | null => {
    if (!isActive || !isRecording) {
      return null;
    }
    return humanService.getInterpolatedResult();
  }, [isActive, isRecording]);

  return {
    detectionResult,
    isProcessing,
    getInterpolatedResult,
  };
}
