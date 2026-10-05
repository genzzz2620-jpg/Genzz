const nonWordPattern = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');

export function normalizeQuestion(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(nonWordPattern, ' ').replace(/\s+/g, ' ').trim();
}

const nonQuestions = new Set(['okay', 'ok', 'yes', 'right', 'thank you', 'thanks', 'lets move on', 'move on']);

export function isLikelyInterviewQuestion(value: string, confidence = 1) {
  const normalized = normalizeQuestion(value);
  const words = normalized.split(' ').filter(Boolean);
  if (confidence < 0.45 || words.length < 3 || normalized.length < 9 || nonQuestions.has(normalized)) return false;
  if (/^(okay|ok|yes|right|thank you|thanks|lets move on)\b/.test(normalized)) return false;
  const sentenceComplete = /[?!.]$/.test(value.trim()) || /[\u0964\u0965\u061f\uff1f]$/.test(value.trim());
  return sentenceComplete
    || /^(who|what|when|where|why|how|which|can|could|would|will|do|does|did|is|are|tell me|describe|explain|walk me through)\b/i.test(value.trim())
    || normalized.length >= 42;
}
