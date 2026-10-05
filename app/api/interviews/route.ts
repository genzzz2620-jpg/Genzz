import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreditServiceError, startBilledSession } from '@/lib/billing/credits';
import { consumeRateLimit } from '@/lib/security/rate-limit';

const companies = [
  'Accenture', 'TCS', 'Infosys', 'Wipro', 'Cognizant', 'Capgemini', 'Deloitte', 'IBM', 'HCLTech',
  'Tech Mahindra', 'LTIMindtree', 'EY', 'KPMG', 'PwC', 'Genpact', 'Amazon', 'Microsoft', 'Google',
  'Oracle', 'SAP', 'Salesforce', 'ServiceNow', 'JPMorgan Chase', 'Goldman Sachs', 'Wells Fargo',
  'HSBC', 'Barclays', 'Morgan Stanley',
];
const experiences = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'];
const answerLengths = ['Short', 'Balanced', 'Long'];
const answerFormats = ['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation'];
const tones = ['Formal', 'Professional', 'Simple', 'Conversational'];
const languages = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'];
const aiModels = ['ChatGPT', 'Gemini'];

const createSessionSchema = z.object({
  company: z.string().trim().min(1).max(120),
  isCustomCompany: z.boolean(),
  jobTitle: z.string().trim().min(1, 'Please enter a job title.').max(120),
  experience: z.enum(['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years']),
  jobDescription: z.string().max(10000).optional().default(''),
  resumeId: z.string().cuid().nullable().optional(),
  answerLength: z.enum(['Short', 'Balanced', 'Long']),
  answerFormat: z.enum(['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation']),
  tone: z.enum(['Formal', 'Professional', 'Simple', 'Conversational']),
  language: z.enum(['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali']),
  technicalDepth: z.enum(['BASIC', 'STANDARD', 'DEEP']).optional().default('STANDARD'),
  aiModel: z.enum(['ChatGPT', 'Gemini']),
  customInstructions: z.string().max(2000).optional().default(''),
});

export async function POST(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to create an interview session.' }, { status: 401 });
  }
  const createLimit = consumeRateLimit(`interview-create:${authSession.user.id}`, 20, 60_000);
  if (!createLimit.allowed) {
    return NextResponse.json({ error: 'Too many interview sessions started. Please wait before trying again.' }, { status: 429, headers: { 'Retry-After': String(createLimit.retryAfterSeconds) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] || 'form');
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return NextResponse.json({ error: 'Please review the highlighted fields.', fieldErrors }, { status: 400 });
  }

  const data = parsed.data;
  if (data.isCustomCompany ? !data.company.trim() : !companies.includes(data.company)) {
    return NextResponse.json({ error: 'Please select a valid company or provide a custom company name.', fieldErrors: { company: 'Please select a company.' } }, { status: 400 });
  }
  if (!experiences.includes(data.experience) || !answerLengths.includes(data.answerLength) || !answerFormats.includes(data.answerFormat) || !tones.includes(data.tone) || !languages.includes(data.language) || !aiModels.includes(data.aiModel)) {
    return NextResponse.json({ error: 'One or more selections are invalid.' }, { status: 400 });
  }

  try {
    if (data.resumeId) {
      const ownedResume = await prisma.resume.findFirst({
        where: { id: data.resumeId, userId: authSession.user.id, processingStatus: 'COMPLETED' },
        select: { id: true },
      });
      if (!ownedResume) {
        return NextResponse.json({ error: 'The selected resume is unavailable. Choose one of your resumes.' }, { status: 400 });
      }
    }

    const interviewSession = await prisma.interviewSession.create({
      data: {
        userId: authSession.user.id,
        company: data.company.trim(),
        jobTitle: data.jobTitle.trim(),
        experience: data.experience,
        jobDescription: data.jobDescription || null,
        resumeId: data.resumeId || null,
        answerLength: data.answerLength,
        answerFormat: data.answerFormat,
        tone: data.tone,
        language: data.language,
        technicalDepth: data.technicalDepth,
        aiModel: data.aiModel,
        customInstructions: data.customInstructions || null,
        status: 'DRAFT',
      },
      select: { id: true },
    });

    try { await startBilledSession(authSession.user.id, interviewSession.id); }
    catch (error) {
      await prisma.interviewSession.delete({ where: { id: interviewSession.id } });
      if (error instanceof CreditServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      throw error;
    }

    return NextResponse.json({ id: interviewSession.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CreditServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: 'Unable to create the interview session right now.' }, { status: 500 });
  }
}
