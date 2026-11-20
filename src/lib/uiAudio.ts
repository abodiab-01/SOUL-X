let sharedAudioCtx: AudioContext | null = null;
let audioUnlockInstalled = false;
let lastChimeAt = 0;
let lastNavClickAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function unlockUiAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function initUiAudio(): void {
  if (typeof window === 'undefined' || audioUnlockInstalled) return;
  audioUnlockInstalled = true;

  const handleUnlock = () => {
    unlockUiAudio();
  };

  window.addEventListener('pointerdown', handleUnlock, { passive: true });
  window.addEventListener('keydown', handleUnlock, { passive: true });
  window.addEventListener('touchstart', handleUnlock, { passive: true });
}

/**
 * Plays a gentle two-note crystalline chime when receiving a message or notification.
 * Includes a 450ms cooldown so duplicate real-time events never stack.
 */
export function playIncomingMessageChime(): void {
  const nowMs = Date.now();
  if (nowMs - lastChimeAt < 450) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') return;

  lastChimeAt = nowMs;

  try {
    const t0 = ctx.currentTime + 0.005;

    // First note (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, t0);
    gain1.gain.setValueAtTime(0.0001, t0);
    gain1.gain.linearRampToValueAtTime(0.07, t0 + 0.014);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t0);
    osc1.stop(t0 + 0.17);

    // Second note (A5)
    const t1 = t0 + 0.085;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, t1);
    gain2.gain.setValueAtTime(0.0001, t1);
    gain2.gain.linearRampToValueAtTime(0.065, t1 + 0.014);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t1);
    osc2.stop(t1 + 0.23);
  } catch {
    // Ignore Web Audio scheduling errors safely
  }
}

/**
 * Plays a soft, subtle tactile click when navigating across tabs, views, and pages.
 * Includes a 55ms cooldown to stay crisp and clean.
 */
export function playNavClick(): void {
  const nowMs = Date.now();
  if (nowMs - lastNavClickAt < 55) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') return;

  lastNavClickAt = nowMs;

  try {
    const t0 = ctx.currentTime + 0.002;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t0);
    osc.frequency.exponentialRampToValueAtTime(280, t0 + 0.022);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.032, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.024);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.026);
  } catch {
    // Ignore Web Audio scheduling errors safely
  }
}
