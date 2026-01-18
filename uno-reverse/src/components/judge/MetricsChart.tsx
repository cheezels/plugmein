import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { MetricSnapshot } from '@/services/metricsService';

interface MetricsChartProps {
  snapshots: MetricSnapshot[];
}

export function MetricsChart({ snapshots }: MetricsChartProps) {
  // Transform data for Recharts
  const chartData = snapshots.map((snapshot, index) => {
    const elapsedSeconds = index * 2; // Assuming 2-second intervals
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return {
      time: timeLabel,
      timeValue: elapsedSeconds,
      Curiosity: snapshot.metrics.curiosityIndex,
      Attention: snapshot.metrics.attentionStability,
      Vibe: snapshot.metrics.vibeAlignment,
      Questions: snapshot.metrics.questionQuality || 0,
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-muted-foreground text-sm">No metrics data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="glass-panel p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Metrics Over Time</h3>
          <p className="text-xs text-muted-foreground">Judge reaction trends during your pitch</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorCuriosity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(158 64% 52%)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(158 64% 52%)" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="colorVibe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(270 91% 65%)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="hsl(270 91% 65%)" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(217 20% 18%)" 
            strokeOpacity={0.3}
          />
          
          <XAxis 
            dataKey="time" 
            stroke="hsl(217 10% 65%)"
            style={{ fontSize: '12px', fontFamily: 'Inter' }}
            tick={{ fill: 'hsl(217 10% 65%)' }}
          />
          
          <YAxis 
            stroke="hsl(217 10% 65%)"
            style={{ fontSize: '12px', fontFamily: 'Inter' }}
            tick={{ fill: 'hsl(217 10% 65%)' }}
            domain={[0, 100]}
          />
          
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(222 47% 6%)',
              border: '1px solid hsl(217 20% 18%)',
              borderRadius: '12px',
              padding: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            labelStyle={{
              color: 'hsl(210 40% 98%)',
              fontWeight: 600,
              marginBottom: '8px',
              fontFamily: 'Sora',
            }}
            itemStyle={{
              color: 'hsl(217 10% 65%)',
              fontSize: '12px',
              padding: '4px 0',
            }}
          />
          
          <Legend 
            wrapperStyle={{
              paddingTop: '20px',
              fontFamily: 'Inter',
              fontSize: '13px',
            }}
            iconType="line"
          />
          
          <Line 
            type="monotone" 
            dataKey="Curiosity" 
            stroke="hsl(217 91% 60%)" 
            strokeWidth={3}
            dot={{ fill: 'hsl(217 91% 60%)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: 'hsl(217 91% 60%)', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
          
          <Line 
            type="monotone" 
            dataKey="Attention" 
            stroke="hsl(158 64% 52%)" 
            strokeWidth={3}
            dot={{ fill: 'hsl(158 64% 52%)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: 'hsl(158 64% 52%)', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
          
          <Line 
            type="monotone" 
            dataKey="Vibe" 
            stroke="hsl(270 91% 65%)" 
            strokeWidth={3}
            dot={{ fill: 'hsl(270 91% 65%)', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: 'hsl(270 91% 65%)', stroke: '#fff', strokeWidth: 2 }}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/50">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Avg Curiosity</div>
          <div className="text-2xl font-display font-bold text-primary">
            {Math.round(chartData.reduce((sum, d) => sum + d.Curiosity, 0) / chartData.length)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Avg Attention</div>
          <div className="text-2xl font-display font-bold text-success">
            {Math.round(chartData.reduce((sum, d) => sum + d.Attention, 0) / chartData.length)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Avg Vibe</div>
          <div className="text-2xl font-display font-bold" style={{ color: 'hsl(270 91% 65%)' }}>
            {Math.round(chartData.reduce((sum, d) => sum + d.Vibe, 0) / chartData.length)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
