import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, session, shell, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { z } from 'zod';

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let token: string | null = null;
let apiRoot = 'http://localhost:3000';
let microphoneAllowed = false;
const answerStreams = new Map<string, AbortController>();
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function connectionCodeFromArg(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'genzz-ai:' || url.hostname !== 'connect') return null;
    const code = url.searchParams.get('code') || '';
    return codeSchema.safeParse(code).success ? code.toUpperCase() : null;
  } catch { return null; }
}
function deliverConnectionCode(value: string) {
  const code = connectionCodeFromArg(value);
  if (code && window) { if (window.isMinimized()) window.restore(); window.show(); window.webContents.send('desktop:connect-code', code); }
}

const rootSchema = z.string().url().refine((value) => {
  const u = new URL(value);
  return u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname);
}, 'Use HTTPS for remote servers.');
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/);
const dashboardDestinationSchema = z.enum(['dashboard', 'create', 'history', 'session']);
const questionSchema = z.string().trim().min(1).max(3000);
const preferencesSchema = z.object({ answerLength: z.enum(['Short', 'Balanced', 'Long']), answerFormat: z.enum(['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation']), language: z.string().min(1).max(40), aiModel: z.enum(['ChatGPT', 'Gemini']) }).optional();
const detectQuestionSchema = z.string().trim().min(1).max(3000);
const versionSchema = z.object({ answerId: z.string().cuid(), action: z.enum(['REGENERATE', 'SHORTER', 'LONGER', 'SIMPLIFY', 'FORMAL', 'TECHNICAL', 'STAR', 'SCRIPT', 'EDIT']), editedAnswer: z.string().max(20000).optional() });

