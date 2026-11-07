class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  private muted = false;
  private sfxVolume = 0.85;
  private musicVolume = 0.6;

  private lastDrillTime = 0;
  private isMusicPlaying = false;
  private musicInterval: number | null = null;
  private currentStrataIndex = 0;
  private noteStep = 0;

  public unlock() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupGains();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.isMusicPlaying && !this.muted) {
      this.startMusic();
    }
  }

  private setupGains() {
    if (!this.ctx) return;
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(this.musicVolume * 0.45, this.ctx.currentTime);

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolumes(sfx: number, music: number) {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.musicVolume = Math.max(0, Math.min(1, music));
    if (this.ctx) {
      if (this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      }
      if (this.musicGain) {
        this.musicGain.gain.setValueAtTime(this.musicVolume * 0.45, this.ctx.currentTime);
      }
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  public setStrataMusic(strataIndex: number) {
    this.currentStrataIndex = Math.max(0, Math.min(5, strataIndex));
  }

  public stopMusic() {
    if (this.musicInterval !== null) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    this.isMusicPlaying = false;
  }

  private startMusic() {
    if (this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;

    // Chiptune step sequencer that generates atmospheric procedural music
    this.musicInterval = window.setInterval(() => {
      this.playMusicStep();
    }, 280);
  }

  private playMusicStep() {
    if (this.muted || !this.ctx || this.ctx.state !== 'running' || this.musicVolume <= 0.01) return;

    const ctx = this.ctx;
    const dest = this.musicGain || ctx.destination;

    // Adaptive scales based on depth
    let scale: number[];
    let wave: OscillatorType = 'triangle';
    let bass = 65.41; // C2

    if (this.currentStrataIndex === 0) {
      // Surface Outpost: Pastoral C Major (C4 - D4 - E4 - G4 - A4 - C5)
      scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      bass = 130.81; // C3
      wave = 'triangle';
    } else if (this.currentStrataIndex <= 2) {
      // Ash & Limestone: Echoing D Minor (D3 - F3 - A3 - C4 - D4 - F4)
      scale = [146.83, 174.61, 220.0, 261.63, 293.66, 349.23];
      bass = 73.42; // D2
      wave = 'sine';
    } else if (this.currentStrataIndex <= 4) {
      // Basalt & Obsidian: Dark B Locrian / G Phrygian
      scale = [123.47, 138.59, 164.81, 196.0, 220.0, 246.94];
      bass = 61.74; // B1
      wave = 'sawtooth';
    } else {
      // Sulfured Core: Deep C Minor Sub-Bass Pulse
      scale = [65.41, 77.78, 98.0, 116.54, 130.81, 155.56];
      bass = 32.7; // C1
      wave = 'sawtooth';
    }

    const step = this.noteStep++;

    // Melody Arpeggio note
    if (step % 2 === 0 || this.currentStrataIndex === 0) {
      const noteIdx = (step * 3) % scale.length;
      const freq = scale[noteIdx];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }

    // Heavy Sub-Bass drone every 8 steps
    if (step % 8 === 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = this.currentStrataIndex >= 3 ? 'sawtooth' : 'sine';
      bassOsc.frequency.setValueAtTime(bass, ctx.currentTime);

      bassGain.gain.setValueAtTime(0.08, ctx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      bassOsc.connect(bassGain);
      bassGain.connect(dest);
      bassOsc.start();
      bassOsc.stop(ctx.currentTime + 1.25);
    }
  }

  public playDrillTick(progress: number, blocked = false, drillTier = 1) {
    const now = performance.now();
    if (now - this.lastDrillTime < 62) return;
    this.lastDrillTime = now;

    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (blocked) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    } else {
      // Tier-specific drill sound design!
      if (drillTier === 1) {
        osc.type = 'sawtooth';
        const baseFreq = 95 + progress * 135 + (Math.random() * 18 - 9);
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(baseFreq * 0.78, ctx.currentTime + 0.055);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
      } else if (drillTier === 2) {
        osc.type = 'square';
        const baseFreq = 160 + progress * 210;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(baseFreq * 0.85, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.055, ctx.currentTime);
      } else if (drillTier === 3) {
        osc.type = 'sawtooth';
        const baseFreq = 130 + progress * 260;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
      } else if (drillTier === 4) {
        // Plasma hum
        osc.type = 'triangle';
        const baseFreq = 340 + progress * 320;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
      } else {
        // Solar annihilator chord
        osc.type = 'square';
        const baseFreq = 440 + progress * 440;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
      }
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.058);
    }

    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  public playBlockBreak(isOre = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isOre ? 360 : 180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.095);

    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playComboChime(combo: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    // Pentatonic scale ascending with combo streak!
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    const note = pentatonic[Math.min(pentatonic.length - 1, Math.max(0, combo - 1))];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(note * 1.25, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
  }

  public playOreCollect(oreValue: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const pitchBoost = Math.min(420, Math.log2(Math.max(10, oreValue)) * 55);
    const notes = [520 + pitchBoost, 780 + pitchBoost];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = ctx.currentTime + idx * 0.045;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + 0.095);
    });
  }

  public playSellCash() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = ctx.currentTime + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playUpgrade() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const notes = [392, 493.88, 587.33, 783.99, 987.77];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = ctx.currentTime + idx * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playAchievement() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    // Victorious 8-bit fanfare
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const t = ctx.currentTime + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.23);
    });
  }

  public playSonarPing() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.48);
  }

  public playExplosion() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const bufferSize = Math.floor(ctx.sampleRate * 0.38);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(540, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.36);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start();
  }

  public playHurt() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(55, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.19);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  public playWarp() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  public playBlip(pitch = 1) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime((360 + Math.random() * 60) * pitch, ctx.currentTime);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.045);
  }

  public playUiTick() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.035);
  }

  public playWhoosh(duration = 0.8) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const size = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      const env = Math.sin((i / size) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start();
  }

  public playTorch() {
    const ctx = this.getCtx();
    if (!ctx) return;
    const dest = this.sfxGain || ctx.destination;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }
}

export const sound = new SoundEngine();
