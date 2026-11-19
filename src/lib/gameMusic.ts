// Unified Web Audio Background Music Synthesizer for all Soul-X games
// Generates rich, warm, non-fatiguing game-specific ambient soundtracks without external audio dependencies.

export type GameMusicTrackId =
  | 'golden-tree'
  | 'winter-slots'
  | 'boxes'
  | 'plinko'
  | 'mines'
  | 'dice'
  | 'olympus'
  | 'default';

export type MusicVolumePreset = 'soft' | 'medium' | 'full';

interface TrackChordBar {
  padRoots: [number, number];
  arp: number[];
  bassNote: number;
}

interface GameMusicTheme {
  labelAr: string;
  labelEn: string;
  stepMs: number;
  padWave: OscillatorType;
  arpWave: OscillatorType;
  padCutoff: number;
  arpCutoff: number;
  progression: TrackChordBar[];
}

const GAME_MUSIC_THEMES: Record<Exclude<GameMusicTrackId, 'olympus'>, GameMusicTheme> = {
  'golden-tree': {
    labelAr: 'لحن الغابة الذهبية',
    labelEn: 'Golden Grove Melody',
    stepMs: 280,
    padWave: 'sine',
    arpWave: 'triangle',
    padCutoff: 580,
    arpCutoff: 2100,
    // Warm Royal Cmaj9 -> Am9 -> Fmaj9 -> G6
    progression: [
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [261.63, 329.63, 392.0, 493.88, 587.33, 493.88, 392.0, 329.63] },
      { padRoots: [110.0, 164.81], bassNote: 55.0, arp: [220.0, 261.63, 329.63, 493.88, 523.25, 493.88, 329.63, 261.63] },
      { padRoots: [174.61, 220.0], bassNote: 87.31, arp: [261.63, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23] },
      { padRoots: [196.0, 246.94], bassNote: 98.0, arp: [293.66, 392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 392.0] },
    ],
  },
  'winter-slots': {
    labelAr: 'نسيم الشتاء الكريستالي',
    labelEn: 'Crystal Winter Chimes',
    stepMs: 300,
    padWave: 'sine',
    arpWave: 'sine',
    padCutoff: 640,
    arpCutoff: 2600,
    // Crystalline Em9 -> Cmaj7 -> Gmaj7 -> Dsus4
    progression: [
      { padRoots: [164.81, 246.94], bassNote: 82.41, arp: [329.63, 392.0, 493.88, 659.25, 739.99, 659.25, 493.88, 392.0] },
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [329.63, 392.0, 493.88, 523.25, 659.25, 523.25, 493.88, 392.0] },
      { padRoots: [196.0, 246.94], bassNote: 98.0, arp: [392.0, 493.88, 587.33, 739.99, 783.99, 739.99, 587.33, 493.88] },
      { padRoots: [146.83, 220.0], bassNote: 73.42, arp: [293.66, 392.0, 440.0, 587.33, 659.25, 587.33, 440.0, 392.0] },
    ],
  },
  boxes: {
    labelAr: 'إيقاع الصناديق الغامضة',
    labelEn: 'Mystery Vault Groove',
    stepMs: 255,
    padWave: 'triangle',
    arpWave: 'triangle',
    padCutoff: 500,
    arpCutoff: 1850,
    // Intriguing Fm7 -> DbMaj7 -> Eb6 -> C7sus
    progression: [
      { padRoots: [174.61, 207.65], bassNote: 87.31, arp: [261.63, 311.13, 349.23, 466.16, 523.25, 466.16, 349.23, 311.13] },
      { padRoots: [138.59, 207.65], bassNote: 69.3, arp: [277.18, 349.23, 415.3, 523.25, 415.3, 349.23, 277.18, 311.13] },
      { padRoots: [155.56, 233.08], bassNote: 77.78, arp: [311.13, 392.0, 466.16, 587.33, 466.16, 392.0, 311.13, 349.23] },
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [261.63, 349.23, 392.0, 466.16, 523.25, 466.16, 392.0, 349.23] },
    ],
  },
  plinko: {
    labelAr: 'إيقاع النيون السريع',
    labelEn: 'Neon Arcade Pulse',
    stepMs: 235,
    padWave: 'triangle',
    arpWave: 'triangle',
    padCutoff: 540,
    arpCutoff: 2250,
    // Upbeat synthwave Am7 -> Fmaj7 -> Cmaj7 -> G6
    progression: [
      { padRoots: [110.0, 164.81], bassNote: 55.0, arp: [220.0, 261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 261.63] },
      { padRoots: [174.61, 220.0], bassNote: 87.31, arp: [220.0, 261.63, 349.23, 440.0, 523.25, 440.0, 349.23, 261.63] },
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [261.63, 329.63, 392.0, 493.88, 523.25, 493.88, 392.0, 329.63] },
      { padRoots: [196.0, 246.94], bassNote: 98.0, arp: [246.94, 293.66, 392.0, 493.88, 587.33, 493.88, 392.0, 293.66] },
    ],
  },
  mines: {
    labelAr: 'أجواء الألغام المشوقة',
    labelEn: 'Tactical Gems Suspense',
    stepMs: 295,
    padWave: 'sine',
    arpWave: 'sine',
    padCutoff: 460,
    arpCutoff: 1750,
    // Stealth tension Bm -> Gmaj7 -> Em7 -> F#m7
    progression: [
      { padRoots: [123.47, 185.0], bassNote: 61.74, arp: [246.94, 293.66, 369.99, 493.88, 440.0, 369.99, 293.66, 246.94] },
      { padRoots: [196.0, 246.94], bassNote: 98.0, arp: [246.94, 293.66, 392.0, 493.88, 587.33, 493.88, 392.0, 293.66] },
      { padRoots: [164.81, 246.94], bassNote: 82.41, arp: [246.94, 329.63, 392.0, 493.88, 440.0, 392.0, 329.63, 293.66] },
      { padRoots: [185.0, 220.0], bassNote: 92.5, arp: [220.0, 277.18, 369.99, 440.0, 369.99, 329.63, 277.18, 220.0] },
    ],
  },
  dice: {
    labelAr: 'موسيقى النرد الهادئة',
    labelEn: 'Midnight Dice Lounge',
    stepMs: 270,
    padWave: 'sine',
    arpWave: 'triangle',
    padCutoff: 520,
    arpCutoff: 1800,
    // Chill jazz Dm9 -> G13 -> Cmaj9 -> A7
    progression: [
      { padRoots: [146.83, 220.0], bassNote: 73.42, arp: [293.66, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23] },
      { padRoots: [196.0, 246.94], bassNote: 98.0, arp: [293.66, 349.23, 440.0, 493.88, 659.25, 493.88, 440.0, 349.23] },
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [261.63, 329.63, 392.0, 493.88, 587.33, 493.88, 392.0, 329.63] },
      { padRoots: [110.0, 164.81], bassNote: 55.0, arp: [277.18, 329.63, 392.0, 493.88, 554.37, 493.88, 392.0, 329.63] },
    ],
  },
  default: {
    labelAr: 'موسيقى الألعاب',
    labelEn: 'Arcade Lounge',
    stepMs: 275,
    padWave: 'sine',
    arpWave: 'triangle',
    padCutoff: 540,
    arpCutoff: 1950,
    progression: [
      { padRoots: [130.81, 196.0], bassNote: 65.41, arp: [261.63, 329.63, 392.0, 493.88, 523.25, 493.88, 392.0, 329.63] },
      { padRoots: [110.0, 164.81], bassNote: 55.0, arp: [220.0, 261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 261.63] },
    ],
  },
};

