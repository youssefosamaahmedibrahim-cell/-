/**
 * جو صوتي مولّد بالكامل بـ WebAudio — من غير أي ملفات صوتية
 */
export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.timer = null;
    this.nodes = [];
  }

  _noiseBuffer(ctx, seconds = 3) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    return buf;
  }

  async enable() {
    if (this.enabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const ctx = this.ctx;
    this.enabled = true;

    // لو الجراف مبني بالفعل → رجّع الصوت بس
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
      this._scheduleChime();
      return;
    }

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // ---------- درون منخفض ----------
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.055;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    lp.Q.value = 3;
    droneGain.connect(lp).connect(master);

    [55, 55.35, 82.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.36 : 0.24;
      o.connect(g).connect(droneGain);
      o.start();
      this.nodes.push(o);
    });

    // ---------- رياح / همس ----------
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(ctx, 4);
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.07;
    noise.connect(bp).connect(windGain).connect(master);
    noise.start();
    this.nodes.push(noise);

    // LFO للرياح
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.045;
    lfo.connect(lfoGain).connect(windGain.gain);
    lfo.start();
    this.nodes.push(lfo);

    // ---------- باد هادئ ----------
    const padGain = ctx.createGain();
    padGain.gain.value = 0.012;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padGain.connect(padFilter).connect(master);
    [220, 329.6, 440].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      o.connect(padGain);
      o.start();
      this.nodes.push(o);
    });

    // fade in
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2);

    this._scheduleChime();
  }

  _scheduleChime() {
    if (!this.enabled) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const play = () => {
      if (!this.enabled || !this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const f = notes[Math.floor(Math.random() * notes.length)];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) {
        p.pan.value = Math.random() * 1.4 - 0.7;
        o.connect(g).connect(p).connect(this.master);
      } else {
        o.connect(g).connect(this.master);
      }
      o.start(t0);
      o.stop(t0 + 3.6);

      // صدى خفيف
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = f * 1.5;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t0 + 0.02);
      g2.gain.linearRampToValueAtTime(0.016, t0 + 0.1);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
      o2.connect(g2).connect(this.master);
      o2.start(t0 + 0.02);
      o2.stop(t0 + 2.4);

      this.timer = setTimeout(play, 5200 + Math.random() * 7000);
    };
    this.timer = setTimeout(play, 1800);
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
    }
  }

  toggle() {
    if (this.enabled) { this.disable(); return false; }
    this.enable();
    return true;
  }
}
