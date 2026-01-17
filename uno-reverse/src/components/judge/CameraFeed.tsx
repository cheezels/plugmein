import { forwardRef, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Circle, Code } from 'lucide-react';
import { CameraState, HumanDetectionResult } from '@/types/judge.types';
import { humanService } from '@/services/humanService';

interface CameraFeedProps {
  cameraState: CameraState;
  isRecording: boolean;
  detectionResult?: HumanDetectionResult | null;
  onToggleRecording: () => void;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  ({ cameraState, isRecording, detectionResult, onToggleRecording }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [developerMode, setDeveloperMode] = useState(false);

    // Draw detection overlays on canvas with continuous updates in Developer Mode
    useEffect(() => {
      const canvas = canvasRef.current;
      const video = ref && 'current' in ref ? ref.current : null;
      
      if (!canvas || !video || !isRecording) {
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

      let animationFrameId: number;

      // Drawing function for continuous updates
      const drawFrame = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Developer Mode: Use Human library's built-in drawing utilities
        if (developerMode) {
          const human = humanService.getHumanInstance();
          const result = humanService.getLastRawResult();
          
          if (human && result) {
            // Use Human's built-in drawing methods for accurate visualization
            const drawOptions = {
              bodyLabels: 'person' as const,
              drawBoxes: true,
              drawGestures: true,
              drawLabels: true,
              drawPoints: true,
              drawPolygons: true,
              font: 'small-caps 14px "Segoe UI"',
              lineHeight: 16,
              shadowColor: 'black',
              fillPolygons: false,
              useDepth: true,
              useCurves: true,
            };

            // Draw all detections (face, body, hand)
            human.draw.canvas(video, canvas);
            human.draw.face(canvas, result.face, drawOptions);
            human.draw.body(canvas, result.body, drawOptions);
            human.draw.hand(canvas, result.hand, drawOptions);
            human.draw.gesture(canvas, result.gesture, drawOptions);
            
            // Draw additional info overlay
            if (result.face && result.face.length > 0) {
              const face = result.face[0];
              ctx.font = '12px monospace';
              ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
              ctx.fillRect(10, 10, 280, 140);
              ctx.fillStyle = '#10b981';
              let yPos = 25;
              ctx.fillText(`Face Detected: ${face.score?.toFixed(3) || 'N/A'}`, 15, yPos);
              yPos += 15;
              
              if (face.rotation) {
                const rotation: any = face.rotation;
                const pitch = rotation.angle?.pitch || rotation.pitch;
                const yaw = rotation.angle?.yaw || rotation.yaw;
                const roll = rotation.angle?.roll || rotation.roll;
                ctx.fillText(`Pitch: ${pitch?.toFixed(3) || 'N/A'}°`, 15, yPos);
                yPos += 15;
                ctx.fillText(`Yaw: ${yaw?.toFixed(3) || 'N/A'}°`, 15, yPos);
                yPos += 15;
                ctx.fillText(`Roll: ${roll?.toFixed(3) || 'N/A'}°`, 15, yPos);
                yPos += 15;
                
                const faceGaze = rotation.gaze;
                if (faceGaze) {
                  ctx.fillText(`Gaze Strength: ${faceGaze.strength?.toFixed(3) || 'N/A'}`, 15, yPos);
                  yPos += 15;
                  ctx.fillText(`Gaze Bearing: ${faceGaze.bearing?.toFixed(3) || 'N/A'}°`, 15, yPos);
                  yPos += 15;
                }
              }
              
              if (face.emotion && face.emotion.length > 0) {
                const topEmotion = face.emotion[0];
                ctx.fillText(`Emotion: ${topEmotion.emotion} (${topEmotion.score?.toFixed(3)})`, 15, yPos);
                yPos += 15;
              }
              
              if (face.age) {
                ctx.fillText(`Age: ~${Math.round(face.age)}`, 15, yPos);
                yPos += 15;
              }

              if (face.gender) {
                ctx.fillText(`Gender: ${face.gender}`, 15, yPos);
              }
            }
          }
        }

        // Continue animation loop in Developer Mode
        if (developerMode) {
          animationFrameId = requestAnimationFrame(drawFrame);
        }
      };

      // Start drawing
      drawFrame();

      // Cleanup
      return () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }, [isRecording, ref, developerMode]);

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
        {cameraState.isActive && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-4">
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
                
                {/* Recording Label */}
                <span className="text-sm text-foreground/80">
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
                </span>
              </div>
              
              {/* Developer Mode Toggle */}
              {isRecording && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setDeveloperMode(!developerMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                    developerMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/10 backdrop-blur-sm text-foreground hover:bg-white/20'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  Developer Mode {developerMode ? 'ON' : 'OFF'}
                </motion.button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  }
);

CameraFeed.displayName = 'CameraFeed';
