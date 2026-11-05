import type { ConversationEmotion } from '../communication/types';

export type SpeechVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};

export type SpeechVoiceSettings = {
  voiceURI: string;
  speechRate: number;
  speechPitch: number;
};

export type SpeechOutputCallbacks = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

export interface SpeechOutputProvider {
  listJapaneseVoices: () => SpeechVoiceOption[];
  subscribeVoicesChanged: (listener: () => void) => () => void;
  speak: (
    text: string,
    settings: SpeechVoiceSettings,
    emotion: ConversationEmotion,
    callbacks?: SpeechOutputCallbacks,
  ) => boolean;
  stop: () => void;
}

type SpeechSegment = {
  text: string;
  pauseAfter: number;
};

let playbackToken = 0;
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

function japaneseVoiceObjects(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((voice) => /^ja(?:-|_|$)/i.test(voice.lang))
    .sort((left, right) => voiceScore(right) - voiceScore(left));
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const identifyingText = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = voice.default ? 3 : 0;
  if (voice.localService) score += 1;
  if (/enhanced|premium|natural|siri|neural/.test(identifyingText)) score += 5;
  return score;
}

function voiceId(voice: SpeechSynthesisVoice): string {
  return voice.voiceURI || `${voice.lang}:${voice.name}`;
}

function speechSegments(text: string): SpeechSegment[] {
  const sentences = text.match(/[^。！？!?]+[。！？!?]?/gu) ?? [text];
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => {
      const ending = sentence.slice(-1);
      const pauseAfter = ending === '？' || ending === '?'
        ? 420
        : ending === '！' || ending === '!'
          ? 320
          : ending === '。'
            ? 280
            : 180;
      return { text: sentence, pauseAfter };
    });
}

function emotionAdjustments(emotion: ConversationEmotion) {
  switch (emotion) {
    case 'happy':
      return { rate: 0.04, pitch: 0.08, volume: 1 };
    case 'surprised':
      return { rate: 0.02, pitch: 0.12, volume: 1 };
    case 'concerned':
      return { rate: -0.08, pitch: -0.04, volume: 0.94 };
    case 'explanatory':
      return { rate: -0.05, pitch: 0, volume: 0.98 };
    case 'warm':
      return { rate: -0.02, pitch: 0.03, volume: 0.98 };
    default:
      return { rate: 0, pitch: 0, volume: 1 };
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export const browserSpeechOutput: SpeechOutputProvider = {
  listJapaneseVoices() {
    return japaneseVoiceObjects().map((voice) => ({
      voiceURI: voiceId(voice),
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
    }));
  },

  subscribeVoicesChanged(listener) {
    if (!isSpeechSynthesisSupported()) return () => undefined;
    const synthesis = window.speechSynthesis;
    synthesis.addEventListener('voiceschanged', listener);
    return () => synthesis.removeEventListener('voiceschanged', listener);
  },

  speak(text, settings, emotion, callbacks = {}) {
    if (!isSpeechSynthesisSupported()) return false;

    const synthesis = window.speechSynthesis;
    playbackToken += 1;
    const thisPlayback = playbackToken;
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    synthesis.cancel();

    const segments = speechSegments(text);
    if (segments.length === 0) return false;
    const availableVoices = japaneseVoiceObjects();
    const selectedVoice =
      availableVoices.find((voice) => voiceId(voice) === settings.voiceURI) ??
      availableVoices[0];
    const adjustment = emotionAdjustments(emotion);
    const rate = clamp(settings.speechRate + adjustment.rate, 0.75, 1.25);
    const pitch = clamp(settings.speechPitch + adjustment.pitch, 0.8, 1.2);
    let segmentIndex = 0;
    let hasStarted = false;

    const speakNext = () => {
      if (thisPlayback !== playbackToken) return;
      const segment = segments[segmentIndex];
      if (!segment) {
        callbacks.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = 'ja-JP';
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = adjustment.volume;
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onstart = () => {
        if (thisPlayback !== playbackToken || hasStarted) return;
        hasStarted = true;
        callbacks.onStart?.();
      };
      utterance.onend = () => {
        if (thisPlayback !== playbackToken) return;
        segmentIndex += 1;
        if (segmentIndex >= segments.length) {
          callbacks.onEnd?.();
          return;
        }
        pauseTimer = setTimeout(() => {
          pauseTimer = null;
          speakNext();
        }, segment.pauseAfter);
      };
      utterance.onerror = () => {
        if (thisPlayback !== playbackToken) return;
        playbackToken += 1;
        if (pauseTimer) clearTimeout(pauseTimer);
        pauseTimer = null;
        callbacks.onError?.();
      };

      try {
        synthesis.speak(utterance);
      } catch {
        if (thisPlayback === playbackToken) callbacks.onError?.();
      }
    };

    speakNext();
    return true;
  },

  stop() {
    playbackToken += 1;
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  },
};
