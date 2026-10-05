export const questionCategories = [
  'HR', 'Behavioral', 'Technical', 'Managerial', 'Leadership', 'Situational', 'Project',
  'Resume Based', 'Coding', 'System Design', 'Database', 'Networking', 'Cloud', 'Security',
  'DevOps', 'SAP', 'General', 'Other',
] as const;

export const questionDifficulties = ['Easy', 'Medium', 'Hard'] as const;
export const questionExperienceLevels = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'] as const;

export function questionCategoryFromType(type: string) {
  const map: Record<string, string> = {
    HR: 'HR', BEHAVIORAL: 'Behavioral', TECHNICAL: 'Technical', SITUATIONAL: 'Situational',
    PROJECT: 'Project', RESUME_BASED: 'Resume Based', MANAGERIAL: 'Managerial',
    LEADERSHIP: 'Leadership', SCENARIO_BASED: 'Situational', CODING: 'Coding',
    SYSTEM_DESIGN: 'System Design', DATABASE: 'Database', NETWORKING: 'Networking',
    CLOUD: 'Cloud', SECURITY: 'Security', DEVOPS: 'DevOps', SAP: 'SAP', GENERAL: 'General', OTHER: 'Other',
  };
  return map[type] || 'General';
}
