import type { InterviewAnswerContext, QuestionClassification } from './types';

const credentialPatterns = [
  /\b(AWS Certified|Azure Certified|Google Cloud Certified|PMP|CCNA|CCNP|CISSP|CISM|OSCP)\b/gi,
];
const metricPattern = /\b\d+(?:\.\d+)?\s?(?:%|percent\b|users?\b|customers?\b|servers?\b|systems?\b|hours?\b|days?\b|weeks?\b|months?\b|years?\b|million\b|thousand\b)/gi;
const technologyClaims = [
  'Kubernetes', 'Docker', 'Terraform', 'AWS', 'Azure', 'GCP', 'SAP HANA', 'ABAP', 'Salesforce', 'ServiceNow',
  'Python', 'Java', 'TypeScript', 'React', 'PostgreSQL', 'MySQL', 'MongoDB', 'TCP/IP', 'BGP', 'Cisco',
];
const companyExperiencePattern = /\b(?:(?:worked|employed|interned)\s+(?:at|for)|consulted\s+for)\s+([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]*){0,3})/g;
const namedProjectPattern = /\b(?:project|initiative|migration|deployment)\s+(?:called|named)\s+["']?([A-Z][A-Za-z0-9&.' -]{1,50})/g;

export function validatePracticeAnswer(answer: string, context: InterviewAnswerContext, classification: QuestionClassification) {
  const warnings = new Set<string>();
  const reference = (context.resumeText || '').toLowerCase();

  if (classification.type === 'OTHER') {
    warnings.add('The question was not confidently classified; review the response for relevance.');
  }

  for (const pattern of credentialPatterns) {
    const matches = answer.match(pattern) || [];
    for (const match of matches) {
      if (!reference.includes(match.toLowerCase())) {
        warnings.add('Check certification claims against your actual credentials.');
      }
    }
  }

  const metrics = answer.match(metricPattern) || [];
  for (const match of metrics) {
    if (!reference.includes(match.toLowerCase())) {
      warnings.add('Check numerical achievements against your actual experience.');
    }
  }

  const companyClaims = answer.match(companyExperiencePattern) || [];
  for (const claim of companyClaims) {
    if (!reference.includes(claim.toLowerCase())) {
      warnings.add('Check employer or client names against your actual work history.');
    }
  }

  const projectClaims = answer.match(namedProjectPattern) || [];
  for (const claim of projectClaims) {
    if (!reference.includes(claim.toLowerCase())) {
      warnings.add('Check named project details against your actual project history.');
    }
  }

  const firstPersonClaim = /\b(?:I have|I had|I led|I built|I managed|I delivered|I implemented|I worked with|my project|my team)\b/i;
  if (!context.resumeText && firstPersonClaim.test(answer) && !/\b(if I|I would|I could|I can|I recommend)\b/i.test(answer)) {
    warnings.add('Personal experience details were not grounded in an attached resume; verify them before using this answer.');
  }

  for (const technology of technologyClaims) {
    const claim = new RegExp(`\\b(?:I have experience with|I worked with|I used|I implemented|I configured|I managed)\\s+(?:the )?${technology.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
    if (claim.test(answer) && !reference.includes(technology.toLowerCase())) {
      warnings.add(`Verify the ${technology} experience claim; it was not found in the supplied resume or job description.`);
    }
  }

  return Array.from(warnings);
}
