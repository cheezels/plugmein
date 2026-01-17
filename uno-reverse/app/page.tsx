"use client";

import { useState, useRef, useCallback } from "react";

type Screenshot = {
  id: string;
  image: string;
  emotion: string;
  timestamp: number;
};

type JudgeResult = {
  transcript: string;
  emotion: string;
  score: number;
  screenshots: Screenshot[];
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [activeTab, setActiveTab] = useState<"score" | "screenshots" | "transcript">("score");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const screenshotsRef = useRef<Screenshot[]>([]);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureScreenshot = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    //TODO: Replace with actual emotion detection logic
    const image = canvas.toDataURL("image/jpeg", 0.8);

    const emotions = ["Confused", "Skeptical", "Impressed", "Bored", "Surprised", "Amused"];
    const randomEmotion = emotions[Math.floor(Math.random() * emotions.length)];

    const screenshot: Screenshot = {
      id: Date.now().toString(),
      image,
      emotion: randomEmotion,
      timestamp: Date.now(),
    };

    screenshotsRef.current.push(screenshot);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      screenshotsRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        console.log("Recording stopped, blob size:", blob.size);

        //TODO: Replace with actual analysis logic
        setResult({
          transcript: `Judge: "So tell me about your project..."

You: "We built an app that uses AI to analyze hackathon judges."

Judge: "That's... interesting. How does it work exactly?"

You: "It records video and audio, then uses computer vision and speech-to-text to analyze your reactions and feedback."

Judge: "Wait, are you recording me right now?"

You: "...maybe."

Judge: "I'm not sure how I feel about this."`,
          emotion: "Skeptical",
          score: 6,
          screenshots: screenshotsRef.current,
        });
      };

      captureIntervalRef.current = setInterval(captureScreenshot, 3000);

      mediaRecorder.start();
      setIsRecording(true);
      setResult(null);
      setActiveTab("score");
    } catch (err) {
      console.error("Error accessing camera/microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }

      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-emerald-300";
    if (score >= 4) return "text-yellow-300";
    return "text-rose-300";
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Terraria-style layered background */}
      <div className="fixed inset-0">
        {/* Sky gradient - forest biome style */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-200" />

        {/* Distant mountains/hills layer */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[60%] opacity-30"
          style={{
            background: `
              linear-gradient(135deg, transparent 40%, #3d6b4f 40%, #3d6b4f 42%, transparent 42%),
              linear-gradient(225deg, transparent 40%, #2d5a3f 40%, #2d5a3f 42%, transparent 42%),
              linear-gradient(160deg, transparent 50%, #4a7d5e 50%, #4a7d5e 55%, transparent 55%)
            `,
            backgroundSize: '200px 200px, 300px 200px, 250px 200px',
            backgroundPosition: '0 100%, 100px 100%, 50px 100%',
            backgroundRepeat: 'repeat-x',
          }}
        />

        {/* Tree silhouettes layer */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] opacity-40"
          style={{
            background: `
              radial-gradient(ellipse 30px 50px at 50px bottom, #2d5a3f 70%, transparent 70%),
              radial-gradient(ellipse 25px 40px at 120px bottom, #3d6b4f 70%, transparent 70%),
              radial-gradient(ellipse 35px 55px at 200px bottom, #2d5a3f 70%, transparent 70%),
              radial-gradient(ellipse 28px 45px at 280px bottom, #4a7d5e 70%, transparent 70%),
              radial-gradient(ellipse 32px 52px at 350px bottom, #3d6b4f 70%, transparent 70%)
            `,
            backgroundRepeat: 'repeat-x',
            backgroundSize: '400px 100%',
          }}
        />

        {/* Ground layer - grass and dirt */}
        <div className="absolute bottom-0 left-0 right-0 h-24">
          {/* Grass top */}
          <div className="h-4 bg-gradient-to-b from-green-500 to-green-600" />
          {/* Dirt */}
          <div className="h-20 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900" />
        </div>

        {/* Floating clouds */}
        <div className="absolute top-[10%] left-[10%] w-32 h-12 bg-white/60 rounded-full blur-sm animate-pulse" />
        <div className="absolute top-[15%] left-[60%] w-40 h-14 bg-white/50 rounded-full blur-sm" />
        <div className="absolute top-[8%] left-[80%] w-24 h-10 bg-white/40 rounded-full blur-sm" />
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-12">
        <canvas ref={canvasRef} className="hidden" />

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/20">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50" />
            <span className="text-sm font-bold text-yellow-200 tracking-wide">HACKATHON MODE</span>
          </div>
          <h1
            className="text-5xl font-black tracking-tight text-white"
            style={{
              textShadow: '3px 3px 0 #1a365d, -1px -1px 0 #63b3ed, 0 0 20px rgba(99, 179, 237, 0.5)'
            }}
          >
            Uno Reverse
          </h1>
          <p
            className="mt-2 text-lg font-semibold text-sky-100"
            style={{ textShadow: '1px 1px 0 #1a365d' }}
          >
            Judge the judges
          </p>
        </div>

        {/* Video Preview - Terraria inventory style */}
        <div className="mb-8 rounded-lg overflow-hidden bg-indigo-950/80 backdrop-blur-sm border-4 border-indigo-900 shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 px-4 py-2 border-b-2 border-indigo-700">
            <span className="text-sm font-bold text-indigo-200 tracking-wide">RECORDING FEED</span>
          </div>
          <div className="p-2 relative">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full bg-black/50 rounded"
            />
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded bg-red-600/90 border-2 border-red-400">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-bold text-white">REC</span>
              </div>
            )}
          </div>
        </div>

        {/* Record Button */}
        <div className="mb-10 flex justify-center">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #48bb78 0%, #38a169 50%, #2f855a 100%)',
                boxShadow: '0 4px 0 #276749, 0 6px 20px rgba(72, 187, 120, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                border: '2px solid #68d391',
              }}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(180deg, #fc8181 0%, #f56565 50%, #e53e3e 100%)',
                boxShadow: '0 4px 0 #c53030, 0 6px 20px rgba(245, 101, 101, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                border: '2px solid #feb2b2',
              }}
            >
              <span className="w-3 h-3 rounded-sm bg-white" />
              Stop Recording
            </button>
          )}
        </div>

        {/* Results - Terraria UI panel style */}
        {result && (
          <div className="rounded-lg overflow-hidden bg-indigo-950/80 backdrop-blur-sm border-4 border-indigo-900 shadow-2xl">
            {/* Tabs */}
            <div className="flex bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 border-b-2 border-indigo-700">
              {[
                { key: "score", label: "Score", bgColor: "from-slate-700 to-slate-800", activeColor: "from-slate-600 to-slate-700" },
                { key: "screenshots", label: `Faces (${result.screenshots.length})`, bgColor: "from-pink-700 to-pink-800", activeColor: "from-pink-500 to-pink-600" },
                { key: "transcript", label: "Transcript", bgColor: "from-purple-800 to-purple-900", activeColor: "from-purple-600 to-purple-700" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 py-3 px-4 text-sm font-bold transition-all duration-200 border-r-2 border-indigo-700 last:border-r-0 ${
                    activeTab === tab.key
                      ? `bg-gradient-to-b ${tab.activeColor} text-white shadow-inner`
                      : `bg-gradient-to-b ${tab.bgColor} text-indigo-300 hover:text-white hover:brightness-110`
                  }`}
                  style={{
                    textShadow: activeTab === tab.key ? '0 0 10px rgba(255,255,255,0.5)' : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {/* Score Tab - Stone/Cave style */}
              {activeTab === "score" && (
                <div
                  className="rounded-lg p-6"
                  style={{
                    background: 'linear-gradient(180deg, #475569 0%, #334155 50%, #1e293b 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="text-center space-y-6">
                    <div>
                      <p
                        className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        Judge Score
                      </p>
                      <div className="relative inline-block">
                        <p
                          className={`text-8xl font-black tabular-nums ${getScoreColor(result.score)}`}
                          style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.5), 0 0 30px currentColor' }}
                        >
                          {result.score}
                        </p>
                        <span
                          className="absolute -right-10 top-6 text-3xl font-bold text-slate-500"
                          style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
                        >
                          /10
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-slate-600">
                      <p
                        className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      >
                        Overall Vibe
                      </p>
                      <p
                        className="text-2xl font-bold text-white"
                        style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.5)' }}
                      >
                        {result.emotion}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Screenshots Tab - Hallow/Rainbow style */}
              {activeTab === "screenshots" && (
                <div
                  className="rounded-lg p-6"
                  style={{
                    background: 'linear-gradient(180deg, #ec4899 0%, #a855f7 25%, #6366f1 50%, #3b82f6 75%, #06b6d4 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  {result.screenshots.length === 0 ? (
                    <div className="py-10 text-center">
                      <div
                        className="w-16 h-16 mx-auto mb-4 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #fbbf24 0%, #f472b6 50%, #a78bfa 100%)',
                          boxShadow: '0 0 20px rgba(251, 191, 36, 0.5)',
                        }}
                      >
                        <span className="text-2xl">✨</span>
                      </div>
                      <p
                        className="text-white font-bold"
                        style={{ textShadow: '2px 2px 0 rgba(0,0,0,0.3)' }}
                      >
                        No screenshots captured yet.
                      </p>
                      <p
                        className="text-sm text-white/80 mt-1"
                        style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}
                      >
                        Record longer to capture funny faces!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {result.screenshots.map((screenshot, index) => (
                        <div
                          key={screenshot.id}
                          className="rounded-lg overflow-hidden border-2 transition-transform hover:scale-105"
                          style={{
                            borderColor: ['#f472b6', '#a78bfa', '#60a5fa', '#34d399'][index % 4],
                            boxShadow: `0 0 15px ${['#f472b680', '#a78bfa80', '#60a5fa80', '#34d39980'][index % 4]}`,
                          }}
                        >
                          <img
                            src={screenshot.image}
                            alt={`Screenshot - ${screenshot.emotion}`}
                            className="aspect-video w-full object-cover"
                          />
                          <div
                            className="p-2 text-center"
                            style={{
                              background: `linear-gradient(90deg, ${['#ec4899', '#a855f7', '#3b82f6', '#10b981'][index % 4]} 0%, ${['#f472b6', '#c084fc', '#60a5fa', '#34d399'][index % 4]} 100%)`,
                            }}
                          >
                            <p
                              className="text-sm font-bold text-white"
                              style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}
                            >
                              {screenshot.emotion}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Transcript Tab - Corruption style */}
              {activeTab === "transcript" && (
                <div
                  className="rounded-lg p-6"
                  style={{
                    background: 'linear-gradient(180deg, #4c1d95 0%, #3b0764 50%, #1e1b4b 100%)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  <div
                    className="rounded-lg p-4 max-h-[400px] overflow-y-auto"
                    style={{
                      background: 'linear-gradient(180deg, rgba(30, 27, 75, 0.8) 0%, rgba(17, 24, 39, 0.9) 100%)',
                      border: '2px solid #7c3aed',
                      boxShadow: 'inset 0 0 20px rgba(124, 58, 237, 0.3), 0 0 15px rgba(124, 58, 237, 0.2)',
                    }}
                  >
                    <p
                      className="whitespace-pre-wrap text-purple-200 leading-relaxed font-mono text-sm"
                      style={{ textShadow: '0 0 10px rgba(167, 139, 250, 0.3)' }}
                    >
                      {result.transcript}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer - Terraria ore blocks */}
        <div className="mt-12 flex justify-center gap-1">
          {[
            { color: '#68d391', glow: '#48bb78' }, // Emerald
            { color: '#fbbf24', glow: '#f59e0b' }, // Gold
            { color: '#f472b6', glow: '#ec4899' }, // Pink (Hallow)
            { color: '#a78bfa', glow: '#8b5cf6' }, // Purple (Corruption)
            { color: '#60a5fa', glow: '#3b82f6' }, // Blue
          ].map((ore, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-sm transition-all hover:scale-125 cursor-pointer"
              style={{
                background: `linear-gradient(135deg, ${ore.color} 0%, ${ore.glow} 100%)`,
                boxShadow: `0 0 10px ${ore.glow}80, inset 1px 1px 0 rgba(255,255,255,0.3), inset -1px -1px 0 rgba(0,0,0,0.2)`,
                border: '1px solid rgba(0,0,0,0.3)',
              }}
            />
          ))}
        </div>
        <p
          className="mt-4 text-center text-xs font-semibold text-sky-800"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}
        >
          Inspired by Terraria
        </p>
      </div>
    </div>
  );
}
