import { SpeechDetector } from './speech-detector.js';

export async function openHandsFree({ onStart, onAudio, onIdle, onLevel = () => {}, onError = () => {} }) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.AudioContext || !window.AudioWorkletNode) throw new Error('mic_unavailable');
  let context, stream, source, processor, silent, stopped = false;
  const stop = () => { if (stopped) return; stopped = true; detector?.pause(); processor?.port.close(); source?.disconnect(); processor?.disconnect(); silent?.disconnect(); stream?.getTracks().forEach((track) => track.stop()); context?.close().catch(() => {}); };
  let detector;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    context = new AudioContext();
    await context.resume();
    await context.audioWorklet.addModule('/js/speech-processor.js');
    detector = new SpeechDetector({ sampleRate: context.sampleRate, onStart, onAudio, onIdle });
    source = context.createMediaStreamSource(stream); processor = new AudioWorkletNode(context, 'kiosk-speech'); silent = context.createGain(); silent.gain.value = 0;
    processor.port.onmessage = ({ data }) => {
      if (stopped) return;
      const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length); onLevel(detector.paused ? 0 : Math.min(1, rms * 15)); detector.push(data);
    };
    processor.onprocessorerror = () => { stop(); onError(); };
    for (const track of stream.getAudioTracks()) track.onended = () => { if (!stopped) { stop(); onError(); } };
    context.onstatechange = () => { if (!stopped && ['interrupted', 'suspended'].includes(context.state)) { detector.pause(); onError(); } };
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    return { pause: () => detector.pause(), resume: () => { if (!stopped && context.state === 'running' && detector.paused) detector.resume(); }, stop, isActive: () => !stopped && context.state === 'running' };
  } catch (error) { stop(); throw error; }
}
