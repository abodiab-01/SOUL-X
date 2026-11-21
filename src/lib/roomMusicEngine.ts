import type { RoomMusicState } from '../types';

export interface ClientMusicTrack {
  id: string;
  titleAr: string;
  titleEn: string;
  artist: string;
  durationSec: number;
  bpm: number;
  mood: 'chill' | 'oriental' | 'lofi' | 'party' | 'ambient';
}

export const CLIENT_ROOM_PLAYLIST: ClientMusicTrack[] = [
  {
    id: 'lounge-evening',
    titleAr: 'صالة المساء الهادئة',
    titleEn: 'Evening Lounge Chill',
    artist: 'SOUL-X Soundlab',
    durationSec: 180,
    bpm: 84,
    mood: 'chill',
  },
  {
    id: 'neo-oud',
    titleAr: 'إيقاع شرقي حديث',
    titleEn: 'Neo Oud Groove',
    artist: 'SOUL-X Ensemble',
    durationSec: 210,
    bpm: 96,
    mood: 'oriental',
  },
  {
    id: 'lofi-rain',
    titleAr: 'مطر وقهوة Lo-Fi',
    titleEn: 'Midnight Lo-Fi Rain',
    artist: 'SOUL-X Beats',
    durationSec: 195,
    bpm: 76,
    mood: 'lofi',
  },
  {
    id: 'neon-party',
    titleAr: 'نبض النيون الاحتفالي',
    titleEn: 'Neon Pulse Party',
    artist: 'SOUL-X Club',
    durationSec: 165,
    bpm: 118,
    mood: 'party',
  },
  {
    id: 'starlight-ambient',
    titleAr: 'نسمة السماء الليلية',
    titleEn: 'Starlight Ambient',
    artist: 'SOUL-X Waves',
    durationSec: 240,
    bpm: 68,
    mood: 'ambient',
  },
];

const MUSIC_VOL_KEY = 'soulx_room_music_volume';

/**
 * Self-contained procedural Web Audio synthesizer synchronized to server music clock.
 * Zero external copyrighted audio dependencies; local user volume is completely independent from voice chat.
 */
export class RoomMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private stepTimer: number | null = null;
  private volume = 0.35;
  private currentState: RoomMusicState | null = null;
  private stepCount = 0;

  constructor() {
    try {
      const saved = localStorage.getItem(MUSIC_VOL_KEY);
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (Number.isFinite(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
      }
    } catch {}
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(vol01: number): void {
    this.volume = Math.max(0, Math.min(1, vol01));
    try {
      localStorage.setItem(MUSIC_VOL_KEY, String(this.volume));
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.28, this.ctx.currentTime, 0.05);
    }
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * 0.28;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  syncState(state: RoomMusicState | null): void {
    this.currentState = state;
    if (!state || !state.isPlaying) {
      this.stopLoop();
      return;
    }

    const track = CLIENT_ROOM_PLAYLIST.find((t) => t.id === state.trackId) || CLIENT_ROOM_PLAYLIST[0];
    // Synchronize musical bar/step phase with server elapsed clock
    const elapsedSec = Math.max(0, state.offsetSec + (Date.now() - state.startedAtMs) / 1000);
    const beatMs = (60 / track.bpm) * 1000;
    const stepMs = beatMs / 2;
    this.stepCount = Math.floor((elapsedSec * 1000) / stepMs);

    this.stopLoop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    const tick = () => {
      if (!this.currentState?.isPlaying) return;
      this.playStep(track, this.stepCount++);
    };
    tick();
    this.stepTimer = window.setInterval(tick, stepMs);
  }

  private playStep(track: ClientMusicTrack, step: number) {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.volume <= 0.005) return;

    const now = ctx.currentTime;
    const scales: Record<ClientMusicTrack['mood'], number[]> = {
      chill: [220, 261.63, 293.66, 329.63, 392.0, 440, 523.25], // Am pentatonic
      oriental: [293.66, 311.13, 369.99, 392.0, 440, 466.16, 554.37, 587.33], // Hijaz D
      lofi: [196, 246.94, 293.66, 349.23, 392, 493.88], // G7 chill
      party: [261.63, 311.13, 349.23, 392.0, 466.16, 523.25], // Cm club
      ambient: [174.61, 220, 261.63, 329.63, 392.0, 523.25], // Fmaj9 dreamy
    };
    const scale = scales[track.mood] || scales.chill;

    // Warm chord pad every 8 steps
    if (step % 8 === 0) {
      const rootIdx = Math.floor(step / 8) % 4;
      const root = scale[rootIdx] * 0.5;
      this.playTone(root, 1.9, 'sine', 0.24, now);
      this.playTone(root * 1.5, 1.7, 'triangle', 0.11, now);
    }

    // Soft rhythmic pulse (sub kick / pulse)
    if ((track.mood === 'party' && step % 2 === 0) || (track.mood !== 'ambient' && step % 4 === 0)) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(track.mood === 'party' ? 115 : 85, now);
      kickOsc.frequency.exponentialRampToValueAtTime(36, now + 0.14);
      kickGain.gain.setValueAtTime(track.mood === 'party' ? 0.35 : 0.2, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      kickOsc.connect(kickGain);
      kickGain.connect(master);
      kickOsc.start(now);
      kickOsc.stop(now + 0.18);
    }

    // Melody / plucked notes
    const pattern = [0, 2, 4, 3, 5, 2, 1, 4];
    const shouldPlayNote = track.mood === 'ambient' ? step % 3 === 0 : step % 2 === 0 || step % 7 === 0;
    if (shouldPlayNote) {
      const noteFreq = scale[pattern[step % pattern.length] % scale.length];
      const wave: OscillatorType = track.mood === 'oriental' ? 'triangle' : track.mood === 'party' ? 'sawtooth' : 'sine';
      const dur = track.mood === 'ambient' ? 1.2 : 0.38;
      this.playTone(noteFreq, dur, wave, track.mood === 'party' ? 0.12 : 0.16, now);
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType, level: number, startTime: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'sawtooth' ? 1100 : 1800, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(level, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  private stopLoop() {
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  resumeIfNeeded() {
    if (this.ctx && this.ctx.state === 'suspended' && this.currentState?.isPlaying) {
      this.ctx.resume().catch(() => {});
    }
  }

  destroy() {
    this.stopLoop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
