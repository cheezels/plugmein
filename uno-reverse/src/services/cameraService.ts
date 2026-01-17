import { CameraState } from '@/types/judge.types';

export const cameraService = {
  async initializeCamera(): Promise<CameraState> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user',
        },
        audio: false,
      });
      
      // Configure tracks to stay active
      stream.getTracks().forEach(track => {
        // Ensure track stays enabled
        track.enabled = true;
        
        // Apply constraints to keep track active
        if (track.kind === 'video') {
          track.applyConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            facingMode: 'user',
          }).catch(error => {
            console.warn('Could not apply video constraints:', error);
          });
        }
      });
      
      return {
        isActive: true,
        stream,
        error: null,
      };
    } catch (error) {
      return {
        isActive: false,
        stream: null,
        error: error instanceof Error ? error.message : 'Failed to access camera',
      };
    }
  },

  stopCamera(stream: MediaStream | null): void {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    }
  },
};
