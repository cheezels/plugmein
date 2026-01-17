import { motion } from 'framer-motion';

interface OverallScoreProps {
  score: number;
  isRecording: boolean;
}

export function OverallScore({ score, isRecording }: OverallScoreProps) {
  const getGrade = () => {
    if (score >= 90) return { letter: 'A+', label: 'Exceptional' };
    if (score >= 80) return { letter: 'A', label: 'Excellent' };
    if (score >= 70) return { letter: 'B', label: 'Good' };
    if (score >= 60) return { letter: 'C', label: 'Fair' };
    return { letter: 'D', label: 'Needs Improvement' };
  };

  const grade = getGrade();
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel p-6 flex flex-col items-center"
    >
      <div className="relative w-32 h-32 mb-4">
        {/* Background ring */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="54"
            stroke="hsl(var(--secondary))"
            strokeWidth="8"
            fill="none"
          />
          {/* Animated progress ring */}
          <motion.circle
            cx="64"
            cy="64"
            r="54"
            stroke="url(#scoreGradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(260 100% 65%)" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={score}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-bold gradient-text"
          >
            {score}
          </motion.span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <motion.div
          key={grade.letter}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-2xl font-semibold text-foreground mb-1"
        >
          {grade.letter}
        </motion.div>
        <p className="text-sm text-muted-foreground">{grade.label}</p>
      </div>

      {/* Recording indicator */}
      <div className="flex items-center gap-2 mt-4">
        <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-destructive animate-pulse' : 'bg-muted'}`} />
        <span className="text-xs text-muted-foreground">
          {isRecording ? 'Analyzing...' : 'Standby'}
        </span>
      </div>
    </motion.div>
  );
}
