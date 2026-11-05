export type SpeechSynthesisCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

export function speakJapanese(
  text: string,
  callbacks: SpeechSynthesisCallbacks = {},
): boolean {
  if (!isSpeechSynthesisSupported()) return false;

  try {
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1;
    utterance.pitch = 1;

    const japaneseVoice = synthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;

    utterance.onstart = callbacks.onStart ?? null;
    utterance.onend = callbacks.onEnd ?? null;
    utterance.onerror = callbacks.onError
      ? () => callbacks.onError?.()
      : null;

    synthesis.cancel();
    synthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeech(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}
