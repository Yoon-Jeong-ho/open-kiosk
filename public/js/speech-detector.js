// Local energy-based utterance segmentation. Silence is never uploaded.
export class SpeechDetector {
  constructor({ sampleRate = 48000, silenceMs = 2000, maxMs = 20000, onStart = () => {}, onAudio = () => {}, onIdle = () => {} } = {}) {
    Object.assign(this, { sampleRate, silenceMs, maxMs, onStart, onAudio, onIdle });
    this.paused = true; this.noise = .003; this.reset();
  }
  reset() { this.pre = []; this.preMs = 0; this.frames = []; this.active = false; this.onset = 0; this.quiet = 0; this.duration = 0; this.voiced = 0; }
  pause() { this.paused = true; this.reset(); }
  resume() { this.paused = false; this.reset(); }
  push(samples) {
    if (this.paused || !samples.length) return;
    const ms = samples.length / this.sampleRate * 1000;
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const loud = rms > Math.max(.015, this.noise * 3);
    if (!this.active) {
      if (!loud) this.noise = this.noise * .98 + Math.min(rms, .03) * .02;
      this.pre.push(samples.slice()); this.preMs += ms;
      while (this.preMs > 450 && this.pre.length > 1) this.preMs -= this.pre.shift().length / this.sampleRate * 1000;
      this.onset = loud ? this.onset + ms : 0;
      if (this.onset < 140) return;
      this.active = true; this.frames = this.pre; this.pre = []; this.duration = this.preMs; this.voiced = this.onset; this.quiet = 0; this.onStart();
      return;
    }
    this.frames.push(samples.slice()); this.duration += ms;
    if (loud) { this.voiced += ms; this.quiet = 0; } else this.quiet += ms;
    if (this.quiet >= this.silenceMs || this.duration >= this.maxMs) {
      const frames = this.frames, voiced = this.voiced;
      this.pause(); // The caller must resume after interpretation and spoken feedback.
      if (voiced >= 180) this.onAudio(pcmWav(frames, this.sampleRate));
      else { this.resume(); this.onIdle(); }
    }
  }
}

export function pcmWav(frames, sampleRate) {
  const count = frames.reduce((sum, frame) => sum + frame.length, 0);
  const bytes = new ArrayBuffer(44 + count * 2), view = new DataView(bytes);
  const text = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, count * 2, true);
  let offset = 44;
  for (const frame of frames) for (const value of frame) { const bounded = Math.max(-1, Math.min(1, value)); view.setInt16(offset, bounded * (bounded < 0 ? 32768 : 32767), true); offset += 2; }
  return new Blob([bytes], { type: 'audio/wav' });
}
