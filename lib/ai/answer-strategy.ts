import type { QuestionType } from './types';

const strategies: Record<QuestionType, string> = {
  HR: 'Give a direct, warm, candidate-specific response. Connect the answer to the target role without adding unsupported personal history.',
  BEHAVIORAL: 'Use Situation, Task, Action, Result when the supplied context supports them. Never invent a past event, responsibility, or outcome. If evidence is missing, provide an adaptable practice structure with explicit placeholders.',
  TECHNICAL: 'Start with the direct answer, then explain the reasoning, give a concise example, and mention a practical consideration. Avoid unnecessary depth for a simple question.',
  SITUATIONAL: 'Treat the prompt as hypothetical. Structure the answer around the situation, approach, actions, communication, and expected result; do not describe it as a past event.',
  PROJECT: 'Use only projects, responsibilities, and technologies supported by supplied context. Organize around project, role, technologies, challenge, solution, and result where evidence exists.',
  RESUME_BASED: 'Use only details supported by the supplied resume. If a requested skill or experience is absent, say that the resume does not establish it and offer a truthful way to answer.',
  MANAGERIAL: 'Focus on prioritization, communication, delegation, decision-making, and measurable outcomes only when supported by context.',
  LEADERSHIP: 'Focus on how the candidate aligned people, made decisions, supported others, and learned. Never invent a team, initiative, or result.',
  SCENARIO_BASED: 'Answer as a hypothetical. Explain assessment, safe actions, communication, escalation when appropriate, and how success would be verified.',
  CODING: 'Structure the response as approach, logic, complexity, code only when appropriate, and explanation. Supported examples include Java, Python, JavaScript, TypeScript, C, C++, SQL, and ABAP. Do not assume a programming language unless the question, job context, or resume establishes it.',
  SYSTEM_DESIGN: 'Cover requirements, architecture, components, data flow, storage, scalability, availability, security, monitoring, and trade-offs at the requested depth.',
  DATABASE: 'Give the direct database concept, explain behavior and trade-offs, and use a small practical example when useful.',
  NETWORKING: 'Explain the networking concept directly, then give a practical flow or example and relevant operational considerations.',
  CLOUD: 'Explain the cloud concept and architecture choices with practical trade-offs; do not invent the candidate\'s cloud experience.',
  SECURITY: 'Prioritize threat awareness, least privilege, defense in depth, validation, monitoring, and responsible incident handling where relevant.',
  DEVOPS: 'Focus on automation, repeatability, safe delivery, observability, and rollback or recovery practices where relevant.',
  SAP: 'Explain the SAP concept and its business/process context. Do not invent modules, implementations, or project history.',
  GENERAL: 'Answer the question directly in a clear, natural interview style. Use only supplied personal context for candidate-specific claims.',
  OTHER: 'Do not force a category. Address the question as written, ask for clarification only if necessary, and avoid unsupported personal claims.',
};

export function getAnswerStrategy(type: QuestionType) {
  return strategies[type];
}
