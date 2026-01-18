import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Hash, Award, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MetricsChart } from './MetricsChart';
import { TranscriptTimeline } from './TranscriptTimeline';
import { SnapshotGallery } from './SnapshotGallery';
import { MetricSnapshot } from '@/services/metricsService';

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
  feedback?: string;
  transcript?: string;
  taggedTranscript?: string;
  segments?: any[];
}

interface SessionSummaryInlineProps {
  summary: SessionSummary;
  snapshots: MetricSnapshot[];
}

export function SessionSummaryInline({ summary, snapshots }: SessionSummaryInlineProps) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-6"
    >
      {/* Header with Final Score */}
      <div className="glass-panel p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-display font-bold text-foreground tracking-tight mb-2">
              Session Complete 🎉
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {summary.startTime.toLocaleTimeString()} - {summary.endTime.toLocaleTimeString()}
            </p>
          </div>
          {summary.finalScore !== undefined && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl blur-xl opacity-40" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
                  <Award className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                  Final Score
                </div>
                <div className="text-5xl font-display font-bold gradient-text">
                  {summary.finalScore}
                  <span className="text-2xl text-muted-foreground font-sans">/100</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Session Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold">Duration</span>
            </div>
            <p className="text-2xl font-display font-bold">{formatDuration(summary.duration)}</p>
          </div>
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] hover:bg-white/[0.08] hover:border-primary/50 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2 group-hover:text-primary transition-colors">
              <Hash className="w-4 h-4" />
              <span className="text-xs font-semibold">Snapshots</span>
            </div>
            <p className="text-2xl font-display font-bold">{summary.totalSnapshots}</p>
            <p className="text-xs text-muted-foreground mt-1 group-hover:text-primary/70 transition-colors">
              Click to view gallery
            </p>
          </button>
          {summary.presentationScore !== undefined && (
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Award className="w-4 h-4" />
                <span className="text-xs font-semibold">Pitch Score</span>
              </div>
              <p className="text-2xl font-display font-bold">{summary.presentationScore}</p>
            </div>
          )}
          {summary.questionCount !== undefined && (
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-semibold">Questions</span>
              </div>
              <p className="text-2xl font-display font-bold">{summary.questionCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Chart */}
      {snapshots.length > 0 && (
        <MetricsChart snapshots={snapshots} />
      )}

      {/* Judge Engagement */}
      {summary.questionQuality !== undefined && summary.questionQuality > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-6"
        >
          <h3 className="text-lg font-display font-bold mb-4">Judge Engagement</h3>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Engagement Level</span>
            <span className={`text-3xl font-display font-bold ${getScoreColor(summary.questionQuality)}`}>
              {summary.questionQuality}
            </span>
          </div>
          {summary.questionInsights && (
            <p className="text-sm text-muted-foreground italic">{summary.questionInsights}</p>
          )}
        </motion.div>
      )}

      {/* Average Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-6"
      >
        <h3 className="text-lg font-display font-bold mb-4">Face Detection Metrics</h3>
        <div className="space-y-4">
          {/* Curiosity Index */}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Curiosity Index</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(summary.metricTrends.curiosityIndex.trend)}
                <span className={`text-2xl font-display font-bold ${getScoreColor(summary.averageMetrics.curiosityIndex)}`}>
                  {summary.averageMetrics.curiosityIndex}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Range: {summary.metricTrends.curiosityIndex.min} - {summary.metricTrends.curiosityIndex.max}
            </div>
          </div>

          {/* Attention Stability */}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Attention Stability</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(summary.metricTrends.attentionStability.trend)}
                <span className={`text-2xl font-display font-bold ${getScoreColor(summary.averageMetrics.attentionStability)}`}>
                  {summary.averageMetrics.attentionStability}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Range: {summary.metricTrends.attentionStability.min} - {summary.metricTrends.attentionStability.max}
            </div>
          </div>

          {/* Vibe Alignment */}
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Vibe Alignment</span>
              <div className="flex items-center gap-2">
                {getTrendIcon(summary.metricTrends.vibeAlignment.trend)}
                <span className={`text-2xl font-display font-bold ${getScoreColor(summary.averageMetrics.vibeAlignment)}`}>
                  {summary.averageMetrics.vibeAlignment}
                </span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Range: {summary.metricTrends.vibeAlignment.min} - {summary.metricTrends.vibeAlignment.max}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Conversation Timeline with Speaker Tags */}
      {summary.transcript && (
        <TranscriptTimeline 
          transcript={summary.transcript}
          taggedTranscript={summary.taggedTranscript}
          segments={summary.segments}
        />
      )}

      {/* Pitch Feedback */}
      {summary.feedback && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6"
        >
          <h3 className="text-lg font-display font-bold mb-4">How to Improve Your Pitch</h3>
          <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] max-h-96 overflow-y-auto custom-scrollbar">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {summary.feedback}
            </p>
          </div>
        </motion.div>
      )}

      {/* Key Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-panel p-6"
      >
        <h3 className="text-lg font-display font-bold mb-4">Key Insights</h3>
        <div className="space-y-3">
          {summary.keyInsights.map((insight, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08] text-sm"
            >
              {insight}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Snapshot Gallery Modal */}
      <SnapshotGallery 
        snapshots={snapshots}
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
      />
    </motion.div>
  );
}
