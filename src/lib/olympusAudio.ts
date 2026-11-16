// Web Audio synthesizer for Olympus Gates (mythic background music + layered SFX)

export type OlympusSfxType =
  | 'tap'
  | 'spinStart'
  | 'colDrop'
  | 'match'
  | 'explode'
  | 'thunder'
  | 'orbCharge'
  | 'winTick'
  | 'scatter'
  | 'win'
  | 'bigWin';

interface ChordBar {
  padRoots: [number, number];
  arp: number[];
}

// Mythic D Dorian / Minor progression: Dm -> Bbmaj7 -> C -> Am
const OLYMPUS_PROGRESSION: ChordBar[] = [
  {
    padRoots: [146.83, 220.0], // D3, A3
    arp: [293.66, 349.23, 440.0, 587.33, 523.25, 440.0, 349.23, 329.63],
  },
  {
    padRoots: [116.54, 174.61], // Bb2, F3
    arp: [293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66, 349.23],
  },
  {
    padRoots: [130.81, 196.0], // C3, G3
    arp: [329.63, 392.0, 523.25, 659.25, 523.25, 392.0, 329.63, 392.0],
  },
  {
    padRoots: [110.0, 164.81], // A2, E3
    arp: [329.63, 440.0, 523.25, 659.25, 523.25, 440.0, 392.0, 329.63],
  },
];

