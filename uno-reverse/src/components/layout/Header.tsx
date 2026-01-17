import { motion } from 'framer-motion';
import { TrendingUp, Sparkles } from 'lucide-react';

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between px-6 py-5 border-b border-border/50 backdrop-blur-xl"
      style={{
        background: 'linear-gradient(to bottom, hsl(222 47% 6% / 0.8), hsl(222 47% 4% / 0.5))',
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-purple-500 rounded-2xl blur-md opacity-50" />
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            UnoReverse
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          </h1>
          <p className="text-xs text-muted-foreground font-medium tracking-wide">
            Pitch Analytics for Hackathon Teams
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full glass-panel border-0">
          <div className="status-indicator bg-success" />
          <span className="text-xs font-medium text-foreground/80">System Active</span>
        </div>
      </div>
    </motion.header>
  );
}
