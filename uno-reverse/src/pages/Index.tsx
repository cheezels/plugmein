import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { CameraFeed } from '@/components/judge/CameraFeed';
import { MetricsPanel } from '@/components/judge/MetricsPanel';
import { SessionSummaryInline } from '@/components/judge/SessionSummaryInline';
import { useCamera } from '@/hooks/useCamera';
import { useJudgeMetrics } from '@/hooks/useJudgeMetrics';
import { useHumanDetection } from '@/hooks/useHumanDetection';
import { metricsService } from '@/services/metricsService';
import { transcribingService } from '@/services/transcribingService';
import { io } from 'socket.io-client';

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [sessionSnapshots, setSessionSnapshots] = useState<any[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [taggedTranscript, setTaggedTranscript] = useState<string>('');
  const [segments, setSegments] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [presentationScore, setPresentationScore] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [questionQuality, setQuestionQuality] = useState<number>(0);
  const [questionInsights, setQuestionInsights] = useState<string>('');
  const { cameraState, videoRef, startCamera, stopCamera } = useCamera();
  const [sessionId] = useState(() => {
    // Generate a random 6-character alphanumeric session ID (e.g., "A2K9X7")
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  });
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
        console.log('▶️ Starting recording...');
        
        // Clear previous data
        setTranscript('');
        setTaggedTranscript('');
        setSegments([]);
        setSessionSummary(null);
        setSessionSnapshots([]);
        setPresentationScore(null);
        setQuestionCount(0);
        setQuestionQuality(0);
        setQuestionInsights('');
        setFeedback('');
        setIsProcessing(false);
        
        // Start face detection immediately
        setIsRecording(true);
        console.log('✅ Recording state set to true - face detection should start');
        
        // Start transcription in parallel
        transcribingService.startRecording((text, chunkIndex) => {
          console.log(`📄 Transcription chunk ${chunkIndex}: ${text}`);
        })
          .then(() => {
            console.log('✅ Transcription started successfully');
          })
          .catch((error) => {
            console.error('⚠️ Failed to start transcription (face detection will continue):', error);
          });
      } else {
        console.log('⏹️ Stopping recording...');
        
        // Show loading state immediately
        setIsProcessing(true);
        
        // Stop face detection
        setIsRecording(false);
        
        // Generate session summary from face metrics
        const faceSummary = metricsService.generateSessionSummary();
        console.log('📝 Face metrics summary generated:', faceSummary);
        
        // Prepare face metrics for backend presentation score calculation
        const faceMetricsForScore = faceSummary ? {
          avgCuriosity: faceSummary.averageMetrics.curiosityIndex,
          avgAttention: faceSummary.averageMetrics.attentionStability,
          avgVibe: faceSummary.averageMetrics.vibeAlignment,
          trend: faceSummary.metricTrends.curiosityIndex.trend  // Use curiosity trend as representative
        } : {};
        
        // Wait for transcription analysis (this includes AI processing)
        console.log('⏳ Waiting for transcription and AI analysis...');
        const result = await transcribingService.stopRecording(faceMetricsForScore);
        
        if (result) {
          console.log('✅ All AI analysis complete:', result);
          
          // Store all the results
          setTranscript(result.transcript);
          setTaggedTranscript(result.taggedTranscript || result.transcript);
          setSegments(result.segments || []);
          setFeedback(result.feedback);
          setPresentationScore(result.presentationScore);
          setQuestionCount(result.questionCount);
          setQuestionInsights(result.questionInsights);
          
          // Update question quality last to trigger the useEffect
          setQuestionQuality(result.questionQuality);
          
          // Use presentation score as the final score
          // Backend already calculated this from all metrics:
          // - Face metrics (40%): curiosity, attention, vibe
          // - Question quality (30%): AI-analyzed question depth
          // - Transcript quality (20%): length and completeness
          // - Trend (10%): improving/stable/declining
          let finalScore = result.presentationScore;
          
          console.log('🎯 Final comprehensive score:', finalScore);
          console.log('  (calculated from backend using all collected metrics)');
          
          // Update the displayed metrics immediately with question quality
          const updatedMetrics = {
            ...faceSummary.averageMetrics,
            questionQuality: result.questionQuality,
          };
          updateMetrics(updatedMetrics, null);
          
          // Get session snapshots for the chart
          const snapshots = metricsService.getSessionSnapshots();
          console.log('📸 Session snapshots retrieved:', snapshots.length);
          
          // Update summary with all data including question metrics
          const comprehensiveSummary = {
            ...faceSummary,
            transcript: result.transcript,
            taggedTranscript: result.taggedTranscript || result.transcript,
            segments: result.segments || [],
            feedback: result.feedback,
            presentationScore: result.presentationScore,
            questionCount: result.questionCount,
            questionQuality: result.questionQuality,
            questionInsights: result.questionInsights,
            finalScore: finalScore,
            averageMetrics: updatedMetrics,
          };
          
          setSessionSummary(comprehensiveSummary);
          setSessionSnapshots(snapshots);
        } else {
          console.warn('⚠️ No transcription result received');
          setTranscript('');
          setFeedback('');
          setPresentationScore(null);
          
          // Still show face metrics summary if available
          if (faceSummary) {
            setSessionSummary(faceSummary);
          }
        }
        
        // Hide loading state
        setIsProcessing(false);
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

  const { session, updateMetrics } = useJudgeMetrics(isRecording, detectionResult);

  // Update question quality in metrics when it changes
  useEffect(() => {
    if (questionQuality > 0 && !isRecording) {
      const updatedMetrics = {
        ...session.metrics,
        questionQuality: questionQuality,
      };
      updateMetrics(updatedMetrics, null);
      console.log('📊 Updated metrics with question quality:', updatedMetrics);
    }
  }, [questionQuality, isRecording, session.metrics, updateMetrics]);

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

              {/* Loading state - show while processing */}
              {isProcessing && !isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="glass-panel p-10 flex flex-col items-center justify-center"
                >
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
                    <motion.div 
                      className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="absolute inset-2 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-md" />
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground mb-3 tracking-tight">Analyzing Your Pitch...</h3>
                  <div className="space-y-2 text-sm text-muted-foreground text-center">
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex items-center justify-center gap-2 font-medium"
                    >
                      <span className="text-green-400">✓</span> Processing judge reactions
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center justify-center gap-2 font-medium"
                    >
                      <span className="text-green-400">✓</span> Transcribing pitch audio
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center justify-center gap-2 animate-pulse font-medium"
                    >
                      <span className="text-primary">⏳</span> Analyzing judge engagement
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center justify-center gap-2 animate-pulse font-medium"
                    >
                      <span className="text-primary">⏳</span> Generating improvement insights
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center justify-center gap-2 animate-pulse font-medium"
                    >
                      <span className="text-primary">⏳</span> Calculating pitch effectiveness
                    </motion.p>
                  </div>
                </motion.div>
              )}

              {/* Score display - only show when there's a score and not recording/processing */}
              
              {/* Session Summary - Inline after recording ends */}
              {sessionSummary && !isRecording && !isProcessing && (
                <SessionSummaryInline 
                  summary={sessionSummary} 
                  snapshots={sessionSnapshots}
                />
              )}
            </motion.div>

            {/* Metrics Panel - hide when showing summary */}
            {(!sessionSummary || isRecording) && (
              <MetricsPanel session={session} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
