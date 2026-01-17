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
      console.log('🚀 Initializing Human detection service...');
      humanService
        .initialize()
        .then(() => {
          isInitializedRef.current = true;
          console.log('✅ Human detection initialized successfully');
        })
        .catch((error) => {
          console.error('❌ Failed to initialize Human detection:', error);
        });
    } else {
      console.log('⏭️ Skipping initialization:', {
        isActive,
        alreadyInitialized: isInitializedRef.current,
      });
    }

    return () => {
      if (!isActive) {
        console.log('🔄 Resetting initialization state');
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
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Check if video is actually playing and has dimensions
    if (currentVideo.readyState < 2 || currentVideo.videoWidth === 0) {
      console.log('⏳ Video not ready yet, waiting...');
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Throttle detection to every 2 seconds for stable metrics
    const now = Date.now();
    if (now - lastDetectionTimeRef.current < 2000) {
      // Skip this frame if too soon (less than 2 seconds since last detection)
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastDetectionTimeRef.current = now;

    console.log('🔍 Running detection...');
    setIsProcessing(true);
    try {
      const result = await humanService.detect(currentVideo);
      console.log('✅ Detection complete:', {
        faceDetected: result.face?.detected,
        handDetected: result.hand?.detected,
        bodyDetected: result.body?.detected,
      });
      setDetectionResult(result);

      // Calculate metrics from detection
      const metrics = metricsService.calculateMetricsFromDetection(result);
      console.log('📊 Metrics calculated:', metrics);
      onMetricsUpdate?.(metrics);
    } catch (error) {
      console.error('❌ Detection error:', error);
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
    console.log('🎬 Detection loop effect triggered:', {
      isActive,
      isRecording,
      hasVideo: !!videoElementRef.current,
      isInitialized: isInitializedRef.current,
      videoReadyState: videoElementRef.current?.readyState,
      videoWidth: videoElementRef.current?.videoWidth,
    });

    if (isActive && isRecording && isInitializedRef.current) {
      // Start detection loop - it will wait for video to be ready internally
      console.log('✅ Starting detection loop');
      detectionFrameRef.current = requestAnimationFrame(detectFrame);
    } else {
      // Stop detection loop
      console.log('❌ Stopping detection loop');
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
