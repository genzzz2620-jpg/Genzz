import type { InterviewAnswerContext, QuestionAnalysis, QuestionClassification } from './types';

const technicalTypes = new Set([
  'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'DATABASE', 'NETWORKING', 'CLOUD', 'SECURITY', 'DEVOPS', 'SAP',
]);

export function analyzeInterviewQuestion(
  question: string,
  classification: QuestionClassification,
  context: InterviewAnswerContext,
): QuestionAnalysis {
  const asksPersonalHistory = /\b(my experience|your experience|my project|your project|my resume|your resume|what have you|tell me about a time)\b/i.test(question);
  const comparison = /\b(difference between|compare|versus|\bvs\.?\b|pros and cons)\b/i.test(question);
  const process = /\b(how do you|how would you|steps to|process for|approach to|walk me through)\b/i.test(question);
  const roleRelevance = /\b(this role|this company|responsibilities|requirements|job description|position|fit for)\b/i.test(question);
  const codingLanguageSpecified = /\b(java|python|javascript|typescript|c\+\+?|sql|abap)\b/i.test(question);

  return {
    requiresExample: ['BEHAVIORAL', 'PROJECT', 'SITUATIONAL', 'SCENARIO_BASED', 'CODING', 'SYSTEM_DESIGN'].includes(classification.type) || comparison,
    requiresResumeContext: Boolean(context.resumeText) && (
      asksPersonalHistory
      || ['PROJECT', 'RESUME_BASED'].includes(classification.type)
      || (classification.type === 'CODING' && !codingLanguageSpecified)
    ),
    requiresJobDescription: Boolean(context.jobDescription) && (
      roleRelevance
      || ['HR', 'PROJECT', 'RESUME_BASED', 'MANAGERIAL', 'LEADERSHIP'].includes(classification.type)
    ),
    requiresTechnicalDepth: technicalTypes.has(classification.type),
    requiresComparison: comparison,
    requiresProcess: process,
  };
}
