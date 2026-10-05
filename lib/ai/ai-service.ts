import 'server-only';

import { analyzeInterviewQuestion } from './question-analysis';
import { getAnswerStrategy } from './answer-strategy';
import { buildInterviewAnswerPrompt } from './prompt-builder';
import { getAIProvider } from './provider';
import { assembleInterviewContext, trimPreviousAnswers } from './context-builder';
import { classifyInterviewQuestion } from './question-classifier';
import { validatePracticeAnswer } from './response-validator';
import { AIProviderError } from './errors';
import type { AIModel, AnswerGenerationOptions, InterviewAnswerContext } from './types';

export type AIStreamMilestone = { name: string; timestampMs: number; durationMs?: number; questionType?: string };

function prepareAnswer(model: AIModel | string, inputContext: InterviewAnswerContext, options: AnswerGenerationOptions = {}) {
  const context = assembleInterviewContext(inputContext);
  const classification = classifyInterviewQuestion(context.question);
  const analysis = analyzeInterviewQuestion(context.question, classification, context);
  const strategy = getAnswerStrategy(classification.type);
  const previousAnswers = trimPreviousAnswers(options.previousAnswers);
  const provider = getAIProvider(model);
  const prompt = buildInterviewAnswerPrompt(context, classification, analysis, strategy, { ...options, previousAnswers });
  return { context, classification, analysis, provider, prompt };
}

export async function generateInterviewAnswer(
  model: AIModel | string,
  inputContext: InterviewAnswerContext,
  options: AnswerGenerationOptions = {},
) {
  const { context, classification, analysis, provider, prompt } = prepareAnswer(model, inputContext, options);
  const result = await provider.generateText(prompt);
  const answer = result.text.trim();
  if (!answer || answer.length > 20000) {
    throw new AIProviderError('INVALID_RESPONSE');
  }

  return {
    ...result,
    text: answer,
    questionType: classification.type,
    confidence: classification.confidence,
    analysis,
    validationWarnings: validatePracticeAnswer(answer, context, classification),
  };
}

export async function streamInterviewAnswer(
  model: AIModel | string,
  inputContext: InterviewAnswerContext,
  onToken: (token: string) => void,
  onMilestone: (event: AIStreamMilestone) => void,
  signal?: AbortSignal,
  options: AnswerGenerationOptions = {},
) {
  const startedAt = performance.now();
  const mark = (name: string, durationMs?: number, questionType?: string) => onMilestone({ name, timestampMs: performance.now() - startedAt, ...(durationMs === undefined ? {} : { durationMs }), ...(questionType ? { questionType } : {}) });

  mark('classificationStarted');
  const classificationStarted = performance.now();
  const classification = classifyInterviewQuestion(inputContext.question.trim());
  mark('classificationCompleted', performance.now() - classificationStarted, classification.type);

  mark('contextStarted');
  const contextStarted = performance.now();
  // Context is already session scoped and loaded with desktop authentication; keep only the relevant excerpts.
  const preparedContext = assembleInterviewContext(inputContext);
  const analysis = analyzeInterviewQuestion(preparedContext.question, classification, preparedContext);
  const strategy = getAnswerStrategy(classification.type);
  mark('contextCompleted', performance.now() - contextStarted);
  const previousAnswers = trimPreviousAnswers(options.previousAnswers);
  const provider = getAIProvider(model);
  const promptStarted = performance.now();
  const prompt = buildInterviewAnswerPrompt(preparedContext, classification, analysis, strategy, { ...options, previousAnswers });
  mark('promptCompleted', performance.now() - promptStarted);
  const aiRequestStartedAt = performance.now();
  mark('aiRequestStarted');

  let firstTokenAt: number | null = null;
  let receivedText = '';
  const result = await provider.streamText(prompt, (token) => {
    receivedText += token;
    if (firstTokenAt === null && receivedText.trim()) {
      firstTokenAt = performance.now();
      mark('firstTokenReceived', firstTokenAt - aiRequestStartedAt);
    }
    onToken(token);
  }, signal);
  const answer = result.text.trim();
  if (!answer || answer.length > 20000) throw new AIProviderError('INVALID_RESPONSE');
  mark('answerCompleted');
  return {
    ...result,
    text: answer,
    questionType: classification.type,
    confidence: classification.confidence,
    analysis,
    validationWarnings: validatePracticeAnswer(answer, preparedContext, classification),
    timings: {
      preparationMs: aiRequestStartedAt - startedAt,
      firstTokenMs: firstTokenAt === null ? null : firstTokenAt - aiRequestStartedAt,
      answerMs: performance.now() - aiRequestStartedAt,
    },
  };
}
