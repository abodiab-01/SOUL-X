import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';
import { formatAudioDuration } from '../lib/mediaUtils';

interface AudioMessagePlayerProps {
  src: string;
  duration?: number;
  isMe?: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  src,
  duration,
  isMe = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause any other playing audio on the page
      document.querySelectorAll('audio').forEach((el) => {
        if (el !== audio && !el.paused) el.pause();
      });
      audio.play().catch(() => {});
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Waveform bars simulation
  const barHeights = [20, 45, 75, 35, 90, 60, 40, 80, 50, 70, 30, 85, 45, 65, 35, 55, 90, 40];

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px] max-w-full select-none" dir="ltr">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs ${
          isMe
            ? 'bg-white text-emerald-700 hover:bg-neutral-100'
            : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current stroke-[2.5]" />
        ) : (
          <Play className="w-4 h-4 fill-current stroke-[2.5] ml-0.5" />
        )}
      </button>

      {/* Waveform / Progress area */}
      <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
        <div
          className="flex items-center gap-0.5 h-6 cursor-pointer py-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            if (audioRef.current && totalDuration > 0) {
              audioRef.current.currentTime = pct * totalDuration;
            }
          }}
        >
          {barHeights.map((h, i) => {
            const barPct = (i / barHeights.length) * 100;
            const isFilled = progressPercent >= barPct;
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-1 rounded-full transition-all duration-100 ${
                  isMe
                    ? isFilled
                      ? 'bg-white'
                      : 'bg-emerald-400/50'
                    : isFilled
                    ? 'bg-emerald-600 dark:bg-emerald-400'
                    : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
              />
            );
          })}
        </div>

        {/* Time and Icon row */}
        <div className="flex items-center justify-between text-[10px] font-mono leading-none">
          <span className={isMe ? 'text-emerald-100' : 'text-neutral-500 dark:text-neutral-400'}>
            {isPlaying
              ? formatAudioDuration(currentTime)
              : formatAudioDuration(totalDuration || currentTime)}
          </span>
          <span className={`inline-flex items-center gap-0.5 ${isMe ? 'text-emerald-200' : 'text-neutral-400'}`}>
            <Mic className="w-2.5 h-2.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
