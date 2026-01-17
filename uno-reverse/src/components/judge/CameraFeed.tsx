import { forwardRef, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Circle } from 'lucide-react';
import { CameraState, HumanDetectionResult } from '@/types/judge.types';

interface CameraFeedProps {
  cameraState: CameraState;
  isRecording: boolean;
  detectionResult?: HumanDetectionResult | null;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onToggleRecording: () => void;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  ({ cameraState, isRecording, detectionResult, onStartCamera, onStopCamera, onToggleRecording }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Draw detection overlays on canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      const video = ref && 'current' in ref ? ref.current : null;
      if (!canvas || !video || !detectionResult || !isRecording) {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw face detection
      if (detectionResult.face?.detected) {
        // Draw face bounding box (simplified - would need actual bounding box from Human)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        
        // Draw face indicator in center area (since we don't have exact bbox)
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const size = Math.min(canvas.width, canvas.height) * 0.3;
        
        ctx.strokeRect(centerX - size / 2, centerY - size / 2, size, size);
        
        // Draw emotion indicator
        if (detectionResult.face.emotion) {
          const { happy, surprised } = detectionResult.face.emotion;
          if (happy > 0.5 || surprised > 0.4) {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
            ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
          }
        }

        // Draw gaze indicator
        if (detectionResult.face.gaze) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          const gazeStrength = detectionResult.face.gaze.strength;
          const radius = size * 0.3 * gazeStrength;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw hand detection
      if (detectionResult.hand?.detected && detectionResult.hand.landmarks) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.fillStyle = '#f59e0b';
        
        // Draw hand landmarks
        detectionResult.hand.landmarks.forEach((landmark, index) => {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;
          
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Draw connections for key points (simplified)
          if (index > 0 && index % 4 === 0) {
            const prevLandmark = detectionResult.hand.landmarks![index - 4];
            const prevX = prevLandmark.x * canvas.width;
            const prevY = prevLandmark.y * canvas.height;
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        });

        // Draw gesture label
        if (detectionResult.hand.gestures && detectionResult.hand.gestures.length > 0) {
          const firstLandmark = detectionResult.hand.landmarks[0];
          const labelX = firstLandmark.x * canvas.width;
          const labelY = (firstLandmark.y * canvas.height) - 10;
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(labelX - 40, labelY - 15, 80, 20);
          ctx.fillStyle = '#f59e0b';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(detectionResult.hand.gestures[0], labelX, labelY);
        }
      }
    }, [detectionResult, isRecording, ref]);

    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="camera-feed bg-secondary aspect-video w-full relative"
      >
        {cameraState.isActive ? (
          <>
            <video
              ref={ref}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Detection overlay canvas */}
            {isRecording && (
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: 'cover' }}
              />
            )}
            
            {/* Detection status indicators */}
            {isRecording && detectionResult && (
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {detectionResult.face?.detected && (
                  <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-foreground">Face Detected</span>
                  </div>
                )}
                {detectionResult.hand?.detected && (
                  <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-foreground">Hand Detected</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Recording overlay */}
            {isRecording && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 pointer-events-none"
              >
                {/* Corner brackets */}
                <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-primary/60" />
                <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-primary/60" />
                <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-primary/60" />
                <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-primary/60" />
                
                {/* Recording indicator */}
                <div className="absolute top-6 right-6 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <span className="text-xs font-medium text-foreground">REC</span>
                </div>

                {/* Scan line effect */}
                <motion.div
                  className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
                  animate={{ top: ['0%', '100%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
              </motion.div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <VideoOff className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              {cameraState.error || 'Camera not active'}
            </p>
          </div>
        )}

        {/* Controls overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-center gap-4">
            {!cameraState.isActive ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartCamera}
                className="flex items-center gap-2 px-6 py-3 bg-primary rounded-full text-primary-foreground font-medium"
              >
                <Video className="w-5 h-5" />
                Start Camera
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onToggleRecording}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    isRecording
                      ? 'bg-destructive'
                      : 'bg-white/10 border-2 border-white/30'
                  }`}
                >
                  {isRecording ? (
                    <div className="w-5 h-5 bg-white rounded-sm" />
                  ) : (
                    <Circle className="w-6 h-6 text-destructive fill-destructive" />
                  )}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onStopCamera}
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-foreground"
                >
                  <VideoOff className="w-4 h-4" />
                  Stop
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
