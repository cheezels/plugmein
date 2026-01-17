import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MetricExplanation } from '@/types/judge.types';

interface MetricCardProps {
  explanation: MetricExplanation;
  delay?: number;
  isWorkInProgress?: boolean;
}

export function MetricCard({ explanation, delay = 0, isWorkInProgress = false }: MetricCardProps) {
  const { label, score, description, trend, insights } = explanation;
  
  // Check if this is question quality and if it's still being processed
  const isQuestionQuality = explanation.metric === 'questionQuality';
  const isProcessing = isQuestionQuality && score === 0;
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = () => {
    if (isProcessing) return 'text-muted-foreground';
    if (score >= 75) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
      className="glass-panel-hover p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-display font-semibold text-foreground tracking-tight">{label}</h3>
            {isProcessing && (
              <span className="text-xs px-2.5 py-0.5 bg-blue-500/20 text-blue-300 rounded-full animate-pulse font-medium border border-blue-500/30">
                Processing...
              </span>
            )}
            {!isProcessing && getTrendIcon()}
          </div>
          <p className="text-xs text-muted-foreground/90 leading-relaxed">{description}</p>
        </div>
        <motion.div
          key={score}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={`text-4xl font-display font-bold ${getScoreColor()}`}
        >
          {isProcessing ? (
            <div className="flex items-center gap-1">
              <span className="animate-pulse">...</span>
            </div>
          ) : (
            score
          )}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1], delay: delay + 0.1 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: score >= 75 
              ? 'var(--gradient-success)' 
              : score >= 50 
                ? 'var(--gradient-warning)' 
                : 'var(--gradient-danger)',
            boxShadow: score >= 75 
              ? '0 0 12px hsl(158 64% 52% / 0.5)'
              : score >= 50
                ? '0 0 12px hsl(43 96% 56% / 0.5)'
                : '0 0 12px hsl(0 84% 60% / 0.5)',
          }}
        />
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.3 + index * 0.1, ease: [0.4, 0, 0.2, 1] }}
            className="flex items-center gap-2.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shadow-sm shadow-primary/50" />
            <span className="text-xs text-muted-foreground/90 leading-relaxed">{insight}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
