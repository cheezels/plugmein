import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Sparkles, Loader2 } from 'lucide-react';
import { animeService } from '@/services/animeService';

interface MetricSnapshot {
  timestamp: Date;
  metrics: {
    curiosityIndex: number;
    attentionStability: number;
    questionQuality: number;
    vibeAlignment: number;
  };
  detection: any;
  screenshot?: string;
}

interface ScreenshotsGalleryProps {
  snapshots: MetricSnapshot[];
}

export function ScreenshotsGallery({ snapshots }: ScreenshotsGalleryProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<MetricSnapshot | null>(null);
  const [isAnimefying, setIsAnimefying] = useState(false);
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [animeError, setAnimeError] = useState<string | null>(null);

  // Filter snapshots that have screenshots
  const screenshotSnapshots = snapshots.filter((s) => s.screenshot);

  if (screenshotSnapshots.length === 0) {
    return (
      <div className="glass-panel p-6">
        <h3 className="text-lg font-display font-bold mb-4">Session Screenshots</h3>
        <p className="text-sm text-muted-foreground">No screenshots were captured during this session.</p>
      </div>
    );
  }

  const handleDownload = (imageData: string, timestamp: Date, isAnime = false) => {
    const link = document.createElement('a');
    link.href = imageData;
    const prefix = isAnime ? 'anime-' : '';
    link.download = `${prefix}screenshot-${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`;
    link.click();
  };

  const handleAnimefyRandom = async () => {
    // Pick a random screenshot
    const randomIndex = Math.floor(Math.random() * screenshotSnapshots.length);
    const snapshot = screenshotSnapshots[randomIndex];
    if (!snapshot.screenshot) return;

    // Open popup and start anime-fy
    setSelectedSnapshot(snapshot);
    setIsAnimefying(true);
    setAnimeError(null);
    setAnimeImage(null);

    const result = await animeService.animefyImage(snapshot.screenshot);

    if (result.success && result.animeImage) {
      setAnimeImage(result.animeImage);
    } else {
      setAnimeError(result.error || 'Failed to generate anime image');
    }

    setIsAnimefying(false);
  };

  const handleCloseModal = () => {
    setSelectedSnapshot(null);
    setAnimeImage(null);
    setAnimeError(null);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold">Session Screenshots</h3>
          <span className="text-xs text-muted-foreground">{screenshotSnapshots.length} captures</span>
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {screenshotSnapshots.map((snapshot, index) => (
            <div
              key={index}
              className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent bg-black/20"
            >
              <img
                src={snapshot.screenshot}
                alt={`Screenshot ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {/* Metric indicator dot */}
              <div
                className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${
                  snapshot.metrics.attentionStability >= 70
                    ? 'bg-green-500'
                    : snapshot.metrics.attentionStability >= 40
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Anime-fy Random Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleAnimefyRandom}
            disabled={isAnimefying}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isAnimefying ? 'Transforming...' : 'Anime-fy Random Photo'}
          </button>
        </div>
      </motion.div>

      {/* Anime-fy Popup Modal */}
      <AnimatePresence>
        {selectedSnapshot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
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
                        src={selectedSnapshot.screenshot}
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
                          src={selectedSnapshot.screenshot}
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
                        onClick={() => handleDownload(selectedSnapshot.screenshot!, new Date(selectedSnapshot.timestamp))}
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Save Original
                      </button>
                      <button
                        onClick={() => handleDownload(animeImage, new Date(selectedSnapshot.timestamp), true)}
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
  );
}
