import { useState, useEffect, useRef, useCallback } from 'react';
import { cameraService } from '@/services/cameraService';
import { CameraState } from '@/types/judge.types';

export function useCamera() {
  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    stream: null,
    error: null,
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    isManuallyStoppedRef.current = false;
    const state = await cameraService.initializeCamera();
    
    if (state.stream) {
      streamRef.current = state.stream;
      setCameraState(state);
      
      // Set up track end listeners to auto-restart
      state.stream.getTracks().forEach(track => {
        track.onended = () => {
          if (!isManuallyStoppedRef.current && streamRef.current) {
            console.log('Track ended, attempting to restart...');
            // Restart the camera after a short delay
            restartTimeoutRef.current = setTimeout(() => {
              startCamera();
            }, 500);
          }
        };
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = state.stream;
        // Explicitly play the video stream
        try {
          await videoRef.current.play();
        } catch (error) {
          console.error('Error playing video stream:', error);
          setCameraState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to play video stream',
          }));
        }
      }
    } else {
      setCameraState(state);
    }
  }, []);

  const stopCamera = useCallback(() => {
    isManuallyStoppedRef.current = true;
    
    // Clear any pending restarts
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    // Clear health check interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    cameraService.stopCamera(streamRef.current);
    streamRef.current = null;
    
    // Clear the video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setCameraState({
      isActive: false,
      stream: null,
      error: null,
    });
  }, []);

  // Ensure video plays when stream is set and keep it playing
  useEffect(() => {
    if (cameraState.stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== cameraState.stream) {
        video.srcObject = cameraState.stream;
      }
      
      // Ensure video is playing
      const playVideo = async () => {
        try {
          await video.play();
        } catch (error) {
          console.error('Error playing video stream:', error);
          setCameraState(prev => ({
            ...prev,
            error: error instanceof Error ? error.message : 'Failed to play video stream',
          }));
        }
      };
      
      playVideo();
      
      // Keep video playing - restart if paused
      const keepPlaying = () => {
        if (video.paused && !video.ended && cameraState.isActive) {
          video.play().catch(error => {
            console.error('Error keeping video playing:', error);
          });
        }
      };
      
      // Check periodically to ensure video stays playing
      const playInterval = setInterval(keepPlaying, 1000);
      
      // Also listen for pause events
      video.addEventListener('pause', keepPlaying);
      
      return () => {
        clearInterval(playInterval);
        video.removeEventListener('pause', keepPlaying);
      };
    }
  }, [cameraState.stream, cameraState.isActive]);

  // Health check: Monitor stream and restart if needed
  useEffect(() => {
    if (cameraState.isActive && cameraState.stream) {
      healthCheckIntervalRef.current = setInterval(() => {
        const stream = streamRef.current;
        if (stream) {
          const videoTracks = stream.getVideoTracks();
          const allTracksActive = videoTracks.length > 0 && videoTracks.every(track => track.readyState === 'live');
          
          if (!allTracksActive && !isManuallyStoppedRef.current) {
            console.log('Stream health check failed, restarting camera...');
            startCamera();
          }
          
          // Also check if video element is playing
          if (videoRef.current && videoRef.current.paused && !isManuallyStoppedRef.current) {
            videoRef.current.play().catch(error => {
              console.error('Error restarting video playback:', error);
            });
          }
        }
      }, 2000); // Check every 2 seconds
      
      return () => {
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }
      };
    }
  }, [cameraState.isActive, cameraState.stream, startCamera]);

  // Handle visibility changes to keep camera active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && cameraState.isActive && videoRef.current && streamRef.current) {
        // Tab became visible again, ensure video is playing
        if (videoRef.current.paused) {
          videoRef.current.play().catch(error => {
            console.error('Error resuming video after visibility change:', error);
          });
        }
        
        // Check if stream is still active
        const videoTracks = streamRef.current.getVideoTracks();
        if (videoTracks.length === 0 || videoTracks.some(track => track.readyState !== 'live')) {
          if (!isManuallyStoppedRef.current) {
            console.log('Stream inactive after visibility change, restarting...');
            startCamera();
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cameraState.isActive, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isManuallyStoppedRef.current = true;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      cameraService.stopCamera(streamRef.current);
    };
  }, []);

  return {
    cameraState,
    videoRef,
    startCamera,
    stopCamera,
  };
}
