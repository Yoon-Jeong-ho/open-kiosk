import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeVoiceAudio } from '../public/js/voice-flow.js';

test('audio recognition automatically applies one request without a keyboard send step', async () => {
  const audio = new Blob(['synthetic test audio'], { type: 'audio/mpeg' }); const events = []; const requests = [];
  const text = await executeVoiceAudio(audio, {
    transcribe: async (input) => { assert.equal(input, audio); return { text: ' 아이스 아메리카노 두 잔 주세요. ' }; },
    onTranscript: (value) => events.push(['heard', value]), onPhase: (phase) => events.push(phase),
    execute: async (value) => { requests.push(value); },
  });
  assert.equal(text, '아이스 아메리카노 두 잔 주세요.');
  assert.deepEqual(requests, [text]);
  assert.deepEqual(events, ['transcribing', ['heard', text], 'applying', 'done']);
});
test('failed or empty speech recognition never submits an order or reports success', async () => {
  for (const transcribe of [async () => { throw new Error('unavailable'); }, async () => ({ text: '' })]) {
    let submitted = false; const phases = [];
    await assert.rejects(executeVoiceAudio(new Blob(), { transcribe, execute: async () => { submitted = true; }, onPhase: (p) => phases.push(p) }));
    assert.equal(submitted, false); assert.equal(phases.at(-1), 'error'); assert.ok(!phases.includes('done'));
  }
});
test('leaving the voice screen during transcription does not submit a late order', async () => {
  let submitted = false;
  const result = await executeVoiceAudio(new Blob(), { transcribe: async () => ({ text: '아메리카노 두 잔' }), execute: async () => { submitted = true; }, isActive: () => false });
  assert.equal(result, null); assert.equal(submitted, false);
});
