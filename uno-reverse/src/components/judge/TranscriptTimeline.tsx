import { motion } from 'framer-motion';
import { User, UserCheck, Clock } from 'lucide-react';

interface TranscriptSegment {
  id?: number;
  start?: number;
  end?: number;
  text: string;
}

interface TranscriptTimelineProps {
  transcript: string;
  taggedTranscript?: string;
  segments?: TranscriptSegment[];
}

interface ParsedLine {
  speaker: 'PRESENTER' | 'JUDGE' | 'UNKNOWN';
  text: string;
  timestamp?: string;
}

export function TranscriptTimeline({ transcript, taggedTranscript, segments }: TranscriptTimelineProps) {
  // Parse the tagged transcript into lines with speaker labels
  const parseTranscript = (): ParsedLine[] => {
    if (!taggedTranscript) {
      return [{ speaker: 'UNKNOWN', text: transcript }];
    }

    const lines = taggedTranscript.split('\n').filter(line => line.trim());
    const parsed: ParsedLine[] = [];

    let segmentIndex = 0;

    for (const line of lines) {
      const presenterMatch = line.match(/^\[PRESENTER\]\s*(.+)$/i);
      const judgeMatch = line.match(/^\[JUDGE\]\s*(.+)$/i);

      if (presenterMatch) {
        const segment = segments?.[segmentIndex];
        parsed.push({
          speaker: 'PRESENTER',
          text: presenterMatch[1].trim(),
          timestamp: segment?.start !== undefined ? formatTime(segment.start) : undefined,
        });
        segmentIndex++;
      } else if (judgeMatch) {
        const segment = segments?.[segmentIndex];
        parsed.push({
          speaker: 'JUDGE',
          text: judgeMatch[1].trim(),
          timestamp: segment?.start !== undefined ? formatTime(segment.start) : undefined,
        });
        segmentIndex++;
      } else if (line.trim()) {
        parsed.push({
          speaker: 'UNKNOWN',
          text: line.trim(),
        });
      }
    }

    return parsed;
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parsedLines = parseTranscript();

  // Group consecutive lines from same speaker
  const groupedLines: Array<{ speaker: string; lines: ParsedLine[] }> = [];
  parsedLines.forEach((line) => {
    const lastGroup = groupedLines[groupedLines.length - 1];
    if (lastGroup && lastGroup.speaker === line.speaker) {
      lastGroup.lines.push(line);
    } else {
      groupedLines.push({ speaker: line.speaker, lines: [line] });
    }
  });

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'PRESENTER':
        return 'from-primary to-blue-600';
      case 'JUDGE':
        return 'from-purple-500 to-pink-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getSpeakerIcon = (speaker: string) => {
    switch (speaker) {
      case 'PRESENTER':
        return <User className="w-5 h-5" />;
      case 'JUDGE':
        return <UserCheck className="w-5 h-5" />;
      default:
        return <User className="w-5 h-5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="glass-panel p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-display font-bold text-foreground">Conversation Timeline</h3>
          <p className="text-xs text-muted-foreground mt-1">
            AI-identified speakers and timestamps
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-blue-600"></div>
            <span className="text-muted-foreground">Presenter</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-600"></div>
            <span className="text-muted-foreground">Judge</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
        {groupedLines.map((group, groupIndex) => (
          <motion.div
            key={groupIndex}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: groupIndex * 0.05 }}
            className="relative"
          >
            {/* Timeline connector */}
            {groupIndex < groupedLines.length - 1 && (
              <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gradient-to-b from-border to-transparent"></div>
            )}

            <div className="flex gap-4">
              {/* Speaker Avatar */}
              <div className="flex-shrink-0">
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${getSpeakerColor(
                    group.speaker
                  )} flex items-center justify-center text-white shadow-lg`}
                >
                  {getSpeakerIcon(group.speaker)}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-foreground">
                    {group.speaker === 'PRESENTER' ? 'Presenter' : group.speaker === 'JUDGE' ? 'Judge' : 'Unknown'}
                  </span>
                  {group.lines[0].timestamp && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono-alt">
                      <Clock className="w-3 h-3" />
                      {group.lines[0].timestamp}
                    </span>
                  )}
                </div>

                <div className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.08]">
                  {group.lines.map((line, lineIndex) => (
                    <p
                      key={lineIndex}
                      className={`text-sm text-foreground/90 leading-relaxed ${
                        lineIndex > 0 ? 'mt-2' : ''
                      }`}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {parsedLines.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No transcript available
        </div>
      )}
    </motion.div>
  );
}
