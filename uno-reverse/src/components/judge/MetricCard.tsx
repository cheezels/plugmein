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
  
  // Check if this is question quality (work in progress)
  const isWIP = isWorkInProgress || explanation.metric === 'questionQuality';
  
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
    if (score >= 75) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`glass-panel-hover p-5 ${isWIP ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground">{label}</h3>
            {isWIP && (
              <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                WIP
              </span>
            )}
            {!isWIP && getTrendIcon()}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <motion.div
          key={score}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-3xl font-semibold ${getScoreColor()}`}
        >
          {score}
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: score >= 75 
              ? 'var(--gradient-success)' 
              : score >= 50 
                ? 'var(--gradient-warning)' 
                : 'var(--gradient-danger)',
          }}
        />
      </div>

      {/* Insights */}
      <div className="space-y-1">
        {insights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + 0.2 + index * 0.1 }}
            className="flex items-center gap-2"
          >
            <div className="w-1 h-1 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">{insight}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
