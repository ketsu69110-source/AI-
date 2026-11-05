export type RecognitionTranscript = {
  finalTranscript: string;
  interimTranscript: string;
};

export type SpeechRecognitionSession = {
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionResultList = {
  length: number;
  [index: number]: RecognitionResult;
};

type RecognitionResultEvent = {
  results: RecognitionResultList;
};

type RecognitionErrorEvent = {
  error: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

export type SpeechRecognitionOptions = {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onStart?: () => void;
  onResult: (transcript: RecognitionTranscript) => void;
  onError: (error: string) => void;
  onEnd?: () => void;
};

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

export function createSpeechRecognition(
  options: SpeechRecognitionOptions,
): SpeechRecognitionSession | null {
  const RecognitionConstructor = getRecognitionConstructor();
  if (!RecognitionConstructor) return null;

  try {
    const recognition = new RecognitionConstructor();
    recognition.lang = options.lang ?? 'ja-JP';
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = options.interimResults ?? true;
    recognition.maxAlternatives = 1;
    recognition.onstart = options.onStart ?? null;
    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      options.onResult({ finalTranscript, interimTranscript });
    };
    recognition.onerror = (event) => options.onError(event.error);
    recognition.onend = options.onEnd ?? null;

    return {
      start: () => recognition.start(),
      stop: () => recognition.stop(),
      abort: () => recognition.abort(),
    };
  } catch {
    return null;
  }
}
