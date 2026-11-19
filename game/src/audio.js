// Palmar Bay — all sound is synthesized with WebAudio: the engine, the
// sirens, the gunshots, the radio. No audio files, no network. The context
// starts on the first user gesture, and M mutes everything.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    // Shared noise buffer for gunshots, skids and hi-hats.
    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    // Engine: two detuned saws through a lowpass, always running.
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // Siren: one oscillator whose pitch flips between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();

    this.startMusic();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.9;
    // Unmuting after the tab was hidden: a suspended context stays silent
    // until it is resumed, so resume it here.
    if (!muted && this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Called every frame: engine follows the car, siren follows the police.
  update(dt, { driving, speed01, siren }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const target = driving ? 0.05 + speed01 * 0.075 : 0.012;
    this.engineGain.gain.setTargetAtTime(target, now, 0.1);
    const freq = 52 + speed01 * 95;
    this.engineOsc1.frequency.setTargetAtTime(freq, now, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(320 + speed01 * 900, now, 0.1);
    if (siren) {
      this.sirenPhase += dt;
      const tone = Math.floor(this.sirenPhase / 0.42) % 2 === 0 ? 715 : 950;
      this.sirenOsc.frequency.setTargetAtTime(tone, now, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.045, now, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.2);
    }
  }

  blip(freq, duration, type = 'sine', volume = 0.16, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration, filterFreq, volume = 0.3, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
    source.stop(t + duration + 0.02);
  }

  gunshot() {
    this.noiseBurst(0.14, 1800, 0.32, 'bandpass');
    this.blip(140, 0.12, 'sine', 0.22);
  }

  pickup() {
    this.blip(880, 0.12);
    this.blip(1318, 0.18, 'sine', 0.16, 0.09);
  }

  missionJingle() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.18, i * 0.12));
  }

  horn() {
    this.blip(370, 0.35, 'sawtooth', 0.1);
    this.blip(466, 0.35, 'sawtooth', 0.1);
  }

  // A lazy sunset loop: Am – F – C – G pads with a soft bass and a hat.
  startMusic() {
    if (this.musicTimer) return;
    const chords = [
      [220, 261.6, 329.6], // Am
      [174.6, 220, 261.6], // F
      [196, 261.6, 329.6], // C/G-ish
      [196, 246.9, 293.7], // G
    ];
    const bass = [110, 87.3, 130.8, 98];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const step = this.musicStep % 4;
      const chord = chords[step];
      const t = this.ctx.currentTime + 0.05;
      chord.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.035, t + 0.4);
        gain.gain.linearRampToValueAtTime(0.0001, t + 1.9);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 2);
      });
      const bOsc = this.ctx.createOscillator();
      bOsc.type = 'sine';
      bOsc.frequency.value = bass[step];
      const bGain = this.ctx.createGain();
      bGain.gain.setValueAtTime(0.0001, t);
      bGain.gain.linearRampToValueAtTime(0.07, t + 0.1);
      bGain.gain.linearRampToValueAtTime(0.0001, t + 1.9);
      bOsc.connect(bGain);
      bGain.connect(this.master);
      bOsc.start(t);
      bOsc.stop(t + 2);
      this.musicStep++;
    }, 2000);
  }
}
