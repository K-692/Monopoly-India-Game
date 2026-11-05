/**
 * Indian Monopoly - Procedural Web Audio Synthesizer
 * Zero external audio file dependencies. Works offline, on mobile (iOS/Android), and desktop.
 * Handles AudioContext unlocking on user interaction.
 *
 * Strict Requirement:
 * ONLY keep:
 * 1. Rolling sound ('DICE_ROLL')
 * 2. Players walking sound ('PAWN_STEP')
 * 3. Nice alert tone ('NOTIFICATION')
 * All other sounds are completely removed/silenced.
 */

export type SoundType =
  | 'DICE_ROLL'
  | 'DICE_TICK'
  | 'DICE_LAND'
  | 'PAWN_STEP'
  | 'BUY_PROPERTY'
  | 'PAY_RENT'
  | 'PASS_START'
  | 'GO_TO_JAIL'
  | 'DRAW_CARD'
  | 'EMOTE'
  | 'BUTTON_CLICK'
  | 'VICTORY'
  | 'NOTIFICATION';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.5;

  constructor() {
    // Check saved preferences safely across node and browser
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const savedMute = localStorage.getItem('monopoly_sound_muted');
        if (savedMute !== null) {
          this.isMuted = savedMute === 'true';
        }
        const savedVol = localStorage.getItem('monopoly_sound_volume');
        if (savedVol !== null) {
          this.masterVolume = Math.max(0, Math.min(1, parseFloat(savedVol)));
        }
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  /**
   * Initializes or resumes the AudioContext upon user gesture.
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('monopoly_sound_muted', String(muted));
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('monopoly_sound_volume', String(this.masterVolume));
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Primary dispatcher to play sounds.
   * Only plays rolling sound, players walking sound, and nice alert tone.
   */
  public play(type: SoundType): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      switch (type) {
        case 'DICE_ROLL':
          this.playDiceRoll(ctx);
          break;
        case 'PAWN_STEP':
          this.playPawnStep(ctx);
          break;
        case 'NOTIFICATION':
          this.playNotification(ctx);
          break;
        default:
          // All other sounds intentionally removed:
          // Strictly keep only rolling sound, players walking sound, and nice alert tone.
          break;
      }
    } catch {
      // Audio play failures on restricted mobile states fail silently
    }
  }

  // --- Procedural Sound Synthesis Algorithms ---

  /**
   * 1. Rolling sound: rapid tumbling dice thuds
   */
  private playDiceRoll(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.08 + Math.random() * 0.03;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + Math.random() * 90, t0 + delay);
      osc.frequency.exponentialRampToValueAtTime(45, t0 + delay + 0.06);

      gain.gain.setValueAtTime(this.masterVolume * 0.35, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.07);
    }
  }

  /**
   * 2. Players walking sound: gentle percussive wooden step tap
   */
  private playPawnStep(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, t0);
    osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.05);

    gain.gain.setValueAtTime(this.masterVolume * 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.06);
  }

  /**
   * 3. Nice alert tone: warm, elegant dual-tone chime (E5 -> G#5)
   */
  private playNotification(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    const notes = [
      { freq: 659.25, time: 0, duration: 0.12 }, // E5
      { freq: 830.61, time: 0.08, duration: 0.2 }, // G#5
    ];

    notes.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + time);

      gain.gain.setValueAtTime(0, t0 + time);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.18, t0 + time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + time + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + time);
      osc.stop(t0 + time + duration + 0.02);
    });
  }
}

export const sound = new SoundEngine();
