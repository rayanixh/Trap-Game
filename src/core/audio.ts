/**
 * All audio is synthesised at runtime, so the game ships with no sound files.
 * The context is created lazily on the first user gesture (browser policy).
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  muted = false;

  private ensure(): boolean {
    if (this.muted) return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  unlock(): void {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private tone(opts: {
    freq: number;
    to?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
  }): void {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.dur ?? 0.16;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type ?? "triangle";
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    const peak = opts.gain ?? 0.3;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(dur = 0.2, gainValue = 0.25, hp = 400): void {
    if (!this.ensure() || !this.ctx || !this.master) return;
    if (!this.noiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  jump(): void {
    this.tone({ freq: 330, to: 640, dur: 0.16, type: "square", gain: 0.12 });
  }

  land(): void {
    this.noise(0.12, 0.12, 900);
    this.tone({ freq: 120, to: 70, dur: 0.1, type: "sine", gain: 0.16 });
  }

  coin(streak = 0): void {
    const base = 880 * Math.pow(1.0595, Math.min(streak, 12));
    this.tone({ freq: base, dur: 0.09, type: "square", gain: 0.1 });
    this.tone({ freq: base * 1.5, dur: 0.12, type: "square", gain: 0.08, delay: 0.055 });
  }

  gem(): void {
    [660, 880, 1180].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.14, type: "triangle", gain: 0.12, delay: i * 0.06 }),
    );
  }

  key(): void {
    [520, 780].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.18, type: "sawtooth", gain: 0.09, delay: i * 0.08 }),
    );
  }

  hurt(): void {
    this.noise(0.22, 0.3, 200);
    this.tone({ freq: 240, to: 90, dur: 0.26, type: "sawtooth", gain: 0.2 });
  }

  die(): void {
    this.tone({ freq: 420, to: 60, dur: 0.7, type: "square", gain: 0.2 });
    this.noise(0.5, 0.18, 300);
  }

  checkpoint(): void {
    [523, 659, 784].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.26, type: "sine", gain: 0.12, delay: i * 0.09 }),
    );
  }

  door(): void {
    this.tone({ freq: 180, to: 520, dur: 0.5, type: "triangle", gain: 0.16 });
  }

  complete(): void {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.42, type: "triangle", gain: 0.14, delay: i * 0.13 }),
    );
  }

  ui(): void {
    this.tone({ freq: 520, dur: 0.07, type: "square", gain: 0.08 });
  }

  deny(): void {
    this.tone({ freq: 200, to: 150, dur: 0.16, type: "square", gain: 0.12 });
  }
}
