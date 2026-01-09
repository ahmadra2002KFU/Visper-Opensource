type SoundType = 'start' | 'stop' | 'success' | 'error';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Soft, gentle click sound
function playClickSound(ctx: AudioContext, frequency: number, volume: number = 0.08) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

// Soft two-tone chime
function playChimeSound(ctx: AudioContext, freq1: number, freq2: number, volume: number = 0.06) {
  // First tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq1, ctx.currentTime);
  gain1.gain.setValueAtTime(volume, ctx.currentTime);
  gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(ctx.currentTime);
  osc1.stop(ctx.currentTime + 0.15);

  // Second tone (delayed)
  setTimeout(() => {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq2, ctx.currentTime);
    gain2.gain.setValueAtTime(volume, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.18);
  }, 80);
}

export function playSound(type: SoundType): void {
  try {
    const ctx = getAudioContext();

    switch (type) {
      case 'start':
        // Gentle ascending click - soft "pop"
        playClickSound(ctx, 880, 0.07);
        break;

      case 'stop':
        // Gentle descending click
        playClickSound(ctx, 660, 0.07);
        break;

      case 'success':
        // Soft pleasant two-note chime (C6 -> E6)
        playChimeSound(ctx, 1047, 1319, 0.05);
        break;

      case 'error':
        // Soft low tone
        playClickSound(ctx, 330, 0.06);
        break;
    }
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

export function playSoundIfEnabled(type: SoundType, enabled: boolean): void {
  if (enabled) {
    playSound(type);
  }
}
