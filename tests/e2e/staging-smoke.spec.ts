import { expect, test, type Page } from '@playwright/test';

let localRegistrationIp = 10 + Math.floor(Math.random() * 200);

async function waitForFormHydration(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return Boolean(form && Object.keys(form).some((key) => key.startsWith('__reactProps$')));
  });
}

async function registerTestUser(page: Page, name: string) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `qa-${unique}@example.test`;
  const password = `QA-Staging-${unique}-Safe!`;
  const target = new URL(process.env.E2E_BASE_URL!);
  if (['localhost', '127.0.0.1', '[::1]'].includes(target.hostname.toLowerCase())) {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${localRegistrationIp++}` });
  }
  await page.goto('/register');
  await waitForFormHydration(page);
  await page.getByPlaceholder('Jane Interviewer').fill(name);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').nth(0).fill(password);
  await page.locator('input[type="password"]').nth(1).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole('button', { name: 'Skip for Now' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return { email, password };
}

function createQaPdf() {
  const stream = 'BT /F1 12 Tf 10 80 Td (Genz QA Resume) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(pdf, 'latin1');
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

test('test-only user can register, skip onboarding, visit core pages, logout, and login again', async ({ page }) => {
  test.setTimeout(60_000);
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  const { email, password } = await registerTestUser(page, 'Genzz Staging QA');
  await expect(page.getByRole('heading', { name: /Welcome back, Genzz Staging QA/ })).toBeVisible();

  for (const route of ['/interviews', '/resume-maker', '/question-bank', '/preparation', '/interview-simulator', '/company-intelligence', '/analytics', '/credits', '/notifications', '/settings']) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} should render successfully`).toBe(200);
  }

  const adminPage = await page.goto('/admin');
  expect(adminPage?.status()).toBe(403);
  const adminApi = await page.request.post('/api/admin/questions', {
    headers: { Origin: appOrigin },
    data: {},
  });
  expect(adminApi.status()).toBe(403);

  const dashboard = await page.goto('/dashboard');
  expect(dashboard?.status()).toBe(200);
  await page.goto('/settings');
  await page.getByLabel('Name', { exact: true }).fill('Genzz Settings QA');
  await page.getByLabel('Target role').fill('Quality Engineer');
  await page.getByLabel('Experience level').selectOption('3-5 Years');
  await page.getByLabel('Preferred language').selectOption('Hindi');
  await page.getByLabel('Default answer format').selectOption('STAR');
  await page.getByLabel('Preferred AI provider').selectOption('');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Settings saved.');
  await page.reload();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Genzz Settings QA');
  await expect(page.getByLabel('Target role')).toHaveValue('Quality Engineer');
  await expect(page.getByLabel('Experience level')).toHaveValue('3-5 Years');
  await expect(page.getByLabel('Preferred language')).toHaveValue('Hindi');
  await expect(page.getByLabel('Default answer format')).toHaveValue('STAR');
  const crossOriginSettingsUpdate = await page.request.patch('/api/settings/profile', {
    headers: { Origin: 'https://attacker.invalid' },
    data: { name: 'Cross-origin Attack', targetRole: '', experienceLevel: null, preferredLanguage: null, preferredAnswerFormat: null, preferredAIProvider: null },
  });
  expect(crossOriginSettingsUpdate.status()).toBe(403);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Genzz Settings QA');
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
  await waitForFormHydration(page);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Welcome back, Genzz Settings QA/ })).toBeVisible();
});

