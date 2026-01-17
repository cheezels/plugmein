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
import { transcribingService } from '@/services/transcribingService';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const { cameraState, videoRef, startCamera, stopCamera } = useCamera();
  const { session } = useJudgeMetrics(isRecording);

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

  const handleToggleRecording = async () => {
    console.log('🎙️ Toggling recording. Current state:', isRecording);
    try {
      if (isRecording) {
        console.log('⏹️ Stopping recording...');
        
        // Stop face detection first (synchronous)
        setIsRecording(false);
        
        // Generate summary (synchronous)
        const summary = metricsService.generateSessionSummary();
        if (summary) {
          console.log('📝 Session summary generated:', summary);
          setSessionSummary(summary);
        }
        
        // Stop transcription (async, but don't block UI)
        transcribingService.stopRecording()
          .then((result) => {
            setTranscript(result.transcript);
            setFeedback(result.feedback);
            setScore(result.score);
          })
          .catch((error) => {
            setTranscript('');
            setFeedback('');
            setScore(null);
            console.error('⚠️ Failed to stop transcription:', error);
          });
      } else {
        console.log('▶️ Starting recording...');
        
        // Clear previous data
        setTranscript('');
        setSessionSummary(null);
        setScore(null)
        setFeedback('');
        
        // Start face detection immediately (don't wait for transcription)
        setIsRecording(true);
        console.log('✅ Recording state set to true - face detection should start');
        
        // Start transcription in parallel (don't block face detection)
        transcribingService.startRecording((text, chunkIndex) => {
          console.log(`📄 Transcription chunk ${chunkIndex}: ${text}`);
        })
          .then(() => {
            console.log('✅ Transcription started successfully');
          })
          .catch((error) => {
            console.error('⚠️ Failed to start transcription (face detection will continue):', error);
          });
      }
    } catch (error) {
      console.error('❌ Error toggling recording:', error);
      // Even if there's an error, try to toggle recording state for face detection
      setIsRecording(!isRecording);
    }
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

                <div className="flex items-center gap-3">
                  {isRecording && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-foreground">Face Detection</span>
                      </div>
                      <div className="w-px h-3 bg-border" />
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-xs text-foreground">Transcription</span>
                      </div>
                    </>
                  )}
                  {!isRecording && (
                    <span className="text-xs text-muted-foreground">Ready to analyze</span>
                  )}
                </div>
              </motion.div>

              {/* Score display - only show when there's a score and not recording */}
              {score !== null && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: 0.3 }}
                  className="glass-panel p-6 flex items-center justify-center"
                >
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Score</span>
                    <div className="text-5xl font-bold text-foreground mt-1">
                      {score}
                      <span className="text-2xl text-muted-foreground">/100</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Feedback box - only show when there's feedback and not recording */}
              {feedback && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.4 }}
                  className="glass-panel p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Feedback</span>
                    <span className="text-xs text-muted-foreground">
                      get good.
                    </span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {feedback}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Transcript box - only show when there's a transcript and not recording */}
              {transcript && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.5 }}
                  className="glass-panel p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Transcript</span>
                    <span className="text-xs text-muted-foreground">
                      {transcript.length} characters
                    </span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {transcript}
                    </p>
                  </div>
                </motion.div>
              )}
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
