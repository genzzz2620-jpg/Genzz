'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type ResumeOption = {
  id: string;
  fileName: string;
  fileType: string | null;
  createdAt: string;
};

type FormValues = {
  company: string;
  customCompany: string;
  jobTitle: string;
  experience: string;
  jobDescription: string;
  resumeId: string;
  answerLength: string;
  answerFormat: string;
  tone: string;
  language: string;
  technicalDepth: string;
  aiModel: string;
  customInstructions: string;
};

type CreateSessionFormProps = {
  resumes: ResumeOption[];
  defaults?: {
    targetRole?: string | null;
    experienceLevel?: string | null;
    preferredLanguage?: string | null;
    preferredAnswerFormat?: string | null;
    preferredAIProvider?: string | null;
  };
};

const companies = [
  'Accenture', 'TCS', 'Infosys', 'Wipro', 'Cognizant', 'Capgemini', 'Deloitte', 'IBM', 'HCLTech',
  'Tech Mahindra', 'LTIMindtree', 'EY', 'KPMG', 'PwC', 'Genpact', 'Amazon', 'Microsoft', 'Google',
  'Oracle', 'SAP', 'Salesforce', 'ServiceNow', 'JPMorgan Chase', 'Goldman Sachs', 'Wells Fargo',
  'HSBC', 'Barclays', 'Morgan Stanley',
];

const experienceOptions = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'];
const answerLengthOptions = [
  { value: 'Short', description: '2-4 sentences' },
  { value: 'Balanced', description: '5-8 sentences' },
  { value: 'Long', description: 'Detailed response' },
];
const answerFormatOptions = [
  { value: 'Normal', description: 'Natural interview answer' },
  { value: 'Bullet Points', description: 'Concise bullet-based answer' },
  { value: 'Script', description: 'Natural spoken response' },
  { value: 'STAR', description: 'Situation, Task, Action, Result' },
  { value: 'Technical Explanation', description: 'Direct explanation with examples' },
];
const toneOptions = ['Formal', 'Professional', 'Simple', 'Conversational'];
const languageOptions = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'];
const aiModelOptions = ['ChatGPT', 'Gemini'];

const initialValues: FormValues = {
  company: '',
  customCompany: '',
  jobTitle: '',
  experience: '',
  jobDescription: '',
  resumeId: '',
  answerLength: 'Balanced',
  answerFormat: 'Normal',
  tone: 'Professional',
  language: 'English',
  technicalDepth: 'STANDARD',
  aiModel: 'ChatGPT',
  customInstructions: '',
};

