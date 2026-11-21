import React from 'react';
import {
  X,
  Music,
  Play,
  Pause,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { Language, RoomMusicState } from '../../types';
import { CLIENT_ROOM_PLAYLIST } from '../../lib/roomMusicEngine';

interface RoomMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  music: RoomMusicState;
  canControlMusic: boolean;
  localVolume: number; // 0..1 (Music volume)
  onLocalVolumeChange: (v: number) => void;
  voiceVolume: number; // 0..1 (Room & Seats voice volume)
  onVoiceVolumeChange: (v: number) => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
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
  voiceVolume,
  onVoiceVolumeChange,
  isDeafened,
  onToggleDeafen,
  onControl,
}) => {
  const isAr = lang === 'ar';
  if (!isOpen) return null;

  const effectiveVoicePct = isDeafened ? 0 : Math.round(voiceVolume * 100);
  const effectiveMusicPct = Math.round(localVolume * 100);

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/70 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {canControlMusic ? (
              <Music className="w-5 h-5 text-cyan-500" />
            ) : (
              <SlidersHorizontal className="w-5 h-5 text-cyan-500" />
            )}
            <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
              {canControlMusic
                ? (isAr ? 'موسيقى الغرفة والصوت' : 'Room Music & Audio')
                : (isAr ? 'التحكم بالصوت' : 'Audio Control')}
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

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Now Playing (DJ/Mod control card only for music managers) */}
          {canControlMusic && (
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
                <div
                  className={`w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 ${
                    music.isPlaying ? 'animate-pulse' : ''
                  }`}
                >
                  <Music className="w-5 h-5" />
                </div>
              </div>

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
            </div>
          )}

          {/* Music Volume */}
          <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onLocalVolumeChange(localVolume <= 0.01 ? 0.35 : 0)}
                className="flex items-center gap-2 text-xs font-black text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    localVolume <= 0.01
                      ? 'bg-rose-500/15 text-rose-500'
                      : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                  }`}
                >
                  {localVolume <= 0.01 ? <VolumeX className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                </span>
                <div className="text-start">
                  <div>{isAr ? 'مستوى صوت الموسيقى' : 'Music Volume'}</div>
                  {!canControlMusic && (
                    <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[190px]">
                      {music.isPlaying
                        ? `${isAr ? 'يعمل الآن:' : 'Playing:'} ${isAr ? music.trackTitleAr : music.trackTitleEn}`
                        : (isAr ? 'لا توجد موسيقى قيد التشغيل حالياً' : 'No music playing right now')}
                    </div>
                  )}
                </div>
              </button>
              <span className="font-mono text-xs font-black text-cyan-600 dark:text-cyan-400 shrink-0">
                {effectiveMusicPct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveMusicPct}
              onChange={(e) => onLocalVolumeChange(Number(e.target.value) / 100)}
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Room & Seats Voice Volume */}
          <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onToggleDeafen}
                className="flex items-center gap-2 text-xs font-black text-neutral-800 dark:text-neutral-100 cursor-pointer"
              >
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isDeafened || voiceVolume <= 0.01
                      ? 'bg-rose-500/15 text-rose-500'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {isDeafened || voiceVolume <= 0.01 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Users className="w-4 h-4" />
                  )}
                </span>
                <div className="text-start">
                  <div>{isAr ? 'مستوى صوت الغرفة والمقاعد' : 'Room & Seats Volume'}</div>
                  <div className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                    {isDeafened
                      ? (isAr ? 'الصوت مكتوم — حرّك الشريط أو اضغط للتشغيل' : 'Muted — slide or tap to unmute')
                      : (isAr ? 'التحكم بصوت المتحدثين على المقاعد' : 'Speakers & seats voice level')}
                  </div>
                </div>
              </button>
              <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                {effectiveVoicePct}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effectiveVoicePct}
              onChange={(e) => onVoiceVolumeChange(Number(e.target.value) / 100)}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Playlist (only for users permitted to control room music) */}
          {canControlMusic && (
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
                    onClick={() => onControl('select', track.id)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between text-start transition-all cursor-pointer hover:border-cyan-500/40 ${
                      isCurrent
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                        : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">{isAr ? track.titleAr : track.titleEn}</div>
                      <div className="text-[11px] opacity-75">
                        {track.artist} · {track.bpm} BPM
                      </div>
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
          )}
        </div>
      </div>
    </div>
  );
};

