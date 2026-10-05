export type SpeechCallbacks = {
  onTranscript: (transcript: string, confidence: number, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
};

export interface SpeechProvider {
  start(language: string, callbacks: SpeechCallbacks): void;
  stop(): void;
  resetTranscript(): void;
}

type SpeechAlternative = { transcript: string; confidence?: number };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative };
type SpeechResultList = ArrayLike<SpeechResult>;
type SpeechResultEvent = Event & { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = Event & { error: string };
type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type BrowserRecognitionConstructor = new () => BrowserRecognition;

export class BrowserSpeechProvider implements SpeechProvider {
  private recognition: BrowserRecognition | null = null;
  private finalText = '';

  start(language: string, callbacks: SpeechCallbacks) {
    const scope = window as typeof window & { SpeechRecognition?: BrowserRecognitionConstructor; webkitSpeechRecognition?: BrowserRecognitionConstructor };
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) throw new Error('Speech recognition is unavailable in this desktop runtime. You can still type your question.');

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interimText = '';
      let confidence = 1;
      let hasFinal = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const item = event.results[index];
        const text = item[0]?.transcript?.trim() || '';
        if (item.isFinal) {
          hasFinal = true;
          this.finalText = mergeSpeech(this.finalText, text);
          if (typeof item[0]?.confidence === 'number' && item[0].confidence > 0) confidence = Math.min(confidence, item[0].confidence);
        } else interimText = `${interimText} ${text}`.trim();
      }
      callbacks.onTranscript(`${this.finalText} ${interimText}`.trim(), confidence, hasFinal);
    };
    recognition.onerror = (event) => callbacks.onError(event.error);
    recognition.onend = callbacks.onEnd;
    this.recognition = recognition;
    recognition.start();
  }

  stop() {
    const recognition = this.recognition;
    this.recognition = null;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      try { recognition.stop(); } catch { /* Already stopped by the recognition service. */ }
    }
  }

  resetTranscript() { this.finalText = ''; }
}

function mergeSpeech(existing: string, next: string) {
  const left = existing.trim(); const right = next.trim();
  if (!left) return right;
  if (!right || left.toLocaleLowerCase().endsWith(right.toLocaleLowerCase())) return left;
  const leftWords = left.split(/\s+/); const rightWords = right.split(/\s+/);
  for (let overlap = Math.min(leftWords.length, rightWords.length); overlap > 0; overlap -= 1) {
    if (leftWords.slice(-overlap).join(' ').toLocaleLowerCase() === rightWords.slice(0, overlap).join(' ').toLocaleLowerCase()) {
      return [...leftWords, ...rightWords.slice(overlap)].join(' ');
    }
  }
  return `${left} ${right}`;
}

export function createSpeechProvider(): SpeechProvider {
  return new BrowserSpeechProvider();
}
