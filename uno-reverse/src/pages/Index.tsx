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
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [presentationScore, setPresentationScore] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [questionQuality, setQuestionQuality] = useState<number>(0);
  const [questionInsights, setQuestionInsights] = useState<string>('');
  const { cameraState, videoRef, startCamera, stopCamera } = useCamera();

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
    console.log('🎙️ Toggling recording. Current state:', isRecording);
    try {
      if (isRecording) {
        console.log('⏹️ Stopping recording...');
        
        // Show loading state immediately
        setIsProcessing(true);
        
        // Stop face detection
        setIsRecording(false);
        
        // Generate session summary from face metrics
        const faceSummary = metricsService.generateSessionSummary();
        console.log('📝 Face metrics summary generated:', faceSummary);
        
        // Wait for transcription analysis (this includes AI processing)
        console.log('⏳ Waiting for transcription and AI analysis...');
        const result = await transcribingService.stopRecording();
        
        if (result) {
          console.log('✅ All AI analysis complete:', result);
          
          // Store all the results
          setTranscript(result.transcript);
          setFeedback(result.feedback);
          setPresentationScore(result.presentationScore);
          setQuestionCount(result.questionCount);
          setQuestionInsights(result.questionInsights);
          
          // Update question quality last to trigger the useEffect
          setQuestionQuality(result.questionQuality);
          
          // Calculate final comprehensive score
          // Combine all metrics with proper weighting
          let finalScore = 0;
          if (faceSummary) {
            // Use face metrics with question quality included
            const metricsWithQuestion = {
              ...faceSummary.averageMetrics,
              questionQuality: result.questionQuality,
            };
            // Get optimized score from face detection metrics
            const faceScore = metricsService.calculateOverallScore(metricsWithQuestion);
            
            // Add presentation quality bonus
            const presentationBonus = Math.round(result.presentationScore * 0.20);
            
            // Calculate final score
            finalScore = Math.min(100, faceScore + presentationBonus);
          } else {
            // Fallback to presentation score only
            finalScore = Math.min(100, result.presentationScore + 10);
          }
          
          console.log('🎯 Final comprehensive score:', finalScore);
          
          // Update the displayed metrics immediately with question quality
          const updatedMetrics = {
            ...faceSummary.averageMetrics,
            questionQuality: result.questionQuality,
          };
          updateMetrics(updatedMetrics, null);
          
          // Update summary with all data including question metrics
          const comprehensiveSummary = {
            ...faceSummary,
            transcript: result.transcript,
            feedback: result.feedback,
            presentationScore: result.presentationScore,
            questionCount: result.questionCount,
            questionQuality: result.questionQuality,
            questionInsights: result.questionInsights,
            finalScore: finalScore,
            averageMetrics: updatedMetrics,
          };
          
          setSessionSummary(comprehensiveSummary);
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
      } else {
        console.log('▶️ Starting recording...');
        
        // Clear previous data
        setTranscript('');
        setSessionSummary(null);
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
      }
    } catch (error) {
      console.error('❌ Error toggling recording:', error);
      setIsProcessing(false);
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
              

              {/* Feedback box - only show when there's feedback and not recording/processing */}
              {feedback && !isRecording && !isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.4 }}
                  className="glass-panel p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-foreground">Pitch Feedback</span>
                    <span className="text-xs text-muted-foreground">
                      Based on Judge Reactions
                    </span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {feedback}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Transcript box - only show when there's a transcript and not recording/processing */}
              {transcript && !isRecording && !isProcessing && (
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