export class OlympusAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private musicTimer: number | null = null;
  private stepIndex = 0;
  private sfxEnabled = true;
  private musicEnabled = true;
  private freeSpinsMode = false;
  private disposed = false;

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
        compressor.threshold.setValueAtTime(-16, ctx.currentTime);
        compressor.knee.setValueAtTime(18, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);
        compressor.attack.setValueAtTime(0.005, ctx.currentTime);
        compressor.release.setValueAtTime(0.2, ctx.currentTime);

        const master = ctx.createGain();
        master.gain.setValueAtTime(0.9, ctx.currentTime);

        const music = ctx.createGain();
        music.gain.setValueAtTime(this.musicEnabled ? 0.24 : 0.0001, ctx.currentTime);

        const sfx = ctx.createGain();
        sfx.gain.setValueAtTime(this.sfxEnabled ? 0.65 : 0.0001, ctx.currentTime);

        music.connect(master);
        sfx.connect(master);
        master.connect(compressor);
        compressor.connect(ctx.destination);

        this.ctx = ctx;
        this.masterGain = master;
        this.musicGain = music;
        this.sfxGain = sfx;
        this.noiseBuffer = this.buildNoiseBuffer(ctx);
      } catch {
        return null;
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  public unlockAndSync(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.syncGains();
    if (this.musicEnabled && this.sfxEnabled && this.musicTimer === null && !document.hidden) {
      this.startMusicLoop();
    }
  }

  public setAudioFlags(sfxEnabled: boolean, musicEnabled: boolean, freeSpinsMode = false): void {
    const tempoChanged = this.freeSpinsMode !== freeSpinsMode;
    this.sfxEnabled = sfxEnabled;
    this.musicEnabled = musicEnabled;
    this.freeSpinsMode = freeSpinsMode;
    this.syncGains();

    if (!this.sfxEnabled || !this.musicEnabled || document.hidden) {
      this.stopMusicLoop();
    } else if (this.ctx) {
      if (tempoChanged && this.musicTimer !== null) {
        this.stopMusicLoop();
      }
      if (this.musicTimer === null) {
        this.startMusicLoop();
      }
    }
  }

  public handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      this.stopMusicLoop();
    } else if (this.ctx && this.sfxEnabled && this.musicEnabled) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.startMusicLoop();
    }
  }

  private syncGains(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const targetMusic = this.sfxEnabled && this.musicEnabled ? 0.24 : 0.0001;
    const targetSfx = this.sfxEnabled ? 0.65 : 0.0001;
    this.musicGain.gain.setTargetAtTime(targetMusic, now, 0.04);
    this.sfxGain.gain.setTargetAtTime(targetSfx, now, 0.03);
  }

  private startMusicLoop(): void {
    if (this.disposed || this.musicTimer !== null) return;
    const stepMs = this.freeSpinsMode ? 210 : 275;
    // Play immediate first beat softly so user hears instant response on toggle
    this.scheduleMusicStep();
    this.musicTimer = window.setInterval(() => {
      this.scheduleMusicStep();
    }, stepMs);
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusicStep(): void {
    if (this.disposed || !this.ctx || !this.musicGain || !this.sfxEnabled || !this.musicEnabled) return;
    if (this.ctx.state !== 'running') return;

    const ctx = this.ctx;
    const out = this.musicGain;
    const now = ctx.currentTime + 0.02;
    const barIdx = Math.floor(this.stepIndex / 8) % OLYMPUS_PROGRESSION.length;
    const beatInBar = this.stepIndex % 8;
    const chord = OLYMPUS_PROGRESSION[barIdx];

    try {
      // 1. Warm Olympic Temple Pad on start of each 8-step bar
      if (beatInBar === 0) {
        const padDuration = this.freeSpinsMode ? 1.65 : 2.15;
        chord.padRoots.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(520, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(idx === 0 ? 0.16 : 0.08, now + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + padDuration);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + padDuration + 0.04);
        });
      }

      // 2. Golden Lyre Arpeggio Pluck
      const baseNote = chord.arp[beatInBar];
      const lyreFreq = this.freeSpinsMode && beatInBar % 2 === 1 ? baseNote * 1.5 : baseNote;
      const lyreOsc = ctx.createOscillator();
      const lyreOver = ctx.createOscillator();
      const lyreFilter = ctx.createBiquadFilter();
      const lyreGain = ctx.createGain();

      lyreOsc.type = 'triangle';
      lyreOsc.frequency.setValueAtTime(lyreFreq, now);
      lyreOver.type = 'sine';
      lyreOver.frequency.setValueAtTime(lyreFreq * 2, now);

      lyreFilter.type = 'lowpass';
      lyreFilter.frequency.setValueAtTime(1950, now);
      lyreFilter.frequency.exponentialRampToValueAtTime(680, now + 0.38);

      const pluckAmp = beatInBar % 2 === 0 ? 0.12 : 0.08;
      lyreGain.gain.setValueAtTime(0.0001, now);
      lyreGain.gain.linearRampToValueAtTime(pluckAmp, now + 0.012);
      lyreGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

      const overGain = ctx.createGain();
      overGain.gain.setValueAtTime(0.28, now);

      lyreOsc.connect(lyreFilter);
      lyreOver.connect(overGain);
      overGain.connect(lyreFilter);
      lyreFilter.connect(lyreGain);
      lyreGain.connect(out);

      lyreOsc.start(now);
      lyreOver.start(now);
      lyreOsc.stop(now + 0.45);
      lyreOver.stop(now + 0.45);

      // 3. Soft Timpani Pulse on beat 0 & 4 (plus 2 & 6 during Free Spins)
      if (beatInBar === 0 || beatInBar === 4 || (this.freeSpinsMode && (beatInBar === 2 || beatInBar === 6))) {
        const drumOsc = ctx.createOscillator();
        const drumGain = ctx.createGain();
        drumOsc.type = 'sine';
        drumOsc.frequency.setValueAtTime(beatInBar === 0 ? 98 : 82, now);
        drumOsc.frequency.exponentialRampToValueAtTime(44, now + 0.16);
        drumGain.gain.setValueAtTime(beatInBar === 0 ? 0.14 : 0.08, now);
        drumGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        drumOsc.connect(drumGain);
        drumGain.connect(out);
        drumOsc.start(now);
        drumOsc.stop(now + 0.2);
      }
    } catch {
      // Ignore transient audio graph errors
    }

    this.stepIndex = (this.stepIndex + 1) % (OLYMPUS_PROGRESSION.length * 8);
  }

  public play(type: OlympusSfxType, param = 0): void {
    if (!this.sfxEnabled || this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const out = this.sfxGain;
    const now = ctx.currentTime;

    try {
      switch (type) {
        case 'tap': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(640, now);
          osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
          osc.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }

        case 'spinStart': {
          const gateOsc = ctx.createOscillator();
          const gateGain = ctx.createGain();
          gateOsc.type = 'triangle';
          gateOsc.frequency.setValueAtTime(140, now);
          gateOsc.frequency.exponentialRampToValueAtTime(240, now + 0.12);
          gateGain.gain.setValueAtTime(0.16, now);
          gateGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
          gateOsc.connect(gateGain);
          gateGain.connect(out);
          gateOsc.start(now);
          gateOsc.stop(now + 0.16);

          const chimeOsc = ctx.createOscillator();
          const chimeGain = ctx.createGain();
          chimeOsc.type = 'sine';
          chimeOsc.frequency.setValueAtTime(587.33, now + 0.02);
          chimeOsc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
          chimeGain.gain.setValueAtTime(0.08, now + 0.02);
          chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
          chimeOsc.connect(chimeGain);
          chimeGain.connect(out);
          chimeOsc.start(now + 0.02);
          chimeOsc.stop(now + 0.18);
          break;
        }

        case 'colDrop': {
          const col = Math.max(0, Math.min(5, param));
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(165 + col * 14, now);
          osc.frequency.exponentialRampToValueAtTime(72, now + 0.055);
          gain.gain.setValueAtTime(0.075, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
          osc.connect(gain);
          gain.connect(out);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        case 'match': {
          const semitoneLift = Math.pow(1.059463, Math.min(9, param));
          const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
          notes.forEach((baseFreq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq * semitoneLift, now + i * 0.035);
            gain.gain.setValueAtTime(0.11, now + i * 0.035);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.035 + 0.22);
            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.035);
            osc.stop(now + i * 0.035 + 0.24);
          });
          break;
        }

        case 'explode': {
          if (this.noiseBuffer) {
            const src = ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1600, now);
            filter.frequency.exponentialRampToValueAtTime(3400, now + 0.14);
            filter.Q.setValueAtTime(2.5, now);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

            src.connect(filter);
            filter.connect(gain);
            gain.connect(out);
            src.start(now);
            src.stop(now + 0.17);
          }
          break;
        }

        case 'thunder': {
          // 1. Lightning crack noise burst
          if (this.noiseBuffer) {
            const crack = ctx.createBufferSource();
            crack.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1800, now);
            filter.frequency.exponentialRampToValueAtTime(260, now + 0.34);
            filter.Q.setValueAtTime(1.1, now);

            const crackGain = ctx.createGain();
            crackGain.gain.setValueAtTime(0.28, now);
            crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

            crack.connect(filter);
            filter.connect(crackGain);
            crackGain.connect(out);
            crack.start(now);
            crack.stop(now + 0.38);
          }

          // 2. Deep Zeus thunder boom
          const sub = ctx.createOscillator();
          const subGain = ctx.createGain();
          sub.type = 'sawtooth';
          const subFilter = ctx.createBiquadFilter();
          subFilter.type = 'lowpass';
          subFilter.frequency.setValueAtTime(280, now);

          sub.frequency.setValueAtTime(135, now);
          sub.frequency.exponentialRampToValueAtTime(38, now + 0.38);
          subGain.gain.setValueAtTime(0.22, now);
          subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

          sub.connect(subFilter);
          subFilter.connect(subGain);
          subGain.connect(out);
          sub.start(now);
          sub.stop(now + 0.44);
          break;
        }

        case 'orbCharge': {
          // Ascending Zeus multiplier orb charge shimmer + harmonic bell
          const sweep = ctx.createOscillator();
          const sweepGain = ctx.createGain();
          sweep.type = 'triangle';
          sweep.frequency.setValueAtTime(340, now);
          sweep.frequency.exponentialRampToValueAtTime(1020, now + 0.38);
          sweepGain.gain.setValueAtTime(0.02, now);
          sweepGain.gain.linearRampToValueAtTime(0.16, now + 0.22);
          sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
          sweep.connect(sweepGain);
          sweepGain.connect(out);
          sweep.start(now);
          sweep.stop(now + 0.46);

          const bell = ctx.createOscillator();
          const bellGain = ctx.createGain();
          bell.type = 'sine';
          bell.frequency.setValueAtTime(1174.66, now + 0.24);
          bellGain.gain.setValueAtTime(0.14, now + 0.24);
          bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
          bell.connect(bellGain);
          bellGain.connect(out);
          bell.start(now + 0.24);
          bell.stop(now + 0.58);
          break;
        }

        case 'winTick': {
          const tick = ctx.createOscillator();
          const tickGain = ctx.createGain();
          tick.type = 'sine';
          tick.frequency.setValueAtTime(980 + Math.min(8, param) * 45, now);
          tick.frequency.exponentialRampToValueAtTime(1320, now + 0.032);
          tickGain.gain.setValueAtTime(0.065, now);
          tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.042);
          tick.connect(tickGain);
          tickGain.connect(out);
          tick.start(now);
          tick.stop(now + 0.05);
          break;
        }

        case 'scatter': {
          [880, 1174.66, 1318.51].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.045);
            gain.gain.setValueAtTime(0.12, now + i * 0.045);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.32);
            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.045);
            osc.stop(now + i * 0.045 + 0.35);
          });
          break;
        }

        case 'win': {
          const notes = [587.33, 739.99, 880.0, 1174.66];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + i * 0.065);
            gain.gain.setValueAtTime(0.14, now + i * 0.065);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.32);
            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.065);
            osc.stop(now + i * 0.065 + 0.34);
          });
          break;
        }

        case 'bigWin': {
          const fanfare = [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0];
          fanfare.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i >= 3 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.075);
            gain.gain.setValueAtTime(0.16, now + i * 0.075);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.075 + 0.48);
            osc.connect(gain);
            gain.connect(out);
            osc.start(now + i * 0.075);
            osc.stop(now + i * 0.075 + 0.5);
          });
          break;
        }
      }
    } catch {
      // Ignore transient audio playback errors
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopMusicLoop();
    try {
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
      }
    } catch {
      // Ignore close error
    }
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }
}
