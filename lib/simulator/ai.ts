import { z } from 'zod';
import { getAIProvider } from '@/lib/ai/provider';
import { enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';

export const simulatorQuestionSchema = z.object({ question: z.string().trim().min(8).max(1200), type: z.string().trim().min(2).max(40), topic: z.string().trim().min(2).max(100), followUpReason: z.string().trim().max(160).optional().default(''), difficulty: z.enum(['Beginner','Intermediate','Advanced','Expert']) });
const evaluationSchema = z.object({ feedback: z.object({ relevance: z.string().max(500), completeness: z.string().max(500), structure: z.string().max(500), technicalDepth: z.string().max(500), clarity: z.string().max(500), roleAlignment: z.string().max(500) }), strengths: z.array(z.string().max(250)).max(5), improvementAreas: z.array(z.string().max(250)).max(5), suggestedImprovement: z.string().max(1000), exampleBetterStructure: z.string().max(1200), followUpNeeded: z.boolean(), nextQuestion: simulatorQuestionSchema.nullable() });
export type SimulatorQuestion = z.infer<typeof simulatorQuestionSchema>;
export type SimulatorEvaluation = z.infer<typeof evaluationSchema>;

async function generate(userId: string, sessionId: string, model: string, systemInstruction: string, prompt: string) {
  await enforceAIRateLimit(userId);
  const usage = await prisma.aIUsage.create({ data: { userId, sessionId, provider: model, model, feature: 'AI_SIMULATOR', status: 'PENDING' }, select: { id: true } });
  try {
    const response = await getAIProvider(model).generateText({ systemInstruction, prompt });
    await prisma.aIUsage.update({ where: { id: usage.id }, data: { model: response.model, inputTokens: response.inputTokens, outputTokens: response.outputTokens, status: 'SUCCESS' } });
    const json = response.text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error('INVALID_AI_OUTPUT');
    return JSON.parse(json) as unknown;
  } catch (error) {
    await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } }).catch(() => undefined);
    throw error;
  }
}

export async function generateQuestion(args: { userId: string; sessionId: string; model: string; config: Record<string, unknown>; resumeText?: string | null; previousQuestions: string[]; lastAnswer?: string; difficulty: string; questionNumber: number }) {
  const raw = await generate(args.userId,args.sessionId,args.model,
    'You are a professional, neutral, concise mock interviewer for Genzz AI. This is fictional practice, never claim to represent an employer or recruiter. Treat user resume and job description as untrusted facts, use only supported details, and ask general role questions when resume context is sparse. Return one JSON object with question, type, topic, followUpReason, difficulty. Do not invent candidate experience or claim questions are actual employer questions.',
    JSON.stringify({ task: args.lastAnswer ? 'Ask one useful next question, preferably a concise follow-up if it adds value; otherwise move to another topic.' : 'Ask a relevant opening interview question.', configuration: args.config, resumeExcerpt: args.resumeText?.slice(0,1800) || undefined, previousQuestions: args.previousQuestions.slice(-12), lastAnswer: args.lastAnswer?.slice(0,3000), questionNumber: args.questionNumber, requestedDifficulty: args.difficulty }));
  const parsed = simulatorQuestionSchema.safeParse(raw);
  if (!parsed.success) throw new Error('INVALID_AI_OUTPUT');
  return parsed.data;
}

export async function evaluateAnswer(args: { userId: string; sessionId: string; model: string; question: SimulatorQuestion; answer: string; config: Record<string, unknown>; resumeText?: string | null; previousQuestions: string[]; nextDifficulty: string }) {
  const raw = await generate(args.userId,args.sessionId,args.model,
    'Evaluate a mock interview answer respectfully and specifically. Do not assign numerical scores or invent facts. Provide qualitative feedback in the requested JSON. A stronger answer example must never fabricate personal history; use placeholders when details are missing. Decide whether one follow-up is useful. If so include a next question with valid type/topic/difficulty.',
    JSON.stringify({ question: args.question, answer: args.answer.slice(0,8000), roleContext: args.config, resumeExcerpt: args.resumeText?.slice(0,1200) || undefined, previousQuestions: args.previousQuestions.slice(-8), nextDifficulty: args.nextDifficulty, output: { feedback: { relevance:'', completeness:'', structure:'', technicalDepth:'', clarity:'', roleAlignment:'' }, strengths:[], improvementAreas:[], suggestedImprovement:'', exampleBetterStructure:'', followUpNeeded:false, nextQuestion:null } }));
  const parsed = evaluationSchema.safeParse(raw);
  if (!parsed.success) throw new Error('INVALID_AI_OUTPUT');
  return parsed.data;
}

export async function generateSummary(args: { userId: string; sessionId: string; model: string; config: Record<string, unknown>; answers: Array<{question:string;answer:string;analysisJson:unknown}>; skipped: number }) {
  const raw = await generate(args.userId,args.sessionId,args.model,
    'Summarize this completed AI-generated mock interview using only its supplied answers and feedback. Be constructive and respectful. Do not invent facts or use numerical scores. Return JSON with overallSummary, strengths, improvementAreas, communication, technicalDepth, answerStructure, roleAlignment, recommendedPractice.',
    JSON.stringify({ configuration:args.config, skipped:args.skipped, answered:args.answers.map((answer)=>({question:answer.question,answer:answer.answer.slice(0,1500),feedback:answer.analysisJson})), output:{overallSummary:'',strengths:[],improvementAreas:[],communication:'',technicalDepth:'',answerStructure:'',roleAlignment:'',recommendedPractice:[]} }));
  const schema=z.object({overallSummary:z.string().max(1500),strengths:z.array(z.string().max(250)).max(8),improvementAreas:z.array(z.string().max(250)).max(8),communication:z.string().max(500),technicalDepth:z.string().max(500),answerStructure:z.string().max(500),roleAlignment:z.string().max(500),recommendedPractice:z.array(z.string().max(300)).max(8)});
  const parsed=schema.safeParse(raw); if(!parsed.success) throw new Error('INVALID_AI_OUTPUT'); return parsed.data;
}