export function getGameMusicMeta(gameId: string | null): { labelAr: string; labelEn: string } {
  if (!gameId || gameId === 'olympus') {
    return { labelAr: 'ملحمة أوليمبوس', labelEn: 'Olympus Epic' };
  }
  const theme =
    GAME_MUSIC_THEMES[gameId as Exclude<GameMusicTrackId, 'olympus'>] || GAME_MUSIC_THEMES.default;
  return { labelAr: theme.labelAr, labelEn: theme.labelEn };
}

export class GameBackgroundMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private loopTimer: number | null = null;
  private stepIndex = 0;

  private activeTrack: Exclude<GameMusicTrackId, 'olympus'> | null = null;
  private enabled = true;
  private volumePreset: MusicVolumePreset = 'medium';
  private disposed = false;

  private getTargetGain(): number {
    if (!this.enabled || !this.activeTrack) return 0.0001;
    switch (this.volumePreset) {
      case 'soft':
        return 0.14;
      case 'full':
        return 0.34;
      case 'medium':
      default:
        return 0.23;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === 'undefined') return null;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;

      try {
        const ctx = new Ctor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-18, ctx.currentTime);
        compressor.knee.setValueAtTime(20, ctx.currentTime);
        compressor.ratio.setValueAtTime(3.5, ctx.currentTime);
        compressor.attack.setValueAtTime(0.01, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);

        const master = ctx.createGain();
        master.gain.setValueAtTime(this.getTargetGain(), ctx.currentTime);

        master.connect(compressor);
        compressor.connect(ctx.destination);

        this.ctx = ctx;
        this.masterGain = master;
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private syncGain(): void {
    if (!this.ctx || !this.masterGain) return;
    const target = this.getTargetGain();
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }

  public setVolumePreset(preset: MusicVolumePreset): void {
    this.volumePreset = preset;
    this.syncGain();
  }

  public configure(trackId: GameMusicTrackId | null, enabled: boolean): void {
    const resolvedTrack: Exclude<GameMusicTrackId, 'olympus'> | null =
      !trackId || trackId === 'olympus'
        ? null
        : GAME_MUSIC_THEMES[trackId as Exclude<GameMusicTrackId, 'olympus'>]
        ? (trackId as Exclude<GameMusicTrackId, 'olympus'>)
        : 'default';

    const trackChanged = this.activeTrack !== resolvedTrack;
    this.activeTrack = resolvedTrack;
    this.enabled = enabled;
    this.syncGain();

    if (!this.enabled || !this.activeTrack || (typeof document !== 'undefined' && document.hidden)) {
      this.stopLoop();
      return;
    }

    if (trackChanged) {
      this.stepIndex = 0;
      this.stopLoop();
    }

    if (this.ctx && this.loopTimer === null) {
      this.startLoop();
    }
  }

  public unlockAndPlay(): void {
    if (!this.enabled || !this.activeTrack || this.disposed) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.syncGain();
    if (this.loopTimer === null) {
      this.startLoop();
    }
  }

  public handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopLoop();
    } else if (this.ctx && this.enabled && this.activeTrack) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.startLoop();
    }
  }

  private startLoop(): void {
    if (this.disposed || this.loopTimer !== null || !this.activeTrack) return;
    const theme = GAME_MUSIC_THEMES[this.activeTrack] || GAME_MUSIC_THEMES.default;
    this.scheduleStep();
    this.loopTimer = window.setInterval(() => {
      this.scheduleStep();
    }, theme.stepMs);
  }

  private stopLoop(): void {
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private scheduleStep(): void {
    if (
      this.disposed ||
      !this.ctx ||
      !this.masterGain ||
      !this.enabled ||
      !this.activeTrack ||
      this.ctx.state !== 'running'
    ) {
      return;
    }

    const theme = GAME_MUSIC_THEMES[this.activeTrack] || GAME_MUSIC_THEMES.default;
    const ctx = this.ctx;
    const out = this.masterGain;
    const now = ctx.currentTime + 0.02;
    const barIdx = Math.floor(this.stepIndex / 8) % theme.progression.length;
    const beatInBar = this.stepIndex % 8;
    const bar = theme.progression[barIdx];
    const barDuration = (theme.stepMs * 8) / 1000;

    try {
      // 1. Warm harmonic pad chord at the start of every 8-step bar
      if (beatInBar === 0) {
        bar.padRoots.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? theme.padWave : 'sine';
          osc.frequency.setValueAtTime(freq, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(theme.padCutoff, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(idx === 0 ? 0.18 : 0.1, now + 0.32);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + barDuration * 0.96);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + barDuration + 0.05);
        });
      }

      // 2. Melodic Arpeggio Note
      const noteFreq = bar.arp[beatInBar % bar.arp.length];
      const arpOsc = ctx.createOscillator();
      const arpFilter = ctx.createBiquadFilter();
      const arpGain = ctx.createGain();

      arpOsc.type = theme.arpWave;
      arpOsc.frequency.setValueAtTime(noteFreq, now);

      arpFilter.type = 'lowpass';
      arpFilter.frequency.setValueAtTime(theme.arpCutoff, now);
      arpFilter.frequency.exponentialRampToValueAtTime(Math.max(480, theme.arpCutoff * 0.35), now + 0.32);

      const amp = beatInBar % 2 === 0 ? 0.12 : 0.085;
      arpGain.gain.setValueAtTime(0.0001, now);
      arpGain.gain.linearRampToValueAtTime(amp, now + 0.015);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      arpOsc.connect(arpFilter);
      arpFilter.connect(arpGain);
      arpGain.connect(out);
      arpOsc.start(now);
      arpOsc.stop(now + 0.42);

      // 3. Soft rhythmic sub-bass pulse on beats 0 and 4
      if (beatInBar === 0 || beatInBar === 4) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(bar.bassNote, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.linearRampToValueAtTime(beatInBar === 0 ? 0.17 : 0.11, now + 0.02);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        bassOsc.connect(bassGain);
        bassGain.connect(out);
        bassOsc.start(now);
        bassOsc.stop(now + 0.38);
      }
    } catch {
      // Ignore transient Web Audio errors
    }

    this.stepIndex = (this.stepIndex + 1) % (theme.progression.length * 8);
  }

  public dispose(): void {
    this.disposed = true;
    this.stopLoop();
    try {
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
      }
    } catch {
      // Ignore close error
    }
    this.ctx = null;
    this.masterGain = null;
  }
}
