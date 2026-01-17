import { motion } from 'framer-motion';
import { Eye, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-6 py-4 border-b border-border/50"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            JudgeJudge
            <Sparkles className="w-4 h-4 text-primary" />
          </h1>
          <p className="text-xs text-muted-foreground">Analyzing the analyzers</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">System Active</span>
        </div>
      </div>
    </motion.header>
  );
}
