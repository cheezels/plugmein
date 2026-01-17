import { useState, useEffect, useRef } from 'react';
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
import { io } from 'socket.io-client';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [score, setScore] = useState<number | null>(null);
  const [sessionId] = useState(() => {
    // Generate a random 6-character alphanumeric session ID (e.g., "A2K9X7")
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  });
  const { cameraState, videoRef, startCamera, stopCamera } = useCamera();
  const socketRef = useRef(null);

  // Initialize WebSocket connection to backend
  useEffect(() => {
    // Get backend URL (works for both localhost and network IP)
    const backendUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:8081' 
      : `http://${window.location.hostname}:8081`;
    
    const newSocket = io(backendUrl);
    socketRef.current = newSocket;
    
    newSocket.on('connect', () => {
      console.log('✅ Connected to backend WebSocket');
      newSocket.emit('join_session', { 
        sessionId: sessionId, 
        deviceType: 'presenter' 
      });
    });
    
    // Listen for remote toggle commands from mobile controller
    newSocket.on('toggle_recording_command', () => {
      console.log('📱 Remote toggle command received from mobile controller');
      // Toggle recording state (which will trigger handleToggleRecording via the button)
      setIsRecording(prev => !prev);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [sessionId]);
  
  // When isRecording state changes, execute the recording logic
  useEffect(() => {
    const executeRecordingLogic = async () => {
      // Broadcast recording state to all connected devices (especially mobile controller)
      if (socketRef.current) {
        socketRef.current.emit('recording_state_update', {
          sessionId: sessionId,
          isRecording: isRecording
        });
      }
      
      if (isRecording) {
        // Starting recording
        console.log('▶️ Starting recording...');
        
        // Clear previous data
        setTranscript('');
        setSessionSummary(null);
        setScore(null);
        setFeedback('');
        
        // Start transcription
        try {
          await transcribingService.startRecording((text, chunkIndex) => {
            console.log(`📄 Transcription chunk ${chunkIndex}: ${text}`);
          });
          console.log('✅ Transcription started successfully');
        } catch (error) {
          console.error('⚠️ Failed to start transcription:', error);
        }
      } else {
        // Stopping recording
        console.log('⏹️ Stopping recording...');
        
        // Generate summary
        const summary = metricsService.generateSessionSummary();
        if (summary) {
          console.log('📝 Session summary generated:', summary);
          setSessionSummary(summary);
        }
        
        // Stop transcription
        try {
          const result = await transcribingService.stopRecording();
          setTranscript(result.transcript);
          setFeedback(result.feedback);
          setScore(result.score);
        } catch (error) {
          setTranscript('');
          setFeedback('');
          setScore(null);
          console.error('⚠️ Failed to stop transcription:', error);
        }
      }
    };
    
    executeRecordingLogic();
  }, [isRecording]);
  
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
                    <code className="text-xs text-foreground font-mono bg-background/50 px-2 py-1 rounded cursor-pointer hover:bg-background/80" 
                          title="Click to copy"
                          onClick={() => {
                            navigator.clipboard.writeText(sessionId);
                            alert('Session ID copied to clipboard!');
                          }}>
                      {sessionId}
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
