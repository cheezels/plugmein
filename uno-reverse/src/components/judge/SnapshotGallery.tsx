import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Clock, Smile, Meh } from 'lucide-react';
import { MetricSnapshot } from '@/services/metricsService';

interface SnapshotGalleryProps {
  snapshots: MetricSnapshot[];
  isOpen: boolean;
  onClose: () => void;
}

export function SnapshotGallery({ snapshots, isOpen, onClose }: SnapshotGalleryProps) {
  // Filter only snapshots with images
  const snapshotsWithImages = snapshots.filter(s => s.imageData);

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEmotionDisplay = (snapshot: MetricSnapshot) => {
    const emotion = snapshot.detection?.face?.emotion;
    if (!emotion) return { icon: <Meh className="w-5 h-5" />, label: 'Unknown', color: 'text-gray-400' };
    
    const happy = emotion[0]?.score || 0;
    const neutral = emotion[1]?.score || 0;
    
    if (happy > neutral && happy > 0.5) {
      return { 
        icon: <Smile className="w-5 h-5" />, 
        label: `Happy (${Math.round(happy * 100)}%)`,
        color: 'text-green-400' 
      };
    } else {
      return { 
        icon: <Meh className="w-5 h-5" />, 
        label: `Neutral (${Math.round(neutral * 100)}%)`,
        color: 'text-blue-400' 
      };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Gallery Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-10 z-50 flex items-center justify-center"
          >
            <div className="glass-panel w-full h-full flex flex-col max-w-7xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Camera className="w-6 h-6 text-primary" />
                  <div>
                    <h2 className="text-2xl font-display font-bold gradient-text">
                      Captured Moments
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {snapshotsWithImages.length} snapshots with emotion analysis
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Gallery Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                {snapshotsWithImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Camera className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">No snapshots captured</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Snapshots are automatically captured every 2 seconds during recording
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {snapshotsWithImages.map((snapshot, index) => {
                      const emotion = getEmotionDisplay(snapshot);
                      
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="glass-panel p-3 group hover:scale-105 transition-transform"
                        >
                          {/* Image */}
                          <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-black/50">
                            <img
                              src={snapshot.imageData}
                              alt={`Snapshot ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {/* Snapshot number badge */}
                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono">
                              #{index + 1}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="space-y-2">
                            {/* Time */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{formatTime(snapshot.timestamp)}</span>
                            </div>

                            {/* Emotion */}
                            <div className={`flex items-center gap-2 text-sm font-medium ${emotion.color}`}>
                              {emotion.icon}
                              <span>{emotion.label}</span>
                            </div>

                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="text-center">
                                <div className="text-muted-foreground">Curiosity</div>
                                <div className="font-bold text-primary">
                                  {Math.round(snapshot.metrics.curiosityIndex)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-muted-foreground">Attention</div>
                                <div className="font-bold text-blue-400">
                                  {Math.round(snapshot.metrics.attentionStability)}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-muted-foreground">Vibe</div>
                                <div className="font-bold text-purple-400">
                                  {Math.round(snapshot.metrics.vibeAlignment)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
