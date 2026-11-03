/**
 * Indian Monopoly - Procedural Web Audio Synthesizer
 * Zero external audio file dependencies. Works offline, on mobile (iOS/Android), and desktop.
 * Handles AudioContext unlocking on user interaction.
 */

type SoundType =
  | 'DICE_ROLL'
  | 'PAWN_STEP'
  | 'BUY_PROPERTY'
  | 'PAY_RENT'
  | 'PASS_START'
  | 'GO_TO_JAIL'
  | 'DRAW_CARD'
  | 'EMOTE'
  | 'BUTTON_CLICK'
  | 'VICTORY';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.5;

  constructor() {
    // Check saved preferences
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('monopoly_sound_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('monopoly_sound_volume');
      if (savedVol !== null) {
        this.masterVolume = Math.max(0, Math.min(1, parseFloat(savedVol)));
      }
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('monopoly_sound_muted', String(muted));
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('monopoly_sound_volume', String(this.masterVolume));
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  /**
   * Primary dispatcher to play sounds.
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
        case 'BUY_PROPERTY':
          this.playBuyProperty(ctx);
          break;
        case 'PAY_RENT':
          this.playPayRent(ctx);
          break;
        case 'PASS_START':
          this.playPassStart(ctx);
          break;
        case 'GO_TO_JAIL':
          this.playGoToJail(ctx);
          break;
        case 'DRAW_CARD':
          this.playDrawCard(ctx);
          break;
        case 'EMOTE':
          this.playEmote(ctx);
          break;
        case 'BUTTON_CLICK':
          this.playButtonClick(ctx);
          break;
        case 'VICTORY':
          this.playVictory(ctx);
          break;
      }
    } catch {
      // Audio play failures on restricted mobile states fail silently
    }
  }

  // --- Procedural Sound Synthesis Algorithms ---

  private playDiceRoll(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Series of quick tumbling thuds
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

  private playBuyProperty(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Ascending celebratory major chord: C5 - E5 - G5 - C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.07);

      gain.gain.setValueAtTime(0, t0 + idx * 0.07);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.3, t0 + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.07 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + idx * 0.07);
      osc.stop(t0 + idx * 0.07 + 0.32);
    });
  }

  private playPayRent(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Descending metallic chime
    const notes = [659.25, 523.25, 392.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.09);

      gain.gain.setValueAtTime(this.masterVolume * 0.25, t0 + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.09 + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + idx * 0.09);
      osc.stop(t0 + idx * 0.09 + 0.22);
    });
  }

  private playPassStart(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Cash register bell + double chime
    const notes = [587.33, 880.0];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.12);

      gain.gain.setValueAtTime(this.masterVolume * 0.35, t0 + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + idx * 0.12);
      osc.stop(t0 + idx * 0.12 + 0.45);
    });
  }

  private playGoToJail(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Heavy low metallic clang
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.4);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.5);
  }

  private playDrawCard(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Card swish filter
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t0);
    osc.frequency.exponentialRampToValueAtTime(250, t0 + 0.08);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.09);
  }

  private playEmote(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Bright bubble pop: sharp pitch sweep upwards
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t0);
    osc.frequency.exponentialRampToValueAtTime(980, t0 + 0.08);

    gain.gain.setValueAtTime(this.masterVolume * 0.25, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  private playButtonClick(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, t0);
    osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.03);

    gain.gain.setValueAtTime(this.masterVolume * 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + 0.04);
  }

  private playVictory(ctx: AudioContext): void {
    const t0 = ctx.currentTime;
    // Fanfare: D4 - G4 - B4 - D5
    const fanfare = [293.66, 392.0, 493.88, 587.33, 783.99];
    fanfare.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const delay = idx * 0.13;
      osc.frequency.setValueAtTime(freq, t0 + delay);

      gain.gain.setValueAtTime(0, t0 + delay);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.35, t0 + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.52);
    });
  }
}

export const sound = new SoundEngine();
