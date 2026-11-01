import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Sliders, Radio, Sparkles, Play, Pause } from 'lucide-react';
import { Language } from '../types';

interface SensoryLabProps {
  lang: Language;
}

export const SensoryLab: React.FC<SensoryLabProps> = ({ lang }) => {
  const isAr = lang === 'ar';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Lab controls
  const [frequency, setFrequency] = useState<number>(44);
  const [harmonics, setHarmonics] = useState<number>(3);
  const [activePreset, setActivePreset] = useState<'pure' | 'drift' | 'pulse'>('drift');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(0.2);

  // Web Audio Context refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  // Wave canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let step = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      step += 0.02 * (frequency / 35);

      // Render 3 flowing harmonic ribbon waves
      const waveCount = harmonics;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        const baseFreq = (frequency * 0.0008) * (1 + w * 0.4);
        const amplitude = (height * 0.22) / (1 + w * 0.35);
        const centerY = height * 0.5;

        // Line styling based on index
        if (w === 0) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.85)'; // cyan
          ctx.lineWidth = 2;
        } else if (w === 1) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)'; // purple
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = 'rgba(244, 244, 245, 0.25)'; // white/slate
          ctx.lineWidth = 1;
        }

        for (let x = 0; x <= width; x += 3) {
          const normalX = x / width;
          // Envelope to pinch at ends for elegance
          const envelope = Math.sin(normalX * Math.PI);
          
          let yOffset = Math.sin(x * baseFreq + step + w) * amplitude * envelope;
          if (activePreset === 'pulse') {
            yOffset *= (1 + 0.3 * Math.sin(step * 2));
          } else if (activePreset === 'drift') {
            yOffset += Math.cos(x * 0.003 - step * 0.7) * (amplitude * 0.35) * envelope;
          }

          const y = centerY + yOffset;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [frequency, harmonics, activePreset]);

  // Audio synthesis handling
  const stopAudio = () => {
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (err) {
        // Ignored if already stopped
      }
    });
    oscillatorsRef.current = [];
    setIsPlayingAudio(false);
  };

  const startAudio = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }

      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Master gain
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(audioVolume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // Filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, ctx.currentTime);
      filter.Q.setValueAtTime(2.5, ctx.currentTime);
      filter.connect(masterGain);

      // Notes (Warm atmospheric pentatonic frequencies)
      const baseFreq = frequency * 2.2; // ~90Hz to 200Hz
      const chordRatios = [1, 1.25, 1.5, 1.875]; // Root, Major 3rd, 5th, Major 7th

      const newOscs: OscillatorNode[] = [];

      chordRatios.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(baseFreq * ratio, ctx.currentTime);

        const oscGain = ctx.createGain();
        // Lower volume for higher harmonics
        oscGain.gain.setValueAtTime(0.18 / (idx + 1), ctx.currentTime);

        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start();
        newOscs.push(osc);
      });

      oscillatorsRef.current = newOscs;
      setIsPlayingAudio(true);
    } catch (e) {
      console.warn('Audio synthesis not supported or blocked:', e);
      setIsPlayingAudio(false);
    }
  };

  const toggleAudio = () => {
    if (isPlayingAudio) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  // Adjust volume live
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(audioVolume, audioCtxRef.current.currentTime, 0.05);
    }
  }, [audioVolume]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const selectPreset = (preset: 'pure' | 'drift' | 'pulse') => {
    setActivePreset(preset);
    if (preset === 'pure') {
      setFrequency(36);
      setHarmonics(2);
    } else if (preset === 'drift') {
      setFrequency(52);
      setHarmonics(3);
    } else {
      setFrequency(68);
      setHarmonics(4);
    }
  };

  return (
    <section id="lab" className="py-24 border-y border-neutral-200 dark:border-neutral-900 bg-neutral-900/40 dark:bg-neutral-950/80 transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-xs uppercase tracking-widest text-cyan-500 font-semibold mb-3">
              {isAr ? 'المختبر التفاعلي' : 'Interactive Sensory Canvas'}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {isAr ? 'محاكاة الترددات الحركية والصوتية' : 'Kinetic & Acoustic Frequency Synthesizer'}
            </h2>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
            {isAr
              ? 'جرّب التناغم الرياضي بين حركة الأمواج التوافقية والتوليد الصوتي الحي المعتمد على خوارزميات رنين Soul-X.'
              : 'Experience real-time harmonic mathematics and live ambient audio synthesis driven by Soul-X resonance algorithms.'}
          </p>
        </div>

        {/* Main Lab Display */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Top Bar of the Canvas */}
          <div className="px-6 py-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span className="text-xs font-mono text-neutral-300 tracking-wider">
                SOUL-X // RESONANCE_LAB
              </span>
              <span className="text-xs text-neutral-500">·</span>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {frequency} Hz
              </span>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => selectPreset('pure')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activePreset === 'pure'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {isAr ? 'نقاء هندسي' : 'Pure Form'}
              </button>
              <button
                type="button"
                onClick={() => selectPreset('drift')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activePreset === 'drift'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {isAr ? 'تدفق مكاني' : 'Spatial Drift'}
              </button>
              <button
                type="button"
                onClick={() => selectPreset('pulse')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  activePreset === 'pulse'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {isAr ? 'نبض هادئ' : 'Ambient Pulse'}
              </button>
            </div>
          </div>

          {/* Interactive Visual Canvas */}
          <div className="relative h-64 sm:h-80 w-full bg-neutral-950 flex items-center justify-center overflow-hidden">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
            />
            {/* Subtle grid backdrop */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]"
            />
          </div>

          {/* Bottom Interactive Controls Panel */}
          <div className="p-6 bg-neutral-900/90 border-t border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Audio Toggle Button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleAudio}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isPlayingAudio
                    ? 'bg-cyan-500 text-neutral-950 font-semibold shadow-[0_0_20px_rgba(6,182,212,0.4)]'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>{isAr ? 'إيقاف الرنين الصوتي' : 'Mute Resonator'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>{isAr ? 'تشغيل الرنين الصوتي الحي' : 'Experience Live Resonator'}</span>
                  </>
                )}
              </button>

              {isPlayingAudio && (
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.02"
                    value={audioVolume}
                    onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                    className="w-16 accent-cyan-400 cursor-pointer"
                    aria-label="Volume"
                  />
                </div>
              )}
            </div>

            {/* Frequency Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-300">
                <span className="font-medium flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-neutral-400" />
                  {isAr ? 'تردد التذبذب' : 'Oscillation Frequency'}
                </span>
                <span className="font-mono text-cyan-400 tabular-nums">{frequency} Hz</span>
              </div>
              <input
                type="range"
                min="20"
                max="90"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 bg-neutral-800 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            {/* Harmonics / Complexity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-300">
                <span className="font-medium flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-neutral-400" />
                  {isAr ? 'طبقات التوافق' : 'Harmonic Layers'}
                </span>
                <span className="font-mono text-neutral-400 tabular-nums">{harmonics} {isAr ? 'طبقات' : 'Ribbons'}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={harmonics}
                onChange={(e) => setHarmonics(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 bg-neutral-800 rounded-lg cursor-pointer h-1.5"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
