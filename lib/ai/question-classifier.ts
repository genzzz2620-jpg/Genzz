import type { QuestionClassification, QuestionType } from './types';

const rules: Array<{ type: QuestionType; pattern: RegExp; confidence: number }> = [
  { type: 'HR', pattern: /\b(tell me about yourself|why should we hire you|why do you want to join|why this company|what are your strengths|what are your weaknesses|where do you see yourself|walk me through your background)\b/i, confidence: 0.98 },
  { type: 'BEHAVIORAL', pattern: /\b(tell me about a time|describe a time|challenging incident|difficult situation|conflict you handled|mistake you made|how did you handle)\b/i, confidence: 0.96 },
  { type: 'SITUATIONAL', pattern: /\b(what would you do|how would you handle|suppose that|imagine you|if you were faced|hypothetical scenario)\b/i, confidence: 0.94 },
  { type: 'SYSTEM_DESIGN', pattern: /\b(system design|design (a|an) (scalable|distributed|high availability)|architect (a|an)|scalab(?:le|ility)|high availability|load balanc(?:er|ing))\b/i, confidence: 0.96 },
  { type: 'CODING', pattern: /\b(write code|implement (a|an) (function|algorithm)|coding|time complexity|space complexity|data structure|algorithm|sql query|code review)\b/i, confidence: 0.95 },
  { type: 'NETWORKING', pattern: /\b(tcp|udp|ip address|subnet|routing|switching|dns|dhcp|bgp|ospf|firewall|network troubleshooting|network protocol)\b/i, confidence: 0.96 },
  { type: 'DATABASE', pattern: /\b(database|sql|indexing|normalization|query plan|transaction|replication|postgres(?:ql)?|mysql|mongodb|oracle database)\b/i, confidence: 0.95 },
  { type: 'CLOUD', pattern: /\b(aws|azure|google cloud|gcp|cloud computing|cloud architecture|serverless)\b/i, confidence: 0.95 },
  { type: 'SECURITY', pattern: /\b(cybersecurity|security|encryption|authentication|authorization|vulnerability|penetration test|zero trust|incident response)\b/i, confidence: 0.93 },
  { type: 'DEVOPS', pattern: /\b(devops|ci\/cd|continuous integration|continuous deployment|docker|kubernetes|terraform|jenkins|deployment pipeline)\b/i, confidence: 0.94 },
  { type: 'SAP', pattern: /\b(sap|hana|abap|s\/4hana|sap module)\b/i, confidence: 0.96 },
  { type: 'LEADERSHIP', pattern: /\b(leadership|led a team|mentor(?:ed|ing)?|influence without authority|team direction|develop a team)\b/i, confidence: 0.92 },
  { type: 'MANAGERIAL', pattern: /\b(manage stakeholders|prioriti[sz]e (?:a )?team|performance manage|resource planning|manage (?:a )?team|people management)\b/i, confidence: 0.91 },
  { type: 'PROJECT', pattern: /\b(current project|recent project|project you worked|project you built|walk me through (?:a|your) project|project challenge|project architecture)\b/i, confidence: 0.92 },
  { type: 'RESUME_BASED', pattern: /\b(on your resume|in your resume|listed on your cv|your cv|your background|your previous role)\b/i, confidence: 0.9 },
  { type: 'TECHNICAL', pattern: /\b(explain how|how does|how do you configure|troubleshoot|debug|technical|difference between|compare .* and |what is the purpose of)\b/i, confidence: 0.82 },
  { type: 'SCENARIO_BASED', pattern: /\b(scenario|production issue|outage|service disruption|incident scenario)\b/i, confidence: 0.8 },
];

export function classifyInterviewQuestion(question: string): QuestionClassification {
  const normalized = question.trim();
  for (const rule of rules) {
    if (rule.pattern.test(normalized)) return { type: rule.type, confidence: rule.confidence };
  }

  const words = normalized.match(/[a-z0-9]+/gi) || [];
  if (words.length < 3 || !/[?]/.test(normalized)) return { type: 'OTHER', confidence: 0.35 };
  return { type: 'GENERAL', confidence: 0.58 };
}
