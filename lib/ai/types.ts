export type AIModel = 'ChatGPT' | 'Gemini';

export const questionTypes = [
  'HR', 'BEHAVIORAL', 'TECHNICAL', 'SITUATIONAL', 'PROJECT', 'RESUME_BASED',
  'MANAGERIAL', 'LEADERSHIP', 'SCENARIO_BASED', 'CODING', 'SYSTEM_DESIGN',
  'DATABASE', 'NETWORKING', 'CLOUD', 'SECURITY', 'DEVOPS', 'SAP', 'GENERAL', 'OTHER',
] as const;

export type QuestionType = typeof questionTypes[number];

export type QuestionClassification = {
  type: QuestionType;
  confidence: number;
};

export type QuestionAnalysis = {
  requiresExample: boolean;
  requiresResumeContext: boolean;
  requiresJobDescription: boolean;
  requiresTechnicalDepth: boolean;
  requiresComparison: boolean;
  requiresProcess: boolean;
};

export type AIProviderRequest = {
  systemInstruction: string;
  prompt: string;
};

export type AIProviderResponse = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export interface AIProvider {
  generateText(request: AIProviderRequest): Promise<AIProviderResponse>;
  streamText(request: AIProviderRequest, onToken: (token: string) => void, signal?: AbortSignal): Promise<AIProviderResponse>;
}

export type InterviewAnswerContext = {
  question: string;
  company: string;
  jobTitle: string;
  experience: string | null;
  jobDescription: string | null;
  resumeText: string | null;
  answerLength: string;
  answerFormat: string;
  tone: string;
  language: string;
  technicalDepth: string;
  customInstructions: string | null;
};

export type AnswerGenerationOptions = {
  action?: string;
  previousAnswers?: string[];
};