test('users cannot view or delete another user’s interview history', async ({ browser }) => {
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  const userA = await browser.newPage();
  const userB = await browser.newPage();

  await registerTestUser(userA, 'QA Isolation User A');
  const createSession = await userA.request.post('/api/interviews', {
    headers: { Origin: appOrigin },
    data: {
      company: 'QA Privacy Test',
      isCustomCompany: true,
      jobTitle: 'QA Ownership Interview',
      experience: 'Fresher',
      answerLength: 'Balanced',
      answerFormat: 'STAR',
      tone: 'Professional',
      language: 'English',
      aiModel: 'ChatGPT',
    },
  });
  expect(createSession.status()).toBe(201);
  const { id: sessionId } = await createSession.json();

  await registerTestUser(userB, 'QA Isolation User B');
  const otherUserHistory = await userB.request.get('/api/history');
  expect(otherUserHistory.status()).toBe(200);
  expect((await otherUserHistory.json()).sessions.map((session: { id: string }) => session.id)).not.toContain(sessionId);

  const crossUserDelete = await userB.request.delete(`/api/history/${sessionId}`, {
    headers: { Origin: appOrigin },
  });
  expect(crossUserDelete.status()).toBe(404);

  const ownerHistory = await userA.request.get('/api/history');
  expect((await ownerHistory.json()).sessions.map((session: { id: string }) => session.id)).toContain(sessionId);

  const otherUserCode = await userB.request.post('/api/desktop/code', {
    headers: { Origin: appOrigin },
    data: { sessionId },
  });
  expect(otherUserCode.status()).toBe(404);
  const otherUserConnectionStatus = await userB.request.get(`/api/desktop/code?sessionId=${sessionId}`);
  expect((await otherUserConnectionStatus.json()).state).toBe('DISCONNECTED');

  const issuedCode = await userA.request.post('/api/desktop/code', {
    headers: { Origin: 'https://attacker.invalid' },
    data: { sessionId },
  });
  expect(issuedCode.status()).toBe(403);

  const validIssuedCode = await userA.request.post('/api/desktop/code', {
    headers: { Origin: appOrigin },
    data: { sessionId },
  });
  expect(validIssuedCode.status()).toBe(200);
  expect(validIssuedCode.headers()['cache-control']).toContain('no-store');
  const { code, expiresAt } = await validIssuedCode.json();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
  expect((await (await userA.request.get(`/api/desktop/code?sessionId=${sessionId}`)).json()).state).toBe('CONNECTING');

  const paired = await userB.request.post('/api/desktop/connect', { data: { code } });
  expect(paired.status()).toBe(200);
  expect(paired.headers()['cache-control']).toContain('no-store');
  const pairing = await paired.json();
  expect(pairing.session.id).toBe(sessionId);
  expect(new Date(pairing.expiresAt).getTime()).toBeGreaterThan(Date.now() + 119 * 60 * 1000);
  expect((await (await userA.request.get(`/api/desktop/code?sessionId=${sessionId}`)).json()).state).toBe('CONNECTED');

  const desktopHeaders = { Authorization: `Bearer ${pairing.token}` };
  const desktopSession = await userB.request.get('/api/desktop/session', { headers: desktopHeaders });
  expect(desktopSession.status()).toBe(200);
  expect(desktopSession.headers()['cache-control']).toContain('no-store');
  expect((await desktopSession.json()).session.id).toBe(sessionId);
  expect((await userB.request.post('/api/desktop/connect', { data: { code } })).status()).toBe(401);

  expect((await userB.request.post('/api/desktop/disconnect', { headers: desktopHeaders })).status()).toBe(200);
  expect((await userB.request.get('/api/desktop/session', { headers: desktopHeaders })).status()).toBe(401);
  expect((await (await userA.request.get(`/api/desktop/code?sessionId=${sessionId}`)).json()).state).toBe('DISCONNECTED');

  await userA.close();
  await userB.close();
});

