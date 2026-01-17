import { useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { CameraFeed } from '@/components/judge/CameraFeed';
import { MetricsPanel } from '@/components/judge/MetricsPanel';
import { useCamera } from '@/hooks/useCamera';
import { useJudgeMetrics } from '@/hooks/useJudgeMetrics';
import { transcribingService } from '@/services/transcribingService';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const { cameraState, videoRef, startCamera, stopCamera } = useCamera();
  const { session } = useJudgeMetrics(isRecording);


  const handleToggleRecording = async () => {
    console.log('Toggling recording. Current state:', isRecording);
    if (isRecording) {
      // Stop recording
      const result = await transcribingService.stopRecording();
      setTranscript(result || '');
      setIsRecording(false);
    } else {
      // Start recording - clear transcript
      setTranscript('');
      await transcribingService.startRecording((text, chunkIndex) => {
        console.log(`Chunk ${chunkIndex}: ${text}`);
      });
      setIsRecording(true);
    }
  };

  const handleStopCamera = async () => {
    if (isRecording) {
      const result = await transcribingService.stopRecording();
      setTranscript(result || '');
    }
    setIsRecording(false);
    stopCamera();
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
                onStartCamera={startCamera}
                onStopCamera={handleStopCamera}
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

              {/* Transcript box - only show when there's a transcript and not recording */}
              {transcript && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.2 }}
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
    </div>
  );
};

export default Index;
