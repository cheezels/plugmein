import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus, Clock, Hash, MessageSquare, Award } from 'lucide-react';

interface SessionSummary {
  startTime: Date;
  endTime: Date;
  duration: number;
  totalSnapshots: number;
  averageMetrics: {
    curiosityIndex: number;
    attentionStability: number;
    questionQuality: number;
    vibeAlignment: number;
  };
  metricTrends: {
    curiosityIndex: { min: number; max: number; trend: string };
    attentionStability: { min: number; max: number; trend: string };
    vibeAlignment: { min: number; max: number; trend: string };
  };
  keyInsights: string[];
  finalScore?: number;
  presentationScore?: number;
  questionCount?: number;
  questionQuality?: number;
  questionInsights?: string;
  comedyVerdict?: string;
  comedyPainRating?: number;
  comedyAnalysis?: string;
  feedback?: string;
  transcript?: string;
}

interface SessionSummaryProps {
  summary: SessionSummary;
  onClose: () => void;
}

export function SessionSummary({ summary, onClose }: SessionSummaryProps) {
  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-yellow-500" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
        style={{
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1">
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight">Session Summary</h2>
            <p className="text-sm text-muted-foreground mt-2 font-medium">
              {summary.startTime.toLocaleTimeString()} - {summary.endTime.toLocaleTimeString()}
            </p>
          </div>
          {summary.finalScore !== undefined && (
            <div className="flex items-center gap-4 mr-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl blur-xl opacity-40" />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
                  <Award className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Final Score</div>
                <div className="text-4xl font-display font-bold gradient-text">{summary.finalScore}<span className="text-xl text-muted-foreground font-sans">/100</span></div>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-110"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Duration</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(summary.duration)}</p>
          </div>
          <div className="glass-panel p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Hash className="w-4 h-4" />
              <span className="text-sm">Snapshots</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalSnapshots}</p>
          </div>
          {summary.presentationScore !== undefined && (
            <div className="glass-panel p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Award className="w-4 h-4" />
                <span className="text-sm">Pitch Score</span>
              </div>
              <p className="text-2xl font-bold">{summary.presentationScore}</p>
            </div>
          )}
          {summary.questionCount !== undefined && (
            <div className="glass-panel p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm">Questions</span>
              </div>
              <p className="text-2xl font-bold">{summary.questionCount}</p>
            </div>
          )}
        </div>

        {/* Judge Engagement Analysis - Show first if available */}
        {summary.questionQuality !== undefined && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Judge Engagement</h3>
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Engagement Level</span>
                <span className={`text-3xl font-bold ${getScoreColor(summary.questionQuality)}`}>
                  {summary.questionQuality}
                </span>
              </div>
              {summary.questionInsights && (
                <p className="text-sm text-muted-foreground italic">{summary.questionInsights}</p>
              )}
            </div>
          </div>
        )}

        {/* Comedy Analysis - Inconvenience Corp */}
        {summary.comedyVerdict && summary.comedyAnalysis && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl">🎭</span>
              </div>
              <h3 className="text-lg font-semibold">
                Inconvenience Corp™ Review
              </h3>
            </div>
            
            <div className="space-y-3">
              {/* Verdict Banner */}
              <div className="glass-panel p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30">
                <div className="text-xs text-purple-400 uppercase tracking-wider font-semibold mb-1">
                  Verdict
                </div>
                <div className="text-2xl font-bold text-purple-300">
                  {summary.comedyVerdict}
                </div>
              </div>

              {/* Pain Rating */}
              <div className="glass-panel p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Pain Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-orange-400">
                      {summary.comedyPainRating}
                    </span>
                    <span className="text-xl text-muted-foreground">/10 Oofs</span>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        i < (summary.comedyPainRating || 0)
                          ? 'bg-gradient-to-r from-orange-400 to-red-500'
                          : 'bg-white/[0.05]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Snarky Analysis */}
              <div className="glass-panel p-4">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                  Analysis
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed italic">
                  "{summary.comedyAnalysis}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Average Metrics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Face Detection Metrics</h3>
          <div className="space-y-3">
            {/* Curiosity Index */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Curiosity Index</span>
                <div className="flex items-center gap-2">
                  {getTrendIcon(summary.metricTrends.curiosityIndex.trend)}
                  <span className={`text-2xl font-bold ${getScoreColor(summary.averageMetrics.curiosityIndex)}`}>
                    {summary.averageMetrics.curiosityIndex}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Range: {summary.metricTrends.curiosityIndex.min} - {summary.metricTrends.curiosityIndex.max}
              </div>
            </div>

            {/* Attention Stability */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Attention Stability</span>
                <div className="flex items-center gap-2">
                  {getTrendIcon(summary.metricTrends.attentionStability.trend)}
                  <span className={`text-2xl font-bold ${getScoreColor(summary.averageMetrics.attentionStability)}`}>
                    {summary.averageMetrics.attentionStability}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Range: {summary.metricTrends.attentionStability.min} - {summary.metricTrends.attentionStability.max}
              </div>
            </div>

            {/* Vibe Alignment */}
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Vibe Alignment</span>
                <div className="flex items-center gap-2">
                  {getTrendIcon(summary.metricTrends.vibeAlignment.trend)}
                  <span className={`text-2xl font-bold ${getScoreColor(summary.averageMetrics.vibeAlignment)}`}>
                    {summary.averageMetrics.vibeAlignment}
                  </span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Range: {summary.metricTrends.vibeAlignment.min} - {summary.metricTrends.vibeAlignment.max}
              </div>
            </div>
          </div>
        </div>

        {/* Pitch Improvement Feedback */}
        {summary.feedback && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">How to Improve Your Pitch</h3>
            <div className="glass-panel p-4 max-h-64 overflow-y-auto">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {summary.feedback}
              </p>
            </div>
          </div>
        )}

        {/* Key Insights */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Key Insights</h3>
          <div className="space-y-2">
            {summary.keyInsights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel p-3 text-sm"
              >
                {insight}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-8 btn-primary py-4 text-base font-display"
        >
          Close Summary
        </button>
      </motion.div>
    </motion.div>
  );
}
