import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus, Clock, Hash } from 'lucide-react';

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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Session Summary</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.startTime.toLocaleTimeString()} - {summary.endTime.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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
        </div>

        {/* Average Metrics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Average Scores</h3>
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
          className="w-full mt-6 px-4 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Close Summary
        </button>
      </motion.div>
    </motion.div>
  );
}
