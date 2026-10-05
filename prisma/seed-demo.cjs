const bcrypt = require('bcryptjs');
const { PrismaClient } = require('./generated/client');

if (process.env.NODE_ENV === 'production') {
  console.error('Demo seed is disabled when NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();
const email = (process.env.DEMO_USER_EMAIL || 'demo@genzz.ai').toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || 'GenzzDemo@123';
const resumeSamples = [
  { fileName: 'Java Developer Resume', text: 'Practice profile: Java developer with experience in Java, Spring Boot, REST APIs, PostgreSQL, automated testing, and production support. These are sample details; personalize answers before use.' },
  { fileName: 'Network Engineer Resume', text: 'Practice profile: network engineer with experience in TCP/IP, routing, switching, DNS, firewalls, monitoring, and incident troubleshooting. These are sample details; personalize answers before use.' },
  { fileName: 'IT Operations Resume', text: 'Practice profile: IT operations professional experienced in incident management, service restoration, stakeholder updates, runbooks, and post-incident reviews. These are sample details; personalize answers before use.' },
];
const sessions = [
  { company: 'Northstar Labs', jobTitle: 'Java Developer Interview', experience: '3-5 Years', resume: 'Java Developer Resume', aiModel: 'ChatGPT', answerLength: 'Balanced', answerFormat: 'STAR', tone: 'Professional', technicalDepth: 'STANDARD', jobDescription: 'Practice role covering Java services, APIs, testing, and production reliability.' },
  { company: 'Vertex Networks', jobTitle: 'Network Engineer Interview', experience: '3-5 Years', resume: 'Network Engineer Resume', aiModel: 'Gemini', answerLength: 'Balanced', answerFormat: 'Technical Explanation', tone: 'Professional', technicalDepth: 'DEEP', jobDescription: 'Practice role covering enterprise networking, TCP/IP, monitoring, and troubleshooting.' },
  { company: 'Cedar Health Systems', jobTitle: 'Major Incident Manager Interview', experience: '6-8 Years', resume: 'IT Operations Resume', aiModel: 'ChatGPT', answerLength: 'Balanced', answerFormat: 'STAR', tone: 'Conversational', technicalDepth: 'STANDARD', jobDescription: 'Practice role covering major incident coordination, restoration, and stakeholder communication.' },
];
const questions = [
  ['Tell me about yourself.', 'HR'], ['Explain your experience with Java.', 'TECHNICAL'],
  ['Can you explain your current project?', 'PROJECT'], ['What are your strengths?', 'HR'],
  ['Explain the difference between TCP and UDP.', 'NETWORKING'],
  ['How would you troubleshoot a production issue?', 'SCENARIO'],
  ['Why should we hire you?', 'HR'], ['How do you handle a critical incident?', 'BEHAVIORAL'],
];

async function main() {
  if (password.length < 8) throw new Error('DEMO_USER_PASSWORD must contain at least 8 characters.');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: 'Genzz AI Demo', passwordHash },
    create: { name: 'Genzz AI Demo', email, passwordHash },
  });
  const resumes = new Map();
  for (const sample of resumeSamples) {
    const existing = await prisma.resume.findFirst({ where: { userId: user.id, fileName: sample.fileName }, select: { id: true } });
    const resume = existing
      ? await prisma.resume.update({ where: { id: existing.id }, data: { extractedText: sample.text, processingStatus: 'COMPLETED', fileType: 'Sample profile' } })
      : await prisma.resume.create({ data: { userId: user.id, fileName: sample.fileName, extractedText: sample.text, processingStatus: 'COMPLETED', fileType: 'Sample profile' } });
    resumes.set(sample.fileName, resume.id);
  }
  for (const sample of sessions) {
    const existing = await prisma.interviewSession.findFirst({ where: { userId: user.id, jobTitle: sample.jobTitle }, select: { id: true } });
    const data = { userId: user.id, company: sample.company, jobTitle: sample.jobTitle, experience: sample.experience,
      resumeId: resumes.get(sample.resume), aiModel: sample.aiModel, answerLength: sample.answerLength,
      answerFormat: sample.answerFormat, tone: sample.tone, technicalDepth: sample.technicalDepth,
      language: 'English', jobDescription: sample.jobDescription, status: 'ACTIVE' };
    if (existing) await prisma.interviewSession.update({ where: { id: existing.id }, data });
    else await prisma.interviewSession.create({ data });
  }
  for (const [question, category] of questions) {
    const existing = await prisma.questionBankItem.findFirst({ where: { userId: user.id, question }, select: { id: true } });
    if (!existing) await prisma.questionBankItem.create({ data: { userId: user.id, question, category, questionType: category, jobRole: 'Interview practice', tags: ['demo', 'practice'] } });
  }
  console.log(`Development demo account ready: ${email}`);
  console.log('Use this account only with a local development database. Demo sessions and sample resume profiles are scoped to this user.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
