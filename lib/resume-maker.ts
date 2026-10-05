import { z } from 'zod';
export type { ResumeContent } from './resume-maker-data';

const shortText = (max: number) => z.string().trim().max(max);
const optionalHttpUrl = (max: number) => shortText(max).refine(value => !value || /^https?:\/\//i.test(value) && z.string().url().safeParse(value).success, 'Enter a valid http or https URL, or leave it empty.');
export const resumeContentSchema = z.object({
  personal: z.object({ fullName: shortText(160), email: shortText(254).refine(value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address, or leave it empty.'), phone: shortText(60).refine(value => !value || /^[+()\d.\-\s]+$/.test(value) && (value.match(/\d/g) || []).length >= 7, 'Check the phone number, or leave it empty.'), location: shortText(160), linkedin: optionalHttpUrl(300), github: optionalHttpUrl(300), portfolio: optionalHttpUrl(300) }),
  summary: shortText(5000),
  experience: z.array(z.object({ id: z.string().min(1).max(80), company: shortText(180), jobTitle: shortText(180), location: shortText(160), startDate: shortText(40), endDate: shortText(40), current: z.boolean(), responsibilities: shortText(6000), achievements: shortText(6000), technologies: shortText(2000) })).max(30),
  skills: z.array(z.object({ id: z.string().min(1).max(80), category: shortText(100), skills: shortText(1500) })).max(40),
  projects: z.array(z.object({ id: z.string().min(1).max(80), name: shortText(180), role: shortText(180), description: shortText(4000), technologies: shortText(2000), responsibilities: shortText(4000), achievements: shortText(4000) })).max(30),
  education: z.array(z.object({ id: z.string().min(1).max(80), degree: shortText(180), institution: shortText(180), location: shortText(160), startYear: shortText(20), endYear: shortText(20), grade: shortText(100) })).max(30),
  certifications: z.array(z.object({ id: z.string().min(1).max(80), name: shortText(200), organization: shortText(180), date: shortText(40), credentialId: shortText(160), credentialUrl: optionalHttpUrl(400) })).max(40),
  achievements: z.array(z.object({ id: z.string().min(1).max(80), name: shortText(200), description: shortText(3000), date: shortText(40) })).max(40),
  languages: z.array(z.object({ id: z.string().min(1).max(80), name: shortText(100), proficiency: shortText(100) })).max(30),
  additionalInfo: shortText(5000),
  sectionOrder: z.array(z.enum(['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'achievements', 'languages', 'additionalInfo'])).length(9),
}).refine(value => new Set(value.sectionOrder).size === 9, 'Each resume section must appear once.');

