import type { InterviewAnswerContext } from './types';

const RESUME_TEXT_LIMIT = 12000;
const JOB_DESCRIPTION_LIMIT = 5000;
const INSTRUCTIONS_LIMIT = 2000;
const PREVIOUS_ANSWER_LIMIT = 2400;

function redactDirectContact(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, '[URL removed]');
}

function getFocusTerms(question: string, jobTitle: string) {
  return `${question} ${jobTitle}`.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [];
}

function selectRelevantLines(value: string, terms: string[], maxCharacters: number) {
  const lines = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(0, 1000));
  if (lines.join('\n').length <= maxCharacters) return lines.join('\n');

  const ranked = lines.map((line, index) => {
    const normalized = line.toLowerCase();
    const score = terms.reduce((total, term) => total + (normalized.includes(term) ? Math.min(3, term.length / 5) : 0), 0);
    return { line, index, score };
  });
  const selected = new Set<number>();
  for (const item of [...ranked].sort((left, right) => right.score - left.score || left.index - right.index)) {
    if (item.score > 0) selected.add(item.index);
  }
  if (!selected.size) {
    for (let index = 0; index < lines.length && selected.size < 12; index += 1) selected.add(index);
  }

  const result: string[] = [];
  let used = 0;
  const orderedIndexes = Array.from(selected).sort((left, right) => left - right);
  for (const index of orderedIndexes) {
    const line = lines[index];
    if (used + line.length + 1 > maxCharacters) continue;
    result.push(line);
    used += line.length + 1;
  }
  return result.join('\n');
}

export function assembleInterviewContext(context: InterviewAnswerContext): InterviewAnswerContext {
  const terms = getFocusTerms(context.question, context.jobTitle);
  return {
    ...context,
    question: context.question.trim(),
    resumeText: context.resumeText ? selectRelevantLines(redactDirectContact(context.resumeText), terms, RESUME_TEXT_LIMIT) : null,
    jobDescription: context.jobDescription ? selectRelevantLines(redactDirectContact(context.jobDescription), terms, JOB_DESCRIPTION_LIMIT) : null,
    customInstructions: context.customInstructions?.slice(0, INSTRUCTIONS_LIMIT) || null,
  };
}

export function trimPreviousAnswers(answers: string[] = []) {
  return answers.slice(0, 3).map((answer) => answer.slice(0, PREVIOUS_ANSWER_LIMIT));
}
