// Microphone recordings and the explicitly labelled synthetic demo use this same flow.
export async function executeVoiceAudio(audio, { transcribe, execute, onPhase = () => {}, onTranscript = () => {}, isActive = () => true }) {
  try {
    onPhase('transcribing');
    const result = await transcribe(audio);
    if (!isActive()) return null;
    const text = typeof result?.text === 'string' ? result.text.trim() : '';
    if (!text || text.length > 500) throw new Error('음성 인식 결과를 확인하지 못했어요. 다시 말씀해 주세요.');
    onTranscript(text);
    onPhase('applying');
    await execute(text);
    if (isActive()) onPhase('done');
    return text;
  } catch (error) {
    if (isActive()) onPhase('error');
    throw error;
  }
}