function trusted(event: IpcMainInvokeEvent) {
  const trustedUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedUrl) throw new Error('Untrusted IPC sender.');
}
session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
  const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes;
  callback(permission === 'media' && microphoneAllowed && mediaTypes?.includes('audio') === true);
});
function setRoot(value: unknown) {
  const parsed = rootSchema.safeParse(value);
  if (!parsed.success) throw new Error('Enter a valid HTTPS Genzz AI server address.');
  const candidate = new URL(parsed.data);
  if (candidate.username || candidate.password || candidate.pathname !== '/' || candidate.search || candidate.hash) throw new Error('Enter only the Genzz AI server origin.');
  if (token && new URL(apiRoot).origin !== candidate.origin) throw new Error('Disconnect before changing the server address.');
  apiRoot = candidate.origin;
}
async function apiRequest(route: string, init: RequestInit = {}) {
  if (!token) throw new Error('Session Expired. Reconnect with a new session code.');
  const response = await fetch(`${apiRoot}/api/desktop/${route}`, { ...init, signal: init.signal || AbortSignal.timeout(25_000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    if (response.status === 401 || response.status === 410) token = null;
    throw new Error(typeof payload.error === 'string' ? payload.error : 'Connection Failed');
  }
  return payload;
}

ipcMain.handle('desktop:connect', async (event, root, code) => {
  trusted(event); setRoot(root);
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) throw new Error('Enter the eight-character session code.');
  const response = await fetch(`${apiRoot}/api/desktop/connect`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: parsed.data }) });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || typeof payload.token !== 'string') throw new Error(typeof payload.error === 'string' ? payload.error : 'Connection Failed');
  token = payload.token;
  const sessionPayload = await apiRequest('session');
  return { ...sessionPayload, expiresAt: sessionPayload.expiresAt || payload.expiresAt };
});
ipcMain.handle('desktop:session', async (event, root) => { trusted(event); setRoot(root); return apiRequest('session'); });
ipcMain.handle('desktop:activate', async (event, root) => { trusted(event); setRoot(root); return apiRequest('activate', { method: 'POST', body: '{}' }); });
ipcMain.handle('desktop:open-dashboard', async (event, root, destination = 'dashboard', sessionId) => {
  trusted(event); setRoot(root);
  const parsed = dashboardDestinationSchema.safeParse(destination);
  if (!parsed.success) throw new Error('Invalid Genzz AI destination.');
  const path = parsed.data === 'dashboard' ? '/dashboard' : parsed.data === 'create' ? '/interviews/create' : parsed.data === 'history' ? '/interviews' : `/interviews/${z.string().cuid().parse(sessionId)}`;
  await shell.openExternal(new URL(path, apiRoot).toString()); return true;
});
ipcMain.handle('desktop:end', async (event, root) => { trusted(event); setRoot(root); const result = await apiRequest('end', { method: 'POST', body: '{}' }); token = null; return result; });
ipcMain.handle('desktop:detect-question', async (event, root, question) => {
  trusted(event); setRoot(root);
  const parsed = detectQuestionSchema.safeParse(question);
  if (!parsed.success) throw new Error('Enter a detected question.');
  return apiRequest('detect', { method: 'POST', body: JSON.stringify({ question: parsed.data }) });
});
ipcMain.handle('desktop:question', async (event, root, question, answerId) => {
  trusted(event); setRoot(root);
  const parsed = questionSchema.safeParse(question);
  if (!parsed.success) throw new Error('Enter a question (up to 3,000 characters).');
  const parsedAnswerId = answerId === undefined ? undefined : z.string().cuid().safeParse(answerId);
  if (answerId !== undefined && !parsedAnswerId?.success) throw new Error('Detected question does not belong to this session.');
  return apiRequest('question', { method: 'POST', body: JSON.stringify({ question: parsed.data, ...(parsedAnswerId?.success ? { answerId: parsedAnswerId.data } : {}) }) });
});
ipcMain.handle('desktop:question-stream', async (event, root, question, answerId, requestId, preferences) => {
  trusted(event); setRoot(root);
  const parsed = questionSchema.safeParse(question);
  if (!parsed.success) throw new Error('Enter a question (up to 3,000 characters).');
  const parsedAnswerId = answerId === undefined ? undefined : z.string().cuid().safeParse(answerId);
  if (answerId !== undefined && !parsedAnswerId?.success) throw new Error('Detected question does not belong to this session.');
  const parsedRequestId = z.string().min(1).max(100).safeParse(requestId);
  if (!parsedRequestId.success) throw new Error('Invalid answer stream request.');
  const parsedPreferences = preferencesSchema.safeParse(preferences);
  if (!parsedPreferences.success) throw new Error('Choose valid answer preferences.');
  if (!token) throw new Error('Session Expired. Reconnect with a new session code.');

  const abortController = new AbortController();
  answerStreams.set(parsedRequestId.data, abortController);
  try {
    const response = await fetch(`${apiRoot}/api/desktop/stream`, {
      method: 'POST', signal: abortController.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question: parsed.data, ...(parsedAnswerId?.success ? { answerId: parsedAnswerId.data } : {}), ...(parsedPreferences.data ? { preferences: parsedPreferences.data } : {}) }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (response.status === 401 || response.status === 410) token = null;
      throw new Error(typeof payload.error === 'string' ? payload.error : 'Connection Failed');
    }
    if (!response.body) throw new Error('The answer stream is unavailable. Please try again.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamError = '';
    const deliver = (line: string) => {
      if (!line.trim()) return;
      try {
        const payload = JSON.parse(line) as Record<string, unknown>;
        if (payload.type === 'error' && typeof payload.error === 'string') streamError = payload.error;
        if (window && !window.isDestroyed()) window.webContents.send('desktop:answer-stream', parsedRequestId.data, payload);
      } catch { /* Ignore malformed partial frames; the stream continues. */ }
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split('\n'); buffer = lines.pop() || '';
        for (const line of lines) deliver(line);
        if (done) break;
      }
      deliver(buffer);
      if (streamError) throw new Error(streamError);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
  } finally {
    answerStreams.delete(parsedRequestId.data);
  }
  return true;
});
ipcMain.on('desktop:question-stream-cancel', (event, requestId) => {
  if (!window || event.sender !== window.webContents || typeof requestId !== 'string') return;
  answerStreams.get(requestId)?.abort();
});
ipcMain.handle('desktop:version', async (event, root, answerId, action, editedAnswer) => {
  trusted(event); setRoot(root);
  const parsed = versionSchema.safeParse({ answerId, action, editedAnswer });
  if (!parsed.success) throw new Error('Choose a valid answer action.');
  return apiRequest('version', { method: 'POST', body: JSON.stringify(parsed.data) });
});
ipcMain.handle('desktop:disconnect', async (event, root) => {
  trusted(event); setRoot(root);
  try { await apiRequest('disconnect', { method: 'POST' }); } finally { token = null; }
  return true;
});
ipcMain.handle('desktop:forget', (event) => { trusted(event); token = null; return true; });
ipcMain.handle('desktop:is-dev', (event) => { trusted(event); return !app.isPackaged; });
ipcMain.handle('microphone:allow', (event) => { trusted(event); microphoneAllowed = true; return true; });
ipcMain.handle('microphone:stop', (event) => { trusted(event); microphoneAllowed = false; return true; });
ipcMain.on('window:minimize', (event) => { if (window && event.sender === window.webContents) window.minimize(); });
ipcMain.on('window:maximize', (event) => { if (window && event.sender === window.webContents) window.isMaximized() ? window.unmaximize() : window.maximize(); });
ipcMain.on('window:close', (event) => { if (window && event.sender === window.webContents) window.close(); });

function createWindow() {
  window = new BrowserWindow({
    width: 1120, height: 820, minWidth: 760, minHeight: 600,
    title: 'Genzz AI — Interview Practice',
    frame: false,
    backgroundColor: '#0b1118',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const trustedUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
  const trustedPath = fileURLToPath(trustedUrl);
  window.webContents.on('will-navigate', (event, target) => {
    try { if (fileURLToPath(target) !== trustedPath) event.preventDefault(); } catch { event.preventDefault(); }
  });
  window.webContents.on('will-redirect', (event, target) => {
    try { if (fileURLToPath(target) !== trustedPath) event.preventDefault(); } catch { event.preventDefault(); }
  });
  void window.loadFile(path.join(__dirname, 'index.html'));
  window.on('closed', () => {
    window = null;
    microphoneAllowed = false;
    answerStreams.forEach((stream) => stream.abort());
    answerStreams.clear();
  });
}

app.whenReady().then(() => {
  app.setAsDefaultProtocolClient('genzz-ai');
  createWindow();
  for (const arg of process.argv) deliverConnectionCode(arg);
  if (process.platform === 'win32') {
    const traySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7048dd"/><text x="16" y="22" font-family="Arial" font-size="18" font-weight="700" text-anchor="middle" fill="white">G</text></svg>';
    tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`));
    tray.setToolTip('Genzz AI');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Genzz AI', click: () => { if (window) window.show(); else createWindow(); } },
      { label: 'Reconnect', click: () => { token = null; if (window) { window.show(); window.webContents.send('desktop:reconnect'); } } },
      { label: 'Session Information', click: () => { if (window) { window.show(); window.webContents.send('desktop:session-info'); } } },
      { type: 'separator' }, { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('double-click', () => { if (window) window.show(); else createWindow(); });
  }
});
app.on('second-instance', (_event, argv) => { for (const arg of argv) deliverConnectionCode(arg); });
app.on('open-url', (event, url) => { event.preventDefault(); deliverConnectionCode(url); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!window) createWindow(); });
