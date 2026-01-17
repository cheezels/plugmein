import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { CameraFeed } from '@/components/judge/CameraFeed';
import { MetricsPanel } from '@/components/judge/MetricsPanel';
import { SessionSummary } from '@/components/judge/SessionSummary';
import { useCamera } from '@/hooks/useCamera';
import { useJudgeMetrics } from '@/hooks/useJudgeMetrics';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { metricsService } from '@/services/metricsService';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const { cameraState, videoRef, startCamera } = useCamera();

  // Auto-start camera on mount
  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // Human detection hook
  const { detectionResult } = useHumanDetection({
    videoElement: videoRef.current,
    isActive: cameraState.isActive,
    isRecording,
  });

  const { session } = useJudgeMetrics(isRecording, detectionResult);

  const handleToggleRecording = () => {
    if (isRecording) {
      // Stopping recording - generate summary
      const summary = metricsService.generateSessionSummary();
      if (summary) {
        setSessionSummary(summary);
      }
    }
    setIsRecording(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 p-6">
        <div className="max-w-[1600px] mx-auto h-full">
          <div className="grid lg:grid-cols-[1fr_380px] gap-6 h-full">
            {/* Main Camera View */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-4"
            >
              <CameraFeed
                ref={videoRef}
                cameraState={cameraState}
                isRecording={isRecording}
                detectionResult={detectionResult}
                onToggleRecording={handleToggleRecording}
              />
              
              {/* Status bar */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-panel p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Session ID:</span>
                    <code className="text-xs text-foreground font-mono">
                      {session.id.slice(0, 8)}
                    </code>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Started:</span>
                    <span className="text-xs text-foreground">
                      {session.startTime.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {isRecording ? 'Recording in progress' : 'Ready to analyze'}
                  </span>
                </div>
              </motion.div>
            </motion.div>

            {/* Metrics Panel */}
            <MetricsPanel session={session} />
          </div>
        </div>
      </main>

      {/* Session Summary Modal */}
      <AnimatePresence>
        {sessionSummary && (
          <SessionSummary
            summary={sessionSummary}
            onClose={() => setSessionSummary(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
