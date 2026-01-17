import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Video, VideoOff, Circle } from 'lucide-react';
import { CameraState } from '@/types/judge.types';

interface CameraFeedProps {
  cameraState: CameraState;
  isRecording: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onToggleRecording: () => void;
}

export const CameraFeed = forwardRef<HTMLVideoElement, CameraFeedProps>(
  ({ cameraState, isRecording, onStartCamera, onStopCamera, onToggleRecording }, ref) => {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="camera-feed bg-secondary aspect-video w-full"
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