test('uploaded and authored resumes are private to their owners in both directions', async ({ browser }) => {
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  const userA = await browser.newPage();
  const userB = await browser.newPage();
  let resumeA: string | undefined;
  let resumeB: string | undefined;
  let documentA: string | undefined;
  let documentB: string | undefined;

  const pdf = createQaPdf();
  const uploadResume = async (page: Page) => {
    const response = await page.request.post('/api/resumes', {
      headers: {
        Origin: appOrigin,
        'Content-Type': 'application/pdf',
        'X-File-Name': encodeURIComponent('qa-resume.pdf'),
      },
      data: pdf,
    });
    expect(response.status()).toBe(201);
    const result = await response.json();
    expect(result.resume.processingStatus).toBe('COMPLETED');
    return result.resume.id as string;
  };
  const content = {
    personal: { fullName: 'QA Resume Owner', email: '', phone: '', location: '', linkedin: '', github: '', portfolio: '' },
    summary: 'Synthetic E2E resume data.',
    experience: [],
    skills: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: [],
    languages: [],
    additionalInfo: '',
    sectionOrder: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'achievements', 'languages', 'additionalInfo'],
  };
  const createDocument = async (page: Page, owner: string, sourceResumeId: string) => {
    const response = await page.request.post('/api/resume-maker', {
      headers: { Origin: appOrigin },
      data: {
        title: `${owner} QA resume`,
        targetJobTitle: 'QA Engineer',
        targetCompany: 'Example Test Company',
        jobDescription: '',
        sourceResumeId,
        content: { ...content, personal: { ...content.personal, fullName: owner } },
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()).document.id as string;
  };
  const updateDocument = (title: string) => ({
    title,
    targetJobTitle: 'QA Engineer',
    targetCompany: 'Example Test Company',
    jobDescription: '',
    content,
  });

  try {
    await registerTestUser(userA, 'QA Resume Owner A');
    await registerTestUser(userB, 'QA Resume Owner B');
    resumeA = await uploadResume(userA);
    resumeB = await uploadResume(userB);
    documentA = await createDocument(userA, 'QA Owner A', resumeA);
    documentB = await createDocument(userB, 'QA Owner B', resumeB);

    const crossOwnedDocument = await userB.request.post('/api/resume-maker', {
      headers: { Origin: appOrigin },
      data: { ...updateDocument('Cross-owner source attempt'), sourceResumeId: resumeA },
    });
    expect(crossOwnedDocument.status()).toBe(404);

    for (const [attacker, ownerResumeId, ownerDocumentId] of [
      [userB, resumeA, documentA],
      [userA, resumeB, documentB],
    ] as const) {
      expect((await attacker.request.get(`/api/resumes/${ownerResumeId}`)).status()).toBe(404);
      expect((await attacker.request.delete(`/api/resumes/${ownerResumeId}`, { headers: { Origin: appOrigin } })).status()).toBe(404);
      expect((await attacker.request.post(`/api/resumes/${ownerResumeId}/process`, { headers: { Origin: appOrigin } })).status()).toBe(404);

      expect((await attacker.request.get(`/api/resume-maker/${ownerDocumentId}`)).status()).toBe(404);
      expect((await attacker.request.put(`/api/resume-maker/${ownerDocumentId}`, {
        headers: { Origin: appOrigin },
        data: updateDocument('Unauthorized title change'),
      })).status()).toBe(404);
      expect((await attacker.request.delete(`/api/resume-maker/${ownerDocumentId}`, { headers: { Origin: appOrigin } })).status()).toBe(404);

      const makerList = await attacker.request.get('/api/resume-maker');
      expect(makerList.status()).toBe(200);
      const makerData = await makerList.json();
      expect(makerData.documents.map((item: { id: string }) => item.id)).not.toContain(ownerDocumentId);
      expect(makerData.sourceResumes.map((item: { id: string }) => item.id)).not.toContain(ownerResumeId);
    }

    for (const [owner, ownerResumeId, ownerDocumentId, expectedTitle] of [
      [userA, resumeA, documentA, 'QA Owner A QA resume'],
      [userB, resumeB, documentB, 'QA Owner B QA resume'],
    ] as const) {
      const download = await owner.request.get(`/api/resumes/${ownerResumeId}`);
      expect(download.status()).toBe(200);
      expect(download.headers()['cache-control']).toContain('no-store');
      expect(Buffer.from(await download.body())).toEqual(pdf);

      const document = await owner.request.get(`/api/resume-maker/${ownerDocumentId}`);
      expect(document.status()).toBe(200);
      const savedDocument = (await document.json()).document;
      expect(savedDocument.title).toBe(expectedTitle);
      expect(savedDocument.sourceResumeId).toBe(ownerResumeId);
    }

    const ownerNotifications = await userA.request.get('/api/notifications');
    expect(ownerNotifications.status()).toBe(200);
    const resumeNotification = (await ownerNotifications.json()).items.find(
      (item: { eventKey: string | null }) => item.eventKey === `resume:${resumeA}:completed`,
    );
    expect(resumeNotification).toBeTruthy();
    const otherNotifications = await userB.request.get('/api/notifications');
    expect((await otherNotifications.json()).items.map((item: { id: string }) => item.id)).not.toContain(resumeNotification.id);
    expect((await userB.request.patch(`/api/notifications/${resumeNotification.id}/read`, {
      headers: { Origin: appOrigin },
    })).status()).toBe(404);
    expect((await userA.request.patch(`/api/notifications/${resumeNotification.id}/read`, {
      headers: { Origin: appOrigin },
    })).status()).toBe(200);
  } finally {
    if (documentA) await userA.request.delete(`/api/resume-maker/${documentA}`).catch(() => undefined);
    if (documentB) await userB.request.delete(`/api/resume-maker/${documentB}`).catch(() => undefined);
    if (resumeA) await userA.request.delete(`/api/resumes/${resumeA}`).catch(() => undefined);
    if (resumeB) await userB.request.delete(`/api/resumes/${resumeB}`).catch(() => undefined);
    await userA.close();
    await userB.close();
  }
});

test('user-created question bank items and favorites stay scoped to their owner', async ({ browser }) => {
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  const userA = await browser.newPage();
  const userB = await browser.newPage();
  let questionId: string | undefined;
  const questionData = {
    question: `QA owner-only question ${Date.now()}?`,
    category: 'Behavioral',
    difficulty: 'Medium',
    experienceLevel: 'Fresher',
    jobRole: 'QA Engineer',
    tags: ['local-e2e'],
    explanation: 'Synthetic test question.',
  };

  try {
    await registerTestUser(userA, 'QA Question Owner');
    await registerTestUser(userB, 'QA Question Other User');

    const crossOriginCreate = await userA.request.post('/api/question-bank', {
      headers: { Origin: 'https://attacker.invalid' },
      data: questionData,
    });
    expect(crossOriginCreate.status()).toBe(403);

    const created = await userA.request.post('/api/question-bank', {
      headers: { Origin: appOrigin },
      data: questionData,
    });
    expect(created.status()).toBe(201);
    questionId = (await created.json()).id as string;

    const ownerQuestion = await userA.request.get(`/api/question-bank/${questionId}`);
    expect(ownerQuestion.status()).toBe(200);
    expect((await ownerQuestion.json()).question.question).toBe(questionData.question);

    const ownerFavorite = await userA.request.post(`/api/question-bank/${questionId}/favorite`, {
      headers: { Origin: appOrigin },
    });
    expect(ownerFavorite.status()).toBe(200);
    expect((await ownerFavorite.json()).isFavorite).toBe(true);
    expect((await userA.request.get('/api/question-bank?favorites=true')).status()).toBe(200);

    expect((await userB.request.get(`/api/question-bank/${questionId}`)).status()).toBe(404);
    expect((await userB.request.post(`/api/question-bank/${questionId}/favorite`, {
      headers: { Origin: appOrigin },
    })).status()).toBe(404);
    expect((await userB.request.delete(`/api/question-bank/${questionId}`, {
      headers: { Origin: appOrigin },
    })).status()).toBe(404);

    const otherUsersQuestions = await userB.request.get('/api/question-bank');
    expect(otherUsersQuestions.status()).toBe(200);
    expect((await otherUsersQuestions.json()).items.map((item: { id: string }) => item.id)).not.toContain(questionId);
  } finally {
    if (questionId) {
      await userA.request.delete(`/api/question-bank/${questionId}`, {
        headers: { Origin: appOrigin },
      }).catch(() => undefined);
    }
    await userA.close();
    await userB.close();
  }
});

test('concurrent free interview starts reserve the allowance only once', async ({ page }) => {
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  await registerTestUser(page, 'QA Credit Concurrency User');

  const sessionInput = {
    company: 'QA Credit Test',
    isCustomCompany: true,
    jobTitle: 'QA Credit Concurrency Interview',
    experience: 'Fresher',
    answerLength: 'Balanced',
    answerFormat: 'STAR',
    tone: 'Professional',
    language: 'English',
    aiModel: 'ChatGPT',
  };
  const responses = await Promise.all([
    page.request.post('/api/interviews', { headers: { Origin: appOrigin }, data: sessionInput }),
    page.request.post('/api/interviews', { headers: { Origin: appOrigin }, data: sessionInput }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([201, 402]);

  const history = await page.request.get('/api/history');
  expect(history.status()).toBe(200);
  expect((await history.json()).total).toBe(1);

  const credits = await page.request.get('/api/credits');
  expect(credits.status()).toBe(200);
  const creditData = await credits.json();
  expect(creditData.balance.balanceUnits).toBeGreaterThanOrEqual(0);
  expect(creditData.balance.reservedUnits).toBe(0);
  expect(creditData.transactions.filter((item: { type: string }) => item.type === 'FREE_SESSION')).toHaveLength(1);
});

test('unconfigured billing returns clear unavailable responses without contacting Stripe', async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_BILLING_UNCONFIGURED !== 'true', 'Run only when local Stripe checkout is intentionally unconfigured.');
  const appOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  await registerTestUser(page, 'QA Unconfigured Integrations User');

  const premiumCheckout = await page.request.post('/api/subscription/checkout', {
    headers: { Origin: appOrigin },
    data: {},
  });
  expect(premiumCheckout.status()).toBe(503);
  expect((await premiumCheckout.json()).error).toContain('Premium checkout is not configured');

  const creditCheckout = await page.request.post('/api/credits/checkout', {
    headers: { Origin: appOrigin },
    data: { packId: 'starter' },
  });
  expect(creditCheckout.status()).toBe(503);
  expect((await creditCheckout.json()).error).toContain('Credit purchases are not configured');
});

test('public liveness works while credit and desktop APIs reject anonymous requests', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.status()).toBe(200);
  const healthBody = await health.json();
  expect(healthBody.status).toBe('ok');

  const credits = await request.get('/api/credits');
  expect(credits.status()).toBe(401);

  expect((await request.get('/api/desktop/session')).status()).toBe(401);
  for (const route of ['/api/desktop/stream', '/api/desktop/activate', '/api/desktop/question', '/api/desktop/detect', '/api/desktop/disconnect', '/api/desktop/end']) {
    expect((await request.post(route, { data: {} })).status(), `${route} should require desktop authorization`).toBe(401);
  }
});
