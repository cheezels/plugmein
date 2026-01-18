import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Clock, Smile, Meh, Sparkles, Loader2, Download } from 'lucide-react';
import { MetricSnapshot } from '@/services/metricsService';
import { animeService } from '@/services/animeService';

interface SnapshotGalleryProps {
  snapshots: MetricSnapshot[];
  isOpen: boolean;
  onClose: () => void;
}

export function SnapshotGallery({ snapshots, isOpen, onClose }: SnapshotGalleryProps) {
  const [isAnimefying, setIsAnimefying] = useState(false);
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [animeError, setAnimeError] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MetricSnapshot | null>(null);

  // Filter only snapshots with images
  const snapshotsWithImages = snapshots.filter(s => s.imageData);

  const handleAnimefyRandom = async () => {
    if (snapshotsWithImages.length === 0) return;

    const randomIndex = Math.floor(Math.random() * snapshotsWithImages.length);
    const snapshot = snapshotsWithImages[randomIndex];
    if (!snapshot.imageData) return;

    setSelectedSnapshot(snapshot);
    setIsAnimefying(true);
    setAnimeError(null);
    setAnimeImage(null);

    const result = await animeService.animefyImage(snapshot.imageData);

    if (result.success && result.animeImage) {
      setAnimeImage(result.animeImage);
    } else {
      setAnimeError(result.error || 'Failed to generate anime image');
    }

    setIsAnimefying(false);
  };

  const handleCloseAnimeModal = () => {
    setSelectedSnapshot(null);
    setAnimeImage(null);
    setAnimeError(null);
  };

  const handleDownload = (imageData: string, isAnime = false) => {
    const link = document.createElement('a');
    link.href = imageData;
    const prefix = isAnime ? 'anime-' : '';
    link.download = `${prefix}snapshot-${Date.now()}.jpg`;
    link.click();
  };

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

              {/* Anime-fy Button Footer */}
              {snapshotsWithImages.length > 0 && (
                <div className="p-4 border-t border-white/10 flex justify-center">
                  <button
                    onClick={handleAnimefyRandom}
                    disabled={isAnimefying}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isAnimefying ? 'Transforming...' : 'Anime-fy Random Photo'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Anime Result Modal */}
          <AnimatePresence>
            {selectedSnapshot && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                onClick={handleCloseAnimeModal}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative max-w-3xl w-full bg-background rounded-2xl overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      <h3 className="font-display font-bold">Anime Transformation</h3>
                    </div>
                    <button
                      onClick={handleCloseAnimeModal}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {isAnimefying ? (
                      <div className="aspect-video bg-black/40 rounded-xl flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                          <img
                            src={selectedSnapshot.imageData}
                            alt="Processing"
                            className="w-48 h-auto rounded-lg opacity-50"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-12 h-12 animate-spin text-purple-400" />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-medium text-purple-300">Transforming to anime...</p>
                          <p className="text-sm text-muted-foreground mt-1">This may take a few seconds</p>
                        </div>
                      </div>
                    ) : animeError ? (
                      <div className="aspect-video bg-red-500/10 rounded-xl flex flex-col items-center justify-center gap-4 p-6">
                        <div className="text-red-400 text-center">
                          <p className="text-lg font-medium mb-2">Transformation Failed</p>
                          <p className="text-sm">{animeError}</p>
                        </div>
                        <button
                          onClick={handleAnimefyRandom}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    ) : animeImage ? (
                      <div className="space-y-4">
                        {/* Side by side comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <img
                              src={selectedSnapshot.imageData}
                              alt="Original"
                              className="w-full aspect-video object-cover rounded-xl"
                            />
                            <span className="absolute bottom-2 left-2 text-xs bg-black/70 px-2 py-1 rounded">
                              Original
                            </span>
                          </div>
                          <div className="relative">
                            <img
                              src={animeImage}
                              alt="Anime version"
                              className="w-full aspect-video object-cover rounded-xl"
                            />
                            <span className="absolute bottom-2 left-2 text-xs bg-purple-600/90 px-2 py-1 rounded">
                              Anime
                            </span>
                          </div>
                        </div>

                        {/* Download buttons */}
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => handleDownload(selectedSnapshot.imageData!)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Save Original
                          </button>
                          <button
                            onClick={() => handleDownload(animeImage, true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Save Anime
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
