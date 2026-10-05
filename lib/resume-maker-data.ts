export type ResumeSection = 'summary' | 'experience' | 'skills' | 'projects' | 'education' | 'certifications' | 'achievements' | 'languages' | 'additionalInfo';
export type ResumeContent = {
  personal: { fullName: string; email: string; phone: string; location: string; linkedin: string; github: string; portfolio: string };
  summary: string;
  experience: Array<{ id: string; company: string; jobTitle: string; location: string; startDate: string; endDate: string; current: boolean; responsibilities: string; achievements: string; technologies: string }>;
  skills: Array<{ id: string; category: string; skills: string }>;
  projects: Array<{ id: string; name: string; role: string; description: string; technologies: string; responsibilities: string; achievements: string }>;
  education: Array<{ id: string; degree: string; institution: string; location: string; startYear: string; endYear: string; grade: string }>;
  certifications: Array<{ id: string; name: string; organization: string; date: string; credentialId: string; credentialUrl: string }>;
  achievements: Array<{ id: string; name: string; description: string; date: string }>;
  languages: Array<{ id: string; name: string; proficiency: string }>;
  additionalInfo: string;
  sectionOrder: ResumeSection[];
};

export function emptyResumeContent(): ResumeContent {
  return {
    personal: { fullName: '', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
    summary: '', experience: [], skills: [], projects: [], education: [], certifications: [], achievements: [], languages: [], additionalInfo: '',
    sectionOrder: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'achievements', 'languages', 'additionalInfo'],
  };
}

export const resumeSectionTitles: Record<ResumeSection, string> = {
  summary: 'Professional Summary', experience: 'Work Experience', skills: 'Skills', projects: 'Projects', education: 'Education',
  certifications: 'Certifications', achievements: 'Achievements', languages: 'Languages', additionalInfo: 'Additional Information',
};
