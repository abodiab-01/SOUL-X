import React from 'react';
import { X, Music, Play, Pause, SkipForward, Square, Volume2, VolumeX } from 'lucide-react';
import { Language, RoomMusicState } from '../../types';
import { CLIENT_ROOM_PLAYLIST } from '../../lib/roomMusicEngine';

interface RoomMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  music: RoomMusicState;
  canControlMusic: boolean;
  localVolume: number; // 0..1
  onLocalVolumeChange: (v: number) => void;
  onControl: (action: 'play' | 'pause' | 'next' | 'select' | 'stop', trackId?: string) => void;
}

export const RoomMusicModal: React.FC<RoomMusicModalProps> = ({
  isOpen,
  onClose,
  lang,
  music,
  canControlMusic,
  localVolume,
  onLocalVolumeChange,
  onControl,
}) => {
  const isAr = lang === 'ar';
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/70 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-cyan-500" />
            <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
              {isAr ? 'موسيقى الغرفة المتزامنة' : 'Room Music Player'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Now Playing */}
          <div className="p-4 rounded-2xl bg-neutral-950 text-white border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  {music.isPlaying ? (isAr ? 'قيد التشغيل للغرفة' : 'NOW PLAYING') : (isAr ? 'متوقف مؤقتاً' : 'PAUSED')}
                </div>
                <div className="text-sm font-black truncate mt-0.5">
                  {isAr ? music.trackTitleAr : music.trackTitleEn}
                </div>
                <div className="text-xs text-neutral-400 truncate">{music.artist || 'SOUL-X Soundlab'}</div>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 ${music.isPlaying ? 'animate-pulse' : ''}`}>
                <Music className="w-5 h-5" />
              </div>
            </div>

            {canControlMusic && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onControl(music.isPlaying ? 'pause' : 'play')}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  {music.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{music.isPlaying ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'تشغيل' : 'Play')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onControl('next')}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  title={isAr ? 'المقطع التالي' : 'Next Track'}
                >
                  <SkipForward className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onControl('stop')}
                  className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-rose-400 cursor-pointer"
                  title={isAr ? 'إيقاف' : 'Stop'}
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Independent Personal Volume */}
          <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-200">
                {localVolume <= 0.01 ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
                {isAr ? 'مستوى صوت الموسيقى لديك (مستقل عن صوت المتحدثين)' : 'Your Music Volume (independent from voice)'}
              </span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400">{Math.round(localVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(localVolume * 100)}
              onChange={(e) => onLocalVolumeChange(Number(e.target.value) / 100)}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Playlist */}
          <div className="space-y-1.5">
            <div className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'قائمة المقاطع المتاحة' : 'Playlist'}
            </div>
            {CLIENT_ROOM_PLAYLIST.map((track) => {
              const isCurrent = music.trackId === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  disabled={!canControlMusic}
                  onClick={() => onControl('select', track.id)}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between text-start transition-all ${
                    canControlMusic ? 'cursor-pointer hover:border-cyan-500/40' : 'opacity-80 cursor-default'
                  } ${
                    isCurrent
                      ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                      : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate">{isAr ? track.titleAr : track.titleEn}</div>
                    <div className="text-[11px] opacity-75">{track.artist} · {track.bpm} BPM</div>
                  </div>
                  {isCurrent && music.isPlaying && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500 text-neutral-950">
                      {isAr ? 'يعمل' : 'Playing'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
