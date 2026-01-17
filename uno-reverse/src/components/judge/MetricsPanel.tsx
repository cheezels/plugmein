import { motion } from 'framer-motion';
import { JudgeSession } from '@/types/judge.types';
import { MetricCard } from './MetricCard';
import { OverallScore } from './OverallScore';

interface MetricsPanelProps {
  session: JudgeSession;
}

export function MetricsPanel({ session }: MetricsPanelProps) {
  const { explanations, overallScore, isRecording } = session;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Judge Analysis</h2>
          <p className="text-sm text-muted-foreground">Real-time behavioral metrics</p>
        </div>
      </div>

      {/* Overall Score */}
      <OverallScore score={overallScore} isRecording={isRecording} />

      {/* Metrics Grid */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {explanations.length > 0 ? (
          explanations.map((explanation, index) => (
            <MetricCard
              key={explanation.metric}
              explanation={explanation}
              delay={index * 0.1}
            />
          ))
        ) : (
          <div className="glass-panel p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Start recording to analyze judge behavior
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