export function CreateSessionForm({ resumes, defaults }: CreateSessionFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(() => ({
    ...initialValues,
    jobTitle: defaults?.targetRole || initialValues.jobTitle,
    experience: defaults?.experienceLevel || initialValues.experience,
    language: defaults?.preferredLanguage || initialValues.language,
    answerFormat: defaults?.preferredAnswerFormat || initialValues.answerFormat,
    aiModel: defaults?.preferredAIProvider || initialValues.aiModel,
  }));
  const [companySearch, setCompanySearch] = useState('');
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredCompanies = useMemo(() => {
    const search = companySearch.trim().toLowerCase();
    return companies.filter((company) => company.toLowerCase().includes(search));
  }, [companySearch]);

  const selectedCompany = isCustomCompany ? values.customCompany : values.company;
  const selectedResume = resumes.find((resume) => resume.id === values.resumeId);

  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
    setSubmitError('');
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!(isCustomCompany ? values.customCompany.trim() : values.company)) {
      nextErrors.company = isCustomCompany ? 'Please enter a company name.' : 'Please select a company.';
    }
    if (!values.jobTitle.trim()) nextErrors.jobTitle = 'Please enter a job title.';
    if (!values.experience) nextErrors.experience = 'Please select your experience.';
    if (!values.answerLength) nextErrors.answerLength = 'Please select an answer length.';
    if (!values.answerFormat) nextErrors.answerFormat = 'Please select an answer format.';
    if (!values.tone) nextErrors.tone = 'Please select a tone.';
    if (!values.language) nextErrors.language = 'Please select a language.';
    if (!values.aiModel) nextErrors.aiModel = 'Please select an AI model.';
    if (values.jobTitle.length > 120) nextErrors.jobTitle = 'Job title must be 120 characters or fewer.';
    if (values.jobDescription.length > 10000) nextErrors.jobDescription = 'Job description must be 10,000 characters or fewer.';
    if (values.customInstructions.length > 2000) nextErrors.customInstructions = 'Instructions must be 2,000 characters or fewer.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: isCustomCompany ? values.customCompany.trim() : values.company,
          isCustomCompany,
          jobTitle: values.jobTitle,
          experience: values.experience,
          jobDescription: values.jobDescription,
          resumeId: values.resumeId || null,
          answerLength: values.answerLength,
          answerFormat: values.answerFormat,
          tone: values.tone,
          language: values.language,
          technicalDepth: values.technicalDepth,
          aiModel: values.aiModel,
          customInstructions: values.customInstructions,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        throw new Error(result.error || 'Unable to create the interview session.');
      }
      router.push(`/interviews/${result.id}?created=1`);
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create the interview session.');
      setIsSubmitting(false);
    }
  };

  const fieldError = (field: string) => errors[field] ? <p className="mt-1 text-sm text-rose-300">{errors[field]}</p> : null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.22em] text-violet-300">Interview setup</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Create Interview Session</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
          <div className="space-y-6">
            <section className="card">
              <h2 className="text-xl font-semibold text-white">Company</h2>
              <div className="mt-4">
                <label className="label" htmlFor="company-search">Search companies</label>
                <input id="company-search" className="input" value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Search company..." />
              </div>
              {isCustomCompany ? (
                <div className="mt-4">
                  <label className="label" htmlFor="custom-company">Company name</label>
                  <input id="custom-company" className="input" value={values.customCompany} onChange={(event) => updateValue('customCompany', event.target.value)} maxLength={120} placeholder="Enter company name" />
                </div>
              ) : (
                <div className="mt-4 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {filteredCompanies.map((company) => (
                    <button key={company} type="button" onClick={() => updateValue('company', company)} aria-pressed={values.company === company} className={`rounded-full border px-3 py-1.5 text-xs transition ${values.company === company ? 'border-violet-400 bg-violet-600 text-white' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-violet-500/40 hover:bg-slate-800'}`}>
                      {company}
                    </button>
                  ))}
                  {filteredCompanies.length === 0 && <p className="text-sm text-slate-400">No matching companies.</p>}
                </div>
              )}
              {fieldError('company')}
              <button type="button" className="btn-secondary mt-4" onClick={() => { setIsCustomCompany((current) => !current); setValues((current) => ({ ...current, company: '', customCompany: '' })); setErrors((current) => ({ ...current, company: '' })); }}>
                {isCustomCompany ? 'Choose Listed Company' : '+ Add Custom Company'}
              </button>
              <p className="mt-3 text-xs text-slate-400">Company selection is for organizing your practice and does not imply endorsement.</p>
            </section>

            <section className="card">
              <h2 className="text-xl font-semibold text-white">Job Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="job-title">Job title</label>
                  <input id="job-title" className="input" value={values.jobTitle} onChange={(event) => updateValue('jobTitle', event.target.value)} maxLength={120} placeholder="Network Engineer" />
                  {fieldError('jobTitle')}
                </div>
                <div>
                  <label className="label" htmlFor="experience">Experience</label>
                  <select id="experience" className="input" value={values.experience} onChange={(event) => updateValue('experience', event.target.value)}>
                    <option value="">Select experience</option>
                    {experienceOptions.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  {fieldError('experience')}
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="label mb-0" htmlFor="job-description">Job description <span className="font-normal text-slate-400">(optional)</span></label>
                  <button type="button" className="text-xs text-slate-400 hover:text-white" onClick={() => updateValue('jobDescription', '')} disabled={!values.jobDescription}>Clear</button>
                </div>
                <textarea id="job-description" className="input mt-2 min-h-[180px] resize-y" value={values.jobDescription} onChange={(event) => updateValue('jobDescription', event.target.value)} maxLength={10000} placeholder="Paste the job description here..." />
                <div className="mt-1 flex justify-between text-xs text-slate-400"><span>Optional. Formatting is retained.</span><span>{values.jobDescription.length}/10000</span></div>
                {fieldError('jobDescription')}
              </div>
            </section>

            <section className="card">
              <h2 className="text-xl font-semibold text-white">Resume</h2>
              <div className="mt-4 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                  <input type="radio" name="resume" checked={!values.resumeId} onChange={() => updateValue('resumeId', '')} className="mt-1 accent-violet-500" />
                  <span><span className="block font-medium text-white">No Resume</span><span className="text-xs text-slate-400">Practice without attaching a resume</span></span>
                </label>
                {resumes.map((resume) => (
                  <label key={resume.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
                    <input type="radio" name="resume" checked={values.resumeId === resume.id} onChange={() => updateValue('resumeId', resume.id)} className="mt-1 accent-violet-500" />
                    <span className="min-w-0"><span className="block break-all font-medium text-white">{resume.fileName}</span><span className="text-xs text-slate-400">{resume.fileType || 'File type unavailable'} · {new Date(resume.createdAt).toLocaleDateString()}</span></span>
                  </label>
                ))}
                {resumes.length === 0 && <div className="rounded-lg border border-dashed border-slate-600 p-4 text-sm text-slate-400">No resumes available. Upload a resume to personalize your interview practice.</div>}
              </div>
              <Link href="/resumes" className="btn-secondary mt-4 inline-flex">Upload Resume</Link>
            </section>

            <section className="card">
              <h2 className="text-xl font-semibold text-white">Answer Preferences</h2>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="label">Answer length</label>
                  <div className="space-y-2">{answerLengthOptions.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><input type="radio" name="answerLength" value={option.value} checked={values.answerLength === option.value} onChange={() => updateValue('answerLength', option.value)} className="mt-1 accent-violet-500" /><span><span className="block">{option.value}</span><span className="text-xs text-slate-400">{option.description}</span></span></label>)}</div>
                  {fieldError('answerLength')}
                </div>
                <div>
                  <label className="label">Answer format</label>
                  <div className="space-y-2">{answerFormatOptions.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><input type="radio" name="answerFormat" value={option.value} checked={values.answerFormat === option.value} onChange={() => updateValue('answerFormat', option.value)} className="mt-1 accent-violet-500" /><span><span className="block">{option.value}</span><span className="text-xs text-slate-400">{option.description}</span></span></label>)}</div>
                  {fieldError('answerFormat')}
                </div>
                <div>
                  <label className="label" htmlFor="tone">Tone</label>
                  <select id="tone" className="input" value={values.tone} onChange={(event) => updateValue('tone', event.target.value)}>{toneOptions.map((tone) => <option key={tone}>{tone}</option>)}</select>
                  {fieldError('tone')}
                </div>
                <div>
                  <label className="label" htmlFor="language">Language</label>
                  <select id="language" className="input" value={values.language} onChange={(event) => updateValue('language', event.target.value)}>{languageOptions.map((language) => <option key={language}>{language}</option>)}</select>
                  {fieldError('language')}
                </div>
                <div>
                  <label className="label" htmlFor="technical-depth">Technical depth</label>
                  <select id="technical-depth" className="input" value={values.technicalDepth} onChange={(event) => updateValue('technicalDepth', event.target.value)}>
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="DEEP">Deep</option>
                  </select>
                </div>
              </div>
              <div className="mt-5">
                <label className="label">AI model <span className="font-normal text-slate-400">(used by Genzz AI for practice answers)</span></label>
                <div className="grid gap-2 md:grid-cols-2">{aiModelOptions.map((model) => <label key={model} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"><input type="radio" name="aiModel" value={model} checked={values.aiModel === model} onChange={() => updateValue('aiModel', model)} className="accent-violet-500" />{model}</label>)}</div>
                {fieldError('aiModel')}
              </div>
              <div className="mt-5">
                <label className="label" htmlFor="custom-instructions">Custom instructions <span className="font-normal text-slate-400">(optional)</span></label>
                <textarea id="custom-instructions" className="input min-h-[130px] resize-y" value={values.customInstructions} onChange={(event) => updateValue('customInstructions', event.target.value)} maxLength={2000} placeholder="Use simple language and give practical examples." />
                <p className="mt-1 text-right text-xs text-slate-400">{values.customInstructions.length}/2000</p>
                {fieldError('customInstructions')}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="card xl:sticky xl:top-6">
              <h2 className="text-xl font-semibold text-white">Session Summary</h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-300">
                <SummaryRow label="Company" value={selectedCompany || 'Not selected'} />
                <SummaryRow label="Job title" value={values.jobTitle || 'Not entered'} />
                <SummaryRow label="Experience" value={values.experience || 'Not selected'} />
                <SummaryRow label="Resume" value={selectedResume?.fileName || 'No Resume'} />
                <SummaryRow label="Language" value={values.language} />
                <SummaryRow label="Answer length" value={values.answerLength} />
                <SummaryRow label="Format" value={values.answerFormat} />
                <SummaryRow label="Tone" value={values.tone} />
                <SummaryRow label="Technical depth" value={values.technicalDepth} />
                <SummaryRow label="AI model" value={values.aiModel} />
                {values.customInstructions && <SummaryRow label="Instructions" value="Added" />}
              </dl>
              {submitError && <div role="alert" className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"><p>{submitError}</p>{submitError.toLowerCase().includes('credits') && <Link className="mt-2 inline-block font-semibold underline" href="/credits">View wallet and buy credits</Link>}</div>}
              <button type="submit" className="btn-primary mt-6 w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Session...' : 'Create Interview Session'}
              </button>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="max-w-[60%] break-words text-right font-medium text-slate-100">{value}</dd></div>;
}
