import { createSpeechProvider, type SpeechProvider } from './speech-provider';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const rootInput = byId<HTMLInputElement>('server');
const connectView = byId<HTMLElement>('connectView');
const workspace = byId<HTMLElement>('workspace');
const statusEl = byId<HTMLElement>('status');
const error = (id: string, message = '') => { const node = byId<HTMLElement>(id); node.textContent = message; node.hidden = !message; if (id === 'connectError' && message) statusEl.classList.remove('connecting', 'connected'); };
type Preferences = { answerLength: string; answerFormat: string; language: string; aiModel: string };
let answerId = '', currentAnswer = '', currentQuestionId = '', activeStreamRequestId = '';
let busy = false, listening = false, stoppingIntentionally = false, speechProvider: SpeechProvider | null = null;
let sessionLanguage = 'English', finalTranscript = '', lastConfidence = 1, finalizeTimer = 0, restartTimer = 0;
let answerStartedAt = 0, segmentStartedAt = 0, segmentFinalizedAt = 0, pipelineStartedAt = 0, firstTokenDisplayed = false, detectionStartedAt = 0;
let serverMilestones: Record<string, number> = {}, sessionId = '', sessionStartedAt = 0, sessionTimer: number | undefined;
let sessionCount = 0, providerOptions: string[] = [], currentProvider = 'ChatGPT';
let modalReturnFocus: HTMLElement | null = null;
let savedAnswers: Array<{ id: string; question: string; answer: string; questionType: string | null; createdAt: string }> = [];
const seenQuestions = new Set<string>();
const speechLocale: Record<string, string> = { English: 'en-IN', Hindi: 'hi-IN', Telugu: 'te-IN', Tamil: 'ta-IN', Kannada: 'kn-IN', Malayalam: 'ml-IN', Marathi: 'mr-IN', Bengali: 'bn-IN' };
const nonWordPattern = new RegExp('[^\\p{L}\\p{N}\\s]', 'gu');
function normalized(value: string) { return value.normalize('NFKC').toLocaleLowerCase().replace(nonWordPattern, ' ').replace(/\s+/g, ' ').trim(); }
function isLikelyQuestion(value: string, confidence: number) {
  const clean = normalized(value), words = clean.split(' ').filter(Boolean);
  if (confidence < 0.45 || clean.length < 9 || words.length < 3) return false;
  if (/^(okay|ok|yes|right|thank you|thanks|lets move on|move on)$/.test(clean) || /^(okay|ok|yes|right|thank you|thanks|lets move on)\b/.test(clean)) return false;
  return /[?!.]$/.test(value.trim()) || /^(who|what|when|where|why|how|which|can|could|would|will|do|does|did|is|are|tell me|describe|explain|walk me through)\b/i.test(value.trim()) || clean.length >= 42;
}
function preferences(): Preferences {
  return { answerLength: byId<HTMLSelectElement>('answerLength').value, answerFormat: byId<HTMLSelectElement>('answerFormat').value, language: byId<HTMLSelectElement>('answerLanguage').value, aiModel: byId<HTMLSelectElement>('answerProvider').value || currentProvider };
}
function preferenceKey() { return `desktopPreferences:${sessionId}`; }
function loadPreferences(session: any) {
  const controls: Array<[keyof Preferences, string]> = [['answerLength', 'answerLength'], ['answerFormat', 'answerFormat'], ['language', 'answerLanguage'], ['aiModel', 'answerProvider']];
  let stored: Partial<Preferences> = {};
  try { stored = JSON.parse(localStorage.getItem(preferenceKey()) || '{}') as Partial<Preferences>; } catch { stored = {}; }
  const defaults: Preferences = { answerLength: session.answerLength || 'Balanced', answerFormat: session.answerFormat || 'Normal', language: session.language || 'English', aiModel: session.aiModel || 'ChatGPT' };
  for (const [key, id] of controls) {
    const select = byId<HTMLSelectElement>(id), options = Array.from(select.options).map(option => option.value);
    const candidate = stored[key] || '';
    const value = (key === 'aiModel' ? providerOptions.includes(candidate) : options.includes(candidate)) ? candidate : defaults[key];
    if (key === 'aiModel') select.replaceChildren(...providerOptions.map(provider => { const option = document.createElement('option'); option.value = provider; option.textContent = provider; return option; }));
    if (Array.from(select.options).some(option => option.value === value)) select.value = value;
  }
  currentProvider = byId<HTMLSelectElement>('answerProvider').value || defaults.aiModel;
  sessionLanguage = byId<HTMLSelectElement>('answerLanguage').value || defaults.language;
  byId<HTMLElement>('footerProvider').textContent = currentProvider;
  for (const [key, id] of controls) byId<HTMLSelectElement>(id).onchange = () => {
    const value = preferences(); currentProvider = value.aiModel; sessionLanguage = value.language;
    localStorage.setItem(preferenceKey(), JSON.stringify(value)); byId<HTMLElement>('footerProvider').textContent = currentProvider;
  };
}
function createSpeechPanel() {
  byId<HTMLElement>('speechPanel').innerHTML = `<section class="card transcript-card"><div class="row" style="justify-content:space-between"><div><h2 class="card-title">Live Transcript</h2><p class="muted small" id="micStatus">○ Microphone off</p></div><button class="action mic-button" id="startListening" aria-label="Start listening">🎙</button></div><p class="transcript-box" id="transcriptText">Your live transcript will appear here.</p><div class="row" style="margin-top:12px"><button class="action primary" id="startListeningText">Start Listening</button><button class="action" id="stopListening" disabled>Stop Listening</button></div><div class="card consent" id="micConsent" hidden><strong>Allow microphone access?</strong><p class="muted small">Audio is sent to the online speech recognition service to produce a transcript. Genzz AI does not save raw audio.</p><div class="row"><button class="action primary" id="allowMicrophone">Allow Microphone</button><button class="action" id="notNow">Not Now</button></div></div><p class="error" id="speechError" hidden></p></section><section class="card question-card" id="questionCard"><div class="row" style="justify-content:space-between"><div><h2 class="card-title">Detected Question</h2><p class="muted small" id="questionTypeLabel">Waiting for a question</p></div><button class="action" id="editQuestion">Edit Question</button></div><label class="label" for="question">Question</label><textarea id="question" maxlength="3000" placeholder="A detected question will appear here."></textarea><div class="row" style="margin-top:10px"><button class="action primary" id="generate">Generate Answer</button><span class="answer-status" id="working"></span></div><p class="muted small" id="questionConfidence" hidden></p></section><div class="preferences" id="desktopPreferences" style="grid-column:1/-1"><label>Answer length<select id="answerLength"><option>Short</option><option>Balanced</option><option>Long</option></select></label><label>Answer format<select id="answerFormat"><option>Normal</option><option>Bullet Points</option><option>Script</option><option>STAR</option><option>Technical Explanation</option></select></label><label>Language<select id="answerLanguage"><option>English</option><option>Hindi</option><option>Telugu</option><option>Tamil</option><option>Kannada</option><option>Malayalam</option><option>Marathi</option><option>Bengali</option></select></label><label>AI provider<select id="answerProvider"></select></label></div><p class="muted small" id="diagnostics" style="grid-column:1/-1" hidden></p>`;
  byId<HTMLTextAreaElement>('question').readOnly = true;
  const askForMic = () => { byId<HTMLElement>('micConsent').hidden = false; setMicState('OFF'); };
  byId<HTMLButtonElement>('startListening').onclick = askForMic; byId<HTMLButtonElement>('startListeningText').onclick = askForMic;
  byId<HTMLButtonElement>('notNow').onclick = () => { byId<HTMLElement>('micConsent').hidden = true; setMicState('OFF'); };
  byId<HTMLButtonElement>('allowMicrophone').onclick = () => void beginListening(); byId<HTMLButtonElement>('stopListening').onclick = () => void stopListening(true);
  byId<HTMLButtonElement>('editQuestion').onclick = () => { const input = byId<HTMLTextAreaElement>('question'); input.readOnly = !input.readOnly; byId<HTMLButtonElement>('editQuestion').textContent = input.readOnly ? 'Edit Question' : 'Done Editing'; if (!input.readOnly) input.focus(); };
}
function setMicState(state: 'OFF' | 'REQUESTING' | 'ON' | 'ERROR', message = '') {
  const labels = { ON: '● Listening', REQUESTING: '◌ Requesting microphone…', ERROR: '⚠ Microphone error', OFF: '○ Microphone off' };
  byId<HTMLElement>('micStatus').textContent = labels[state]; byId<HTMLElement>('footerMic').textContent = state === 'ON' ? 'Listening' : state === 'REQUESTING' ? 'Starting microphone' : state === 'ERROR' ? 'Microphone error' : 'Microphone off';
  byId<HTMLElement>('micStatus').style.color = state === 'ON' ? '#63dfa8' : state === 'ERROR' ? '#ff9b9b' : '#a3a4b5';
  byId<HTMLElement>('micStatus').classList.toggle('is-on', state === 'ON');
  byId<HTMLElement>('footerMicDot').classList.toggle('is-on', state === 'ON');
  byId<HTMLButtonElement>('startListening').classList.toggle('active', state === 'ON');
  error('speechError', message); byId<HTMLButtonElement>('startListening').disabled = state === 'ON' || state === 'REQUESTING'; byId<HTMLButtonElement>('startListeningText').disabled = state === 'ON' || state === 'REQUESTING';
  byId<HTMLButtonElement>('stopListening').disabled = state !== 'ON' && state !== 'REQUESTING';
}
async function beginListening() {
  if (listening) return; setMicState('REQUESTING'); byId<HTMLElement>('micConsent').hidden = true;
  try {
    await window.genzz.allowMicrophone(); const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); probe.getTracks().forEach(track => track.stop());
    speechProvider = createSpeechProvider(); listening = true; stoppingIntentionally = false; finalTranscript = ''; byId<HTMLElement>('transcriptText').textContent = 'Listening…'; startRecognition(); setMicState('ON');
  } catch (reason) {
    await window.genzz.stopMicrophone(); listening = false; const name = reason instanceof DOMException ? reason.name : '';
    const message = name === 'NotAllowedError' || name === 'SecurityError' ? 'Microphone permission was denied.' : name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'No microphone detected.' : reason instanceof Error ? reason.message : 'Speech recognition is temporarily unavailable.';
    setMicState('ERROR', message);
  }
}
function startRecognition() {
  if (!listening || !speechProvider) return;
  try { speechProvider.start(speechLocale[sessionLanguage] || 'en-US', {
    onTranscript: (transcript, confidence, isFinal) => {
      if (!segmentStartedAt) { segmentStartedAt = performance.now(); markClientMilestone('speechStart', segmentStartedAt); }
      byId<HTMLElement>('transcriptText').textContent = transcript || 'Listening…'; if (!isFinal) return;
      segmentFinalizedAt = performance.now(); markClientMilestone('speechFinalized', segmentFinalizedAt); finalTranscript = transcript; lastConfidence = confidence;
      if (finalizeTimer) window.clearTimeout(finalizeTimer); finalizeTimer = window.setTimeout(() => void finalizeQuestion(finalTranscript, lastConfidence), 350);
    },
    onError: kind => { const messages: Record<string, string> = { 'not-allowed': 'Microphone permission was denied.', 'audio-capture': 'No microphone detected.', network: 'Speech recognition is temporarily unavailable. Check your connection.', 'service-not-allowed': 'Speech recognition is unavailable in this environment.', 'language-not-supported': `Speech recognition does not support ${sessionLanguage} in this environment.` }; const message = messages[kind] || (kind === 'no-speech' ? '' : 'Speech recognition is temporarily unavailable.'); if (message) void stopListening(false).then(() => setMicState('ERROR', message)); },
    onEnd: () => { if (!listening || stoppingIntentionally) return; listening = false; void window.genzz.stopMicrophone(); setMicState('OFF', 'Listening stopped. Select Start Listening when you want to resume.'); },
  }); } catch (e) { void stopListening(false).then(() => setMicState('ERROR', e instanceof Error ? e.message : 'Speech recognition is temporarily unavailable.')); }
}
async function stopListening(userInitiated: boolean) {
  stoppingIntentionally = true; listening = false; if (restartTimer) window.clearTimeout(restartTimer); if (finalizeTimer) window.clearTimeout(finalizeTimer);
  speechProvider?.stop(); speechProvider = null; await window.genzz.stopMicrophone(); setMicState('OFF'); if (userInitiated && finalTranscript) await finalizeQuestion(finalTranscript, lastConfidence);
}
async function finalizeQuestion(text: string, confidence: number) {
  const question = text.trim(), key = normalized(question); if (!isLikelyQuestion(question, confidence)) { byId<HTMLElement>('questionTypeLabel').textContent = 'No clear question detected. You can edit the question field or try again.'; finalTranscript = ''; speechProvider?.resetTranscript(); return; }
  byId<HTMLElement>('diagnostics').replaceChildren(); const detectedAt = performance.now(); pipelineStartedAt = detectedAt; markClientMilestone('questionDetected', detectedAt);
  if (segmentFinalizedAt && segmentStartedAt) showDiagnostic('Speech Finalization Time', segmentFinalizedAt - segmentStartedAt); if (segmentFinalizedAt) showDiagnostic('Question Detection Time', detectedAt - segmentFinalizedAt);
  if (seenQuestions.has(key)) { byId<HTMLElement>('questionTypeLabel').textContent = 'Repeated question'; finalTranscript = ''; speechProvider?.resetTranscript(); return; }
  seenQuestions.add(key); detectionStartedAt = detectedAt; const input = byId<HTMLTextAreaElement>('question'); input.value = question; input.readOnly = true; byId<HTMLButtonElement>('editQuestion').textContent = 'Edit Question';
  byId<HTMLElement>('questionTypeLabel').textContent = 'Detected · classifying'; const conf = byId<HTMLElement>('questionConfidence'); conf.hidden = false; conf.textContent = `Speech confidence: ${Math.round(confidence * 100)}%`;
  try {
    const result = await window.genzz.detectQuestion(rootInput.value.trim(), question); currentQuestionId = result.answered ? '' : result.answerId; byId<HTMLElement>('questionTypeLabel').textContent = `${String(result.questionType || 'Question').replace(/_/g, ' ')}${result.duplicate ? ' · repeated question' : ''}`; if (result.duplicate && result.answer) { currentAnswer = result.answer; answerId = result.answerId || ''; updateAnswerUI(); setAnswerStatus('Complete'); } showDiagnostic('Question Detection Request', performance.now() - detectionStartedAt);
  } catch (e) { byId<HTMLElement>('questionTypeLabel').textContent = 'Detected · ready to answer'; error('speechError', e instanceof Error ? e.message : 'Unable to save the detected question.'); if (/expired|reconnect/i.test(e instanceof Error ? e.message : '')) { await window.genzz.forget(); await stopListening(false); showDisconnected('Session expired. Create a new code from the web application.'); } }
  finalTranscript = ''; speechProvider?.resetTranscript(); segmentStartedAt = 0; segmentFinalizedAt = 0;
}
function setAnswerStatus(value: string) { const status = byId<HTMLElement>('answerStatus'); status.textContent = value; byId<HTMLElement>('working').textContent = value === 'Generating' || value === 'Streaming' ? value : ''; }
async function generateAnswer(question: string, existingAnswerId?: string) {
  if (busy || !question.trim()) return; busy = true; answerStartedAt = performance.now(); const button = byId<HTMLButtonElement>('generate');
  if (!pipelineStartedAt) { pipelineStartedAt = answerStartedAt; byId<HTMLElement>('diagnostics').replaceChildren(); }
  serverMilestones = {}; firstTokenDisplayed = false; answerId = ''; activeStreamRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  button.disabled = true; button.textContent = 'Generating…'; error('answerError'); byId<HTMLElement>('answerCard').hidden = false; currentAnswer = ''; updateAnswerUI(); byId<HTMLElement>('answer').classList.remove('empty'); setAnswerStatus('Generating');
  try { await window.genzz.streamQuestion(rootInput.value.trim(), question.trim(), existingAnswerId || currentQuestionId || undefined, activeStreamRequestId, preferences()); currentQuestionId = ''; }
  catch (e) { error('answerError', e instanceof Error ? e.message : 'Unable to generate answer.'); setAnswerStatus('Error'); if (/expired|reconnect/i.test(e instanceof Error ? e.message : '')) { await window.genzz.forget(); showDisconnected('Session expired. Create a new code from the web application.'); } }
  finally { busy = false; button.disabled = false; button.textContent = 'Generate Answer'; }
}
window.genzz.onAnswerStream((requestId, event) => {
  if (requestId !== activeStreamRequestId) return;
  if (event.type === 'milestone' && typeof event.name === 'string') {
    const timestamp = typeof event.timestampMs === 'number' ? event.timestampMs : 0; serverMilestones[event.name] = timestamp; showDiagnostic(`Server ${event.name}`, timestamp);
    if (event.name === 'classificationCompleted') { if (typeof event.durationMs === 'number') showDiagnostic('Question Classification', event.durationMs); if (typeof event.questionType === 'string') byId<HTMLElement>('questionTypeLabel').textContent = `${event.questionType.replace(/_/g, ' ')} · generating`; }
    if (event.name === 'contextCompleted' && typeof event.durationMs === 'number') showDiagnostic('Context Preparation', event.durationMs);
    if (event.name === 'promptCompleted' && typeof event.durationMs === 'number') showDiagnostic('Prompt Construction', event.durationMs);
    if (event.name === 'firstTokenReceived' && serverMilestones.aiRequestStarted !== undefined) showDiagnostic('AI Time to First Token', timestamp - serverMilestones.aiRequestStarted); return;
  }
  if (event.type === 'delta' && typeof event.token === 'string') { currentAnswer += event.token; updateAnswerUI(); setAnswerStatus('Streaming'); if (currentAnswer.trim() && !firstTokenDisplayed) { firstTokenDisplayed = true; showDiagnostic('First Answer Content', performance.now() - answerStartedAt); markClientMilestone('answerDisplayed'); } return; }
  if (event.type === 'done' && event.answer && typeof event.answer === 'object') {
    const result = event.answer as { id: string; answer: string; question: string; questionType?: string; createdAt?: string };
    answerId = result.id; currentQuestionId = result.id; currentAnswer = result.answer; updateAnswerUI(); setAnswerStatus('Complete');
    byId<HTMLElement>('questionTypeLabel').textContent = result.questionType?.replace(/_/g, ' ') || 'Question saved'; if (event.duplicate !== true) sessionCount += 1; byId<HTMLElement>('questionCount').textContent = String(sessionCount);
    const displayedAt = performance.now(); markClientMilestone('answerCompleted', displayedAt); showDiagnostic('Answer Completed', displayedAt - answerStartedAt); showDiagnostic('Answer Displayed', displayedAt - answerStartedAt);
    const timings = event.timings as { serverTotalMs?: number; answerMs?: number } | undefined; if (typeof timings?.serverTotalMs === 'number') showDiagnostic('Server Pipeline Total', timings.serverTotalMs); if (typeof timings?.answerMs === 'number') showDiagnostic('AI Answer Generation', timings.answerMs);
    currentQuestionId = ''; pipelineStartedAt = 0; addRecent({ id: result.id, question: result.question, answer: currentAnswer, questionType: result.questionType || null, createdAt: result.createdAt || new Date().toISOString() }); return;
  }
  if (event.type === 'error' && typeof event.error === 'string') { error('answerError', event.error); setAnswerStatus('Error'); }
});
function showDiagnostic(label: string, elapsedMs: number) { const line = document.createElement('span'); line.textContent = `${label}: ${Math.round(elapsedMs)} ms`; const diagnostics = byId<HTMLElement>('diagnostics'); diagnostics.hidden = false; diagnostics.append(line, document.createElement('br')); }
function markClientMilestone(name: string, timestamp = performance.now()) { if (!pipelineStartedAt) pipelineStartedAt = timestamp; showDiagnostic(name, timestamp - pipelineStartedAt); }
function addRecent(item: { id: string; question: string; answer: string; questionType: string | null; createdAt: string }) { savedAnswers = [item, ...savedAnswers.filter(answer => answer.id !== item.id)].slice(0, 20); renderRecent(); }
function updateAnswerUI() { byId<HTMLElement>('answer').textContent = currentAnswer || 'Answer will appear here after you submit a question.'; byId<HTMLElement>('floatingAnswerContent').textContent = currentAnswer; byId<HTMLButtonElement>('openAnswer').hidden = !currentAnswer.trim(); }
function renderRecent() {
  const list = byId<HTMLElement>('recentList'); byId<HTMLElement>('questionCount').textContent = String(sessionCount); byId<HTMLElement>('questionCountFooter').textContent = String(sessionCount); byId<HTMLElement>('questionCountInline').textContent = `(${sessionCount})`;
  if (!savedAnswers.length) { list.innerHTML = '<p class="muted small">No saved questions in this session yet.</p>'; return; }
  list.replaceChildren(...savedAnswers.map(item => { const button = document.createElement('button'); button.className = 'recent-item'; button.type = 'button'; const question = document.createElement('span'); question.textContent = item.question; const time = document.createElement('small'); time.textContent = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); button.append(question, time); button.onclick = () => { byId<HTMLTextAreaElement>('question').value = item.question; byId<HTMLElement>('answerCard').hidden = false; byId<HTMLElement>('questionTypeLabel').textContent = item.questionType?.replace(/_/g, ' ') || 'Saved question'; currentAnswer = item.answer; answerId = item.id; currentQuestionId = item.id; updateAnswerUI(); setAnswerStatus(item.answer ? 'Complete' : 'Waiting'); }; return button; }));
}
function showConnected(session: any, expiresAt?: string, access?: any, openModal = false, profile?: { name?: string | null }) {
  statusEl.classList.add('connected'); statusEl.classList.remove('connecting');
  const workspaceConnection = byId<HTMLElement>('workspaceConnection'); workspaceConnection.textContent = 'Connected'; workspaceConnection.classList.add('connected'); workspaceConnection.classList.remove('connecting');
  const previousSessionId = sessionId; sessionId = session.id || ''; sessionLanguage = session.language || 'English'; currentProvider = session.aiModel || 'ChatGPT'; providerOptions = Array.isArray(session.providers) ? session.providers : [currentProvider];
  if (previousSessionId && previousSessionId !== sessionId) { sessionStartedAt = Date.now(); if (sessionTimer) window.clearInterval(sessionTimer); sessionTimer = window.setInterval(updateTimer, 1000); }
  if (!sessionStartedAt) { sessionStartedAt = session.connectedAt ? new Date(session.connectedAt).getTime() : Date.now(); if (sessionTimer) window.clearInterval(sessionTimer); sessionTimer = window.setInterval(updateTimer, 1000); }
  if (expiresAt) { seenQuestions.clear(); currentQuestionId = ''; answerId = ''; }
  connectView.hidden = true; workspace.hidden = false; statusEl.textContent = '● Connected'; statusEl.style.color = '#63dfa8';
  byId<HTMLElement>('profileName').textContent = profile?.name || 'Practice session';
  byId<HTMLElement>('expiry').textContent = expiresAt ? `Connected · code expires ${new Date(expiresAt).toLocaleString()}` : 'Connected';
  const fields: [string, string][] = [['Company', session.company], ['Job title', session.jobTitle], ['Experience', session.experience || 'Not specified'], ['Resume', session.resume || 'No resume'], ['AI provider', session.aiModel || 'ChatGPT']];
  byId<HTMLElement>('modalRole').textContent = session.jobTitle || 'Interview Practice';
  byId<HTMLElement>('modalExperience').textContent = session.experience || 'Experience not specified';
  byId<HTMLElement>('modalCompany').textContent = session.company || 'No company selected';
  byId<HTMLElement>('modalPlan').textContent = `${access?.plan || session.plan || 'Current'} plan`;
  byId<HTMLElement>('freeAllowance').textContent = session.freePractice ? `${access?.durationMinutes ?? 30} minute free practice session active` : access?.free?.eligible ? 'Free practice available for your next session' : 'Free session allowance used or cooling down';
  byId<HTMLButtonElement>('startFreeSession').disabled = access?.sessionEligible !== true;
  byId<HTMLButtonElement>('startFreeSession').textContent = 'Continue Practice';
  byId<HTMLElement>('creditBalance').textContent = access?.credits?.enabled ? `${access.credits.balance ?? '0'} available credits` : 'Credits unavailable';
  byId<HTMLElement>('creditDetails').textContent = access?.credits?.enabled ? `${access.credits.sessionCost} credits per paid practice session. Credits are securely managed in your Genzz AI wallet.` : 'Wallet details could not be loaded.';
  byId<HTMLElement>('details').replaceChildren(...fields.map(([label, value]) => { const box = document.createElement('div'); box.className = 'detail'; const name = document.createElement('span'); name.textContent = label; const text = document.createElement('strong'); text.textContent = value || '—'; box.append(name, text); return box; }));
  loadPreferences(session); savedAnswers = Array.isArray(session.recentAnswers) ? session.recentAnswers : []; sessionCount = typeof session.questionCount === 'number' ? session.questionCount : savedAnswers.length; renderRecent(); updateTimer();
  if (openModal) openSessionModal(byId<HTMLElement>('sessionOptions'));
}
function openSessionModal(returnFocus?: HTMLElement) {
  const modal = byId<HTMLElement>('sessionModal'); if (!modal.hidden) return;
  modalReturnFocus = returnFocus || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  modal.hidden = false; workspace.setAttribute('aria-hidden', 'true');
  document.querySelector('.apphead')?.setAttribute('aria-hidden', 'true'); document.querySelector('.titlebar')?.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = 'hidden';
  byId<HTMLElement>('sessionModalClose').focus();
}
function closeSessionModal() {
  const modal = byId<HTMLElement>('sessionModal'); if (modal.hidden) return;
  modal.hidden = true; workspace.removeAttribute('aria-hidden');
  document.querySelector('.apphead')?.removeAttribute('aria-hidden'); document.querySelector('.titlebar')?.removeAttribute('aria-hidden');
  document.body.style.overflow = '';
  (modalReturnFocus?.isConnected ? modalReturnFocus : byId<HTMLElement>('sessionOptions')).focus(); modalReturnFocus = null;
}
function updateTimer() { if (!sessionStartedAt) return; const seconds = Math.max(0, Math.floor((Date.now() - sessionStartedAt) / 1000)); byId<HTMLElement>('sessionTimer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function stopSessionTimer() { if (sessionTimer) window.clearInterval(sessionTimer); sessionTimer = undefined; sessionStartedAt = 0; }
function showDisconnected(message = '') {
  statusEl.classList.remove('connected', 'connecting');
  const workspaceConnection = byId<HTMLElement>('workspaceConnection'); workspaceConnection.textContent = 'Disconnected'; workspaceConnection.classList.remove('connected', 'connecting');
  stopSessionTimer(); if (activeStreamRequestId) window.genzz.cancelAnswerStream(activeStreamRequestId); if (listening) void stopListening(false);
  connectView.hidden = false; workspace.hidden = true; statusEl.textContent = '○ Disconnected'; statusEl.style.color = '#a5a4b4'; if (message) error('connectError', message);
}
createSpeechPanel();
byId<HTMLButtonElement>('sessionOptions').onclick = () => openSessionModal();
byId<HTMLButtonElement>('sessionModalClose').onclick = closeSessionModal;
byId<HTMLButtonElement>('sessionModalBack').onclick = closeSessionModal;
byId<HTMLButtonElement>('startFreeSession').onclick = async () => {
  const button = byId<HTMLButtonElement>('startFreeSession'), message = byId<HTMLElement>('sessionModalMessage');
  button.disabled = true; button.textContent = 'Verifying session…'; message.textContent = '';
  try {
    const result = await window.genzz.activate(rootInput.value.trim());
    if (result.status !== 'ACTIVE' || result.session?.id !== sessionId) throw new Error('This practice session is no longer active. Reconnect from the web app.');
    byId<HTMLElement>('expiry').textContent = result.durationNotice || 'Connected practice session active.';
    closeSessionModal();
  } catch (e) { message.textContent = e instanceof Error ? e.message : 'Unable to start practice. Check your connection and try again.'; }
  finally { button.disabled = false; button.textContent = 'Start Free Session'; }
};
byId<HTMLButtonElement>('buyCredits').onclick = async () => { try { await window.genzz.openDashboard(rootInput.value.trim()); } catch (e) { byId<HTMLElement>('sessionModalMessage').textContent = e instanceof Error ? e.message : 'Unable to open your Genzz AI wallet.'; } };
byId<HTMLButtonElement>('backToDashboard').onclick = async () => { try { await window.genzz.openDashboard(rootInput.value.trim()); } catch (e) { byId<HTMLElement>('sessionModalMessage').textContent = e instanceof Error ? e.message : 'Unable to open the Genzz AI dashboard.'; } };
byId<HTMLElement>('sessionModal').addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeSessionModal(); return; }
  if (event.key !== 'Tab') return;
  const nodes = Array.from(byId<HTMLElement>('sessionModal').querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'));
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach(item => { item.classList.toggle('active', item === button); item.removeAttribute('aria-current'); });
  button.setAttribute('aria-current', 'page');
  const destination = button.dataset.nav;
  if (destination === 'questions') byId<HTMLElement>('questionCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (destination === 'interview') byId<HTMLElement>('speechPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (destination === 'resume') document.querySelector<HTMLElement>('.session-overview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (destination === 'preferences') byId<HTMLElement>('desktopPreferences').scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (destination === 'history') { byId<HTMLDetailsElement>('recentPanel').open = true; byId<HTMLElement>('recentPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}));
try { const savedRoot = localStorage.getItem('desktopServerOrigin'); if (savedRoot) rootInput.value = savedRoot; } catch { /* Storage may be unavailable in restricted desktop profiles. */ }
rootInput.addEventListener('change', () => { try { localStorage.setItem('desktopServerOrigin', rootInput.value.trim()); } catch { /* The address still works for this session. */ } });
byId<HTMLInputElement>('code').addEventListener('input', event => { const input = event.currentTarget as HTMLInputElement; input.value = input.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '').slice(0, 8); });
byId<HTMLButtonElement>('connect').onclick = async () => {
  if (busy) return; busy = true; const button = byId<HTMLButtonElement>('connect'); button.disabled = true; button.textContent = 'Connecting…'; error('connectError'); statusEl.textContent = '◌ Connecting…';
  try { const result = await window.genzz.connect(rootInput.value.trim(), byId<HTMLInputElement>('code').value); showConnected(result.session, result.expiresAt, result.access, false, result.profile); byId<HTMLInputElement>('code').value = ''; if (localStorage.getItem('notifications') !== 'off' && Notification.permission === 'granted') new Notification('Genzz AI', { body: 'Interview session connected.' }); }
  catch (e) { statusEl.textContent = '○ Disconnected'; error('connectError', e instanceof Error ? e.message : 'Connection failed.'); }
  finally { busy = false; button.disabled = false; button.textContent = 'Connect'; }
};
byId<HTMLButtonElement>('cancel').onclick = () => { byId<HTMLInputElement>('code').value = ''; error('connectError'); };
byId<HTMLButtonElement>('footerEnd').onclick = () => byId<HTMLButtonElement>('disconnect').click();
byId<HTMLButtonElement>('openAnswer').onclick = () => { byId<HTMLElement>('floatingAnswerBackdrop').hidden = false; byId<HTMLElement>('floatingAnswerWindow').focus(); };
byId<HTMLButtonElement>('floatingClose').onclick = () => { byId<HTMLElement>('floatingAnswerBackdrop').hidden = true; byId<HTMLButtonElement>('openAnswer').focus(); };
byId<HTMLButtonElement>('floatingExpand').onclick = () => { const box = byId<HTMLElement>('floatingAnswerWindow'); box.classList.toggle('expanded'); byId<HTMLButtonElement>('floatingExpand').textContent = box.classList.contains('expanded') ? 'Restore' : 'Expand'; };
byId<HTMLButtonElement>('floatingCopy').onclick = () => void copyAnswer();
byId<HTMLButtonElement>('answerCopy').onclick = () => void copyAnswer();
async function copyAnswer() { if (!currentAnswer.trim()) return; try { await navigator.clipboard.writeText(currentAnswer); } catch { error('answerError', 'Could not copy the answer.'); } }
byId<HTMLButtonElement>('floatingClear').onclick = byId<HTMLButtonElement>('clearAnswer').onclick = () => { currentAnswer = ''; updateAnswerUI(); setAnswerStatus('Visible answer cleared'); };
byId<HTMLButtonElement>('floatingAnswerTab').onclick = () => { byId<HTMLElement>('floatingAnswerContent').hidden = false; byId<HTMLElement>('floatingChatPlaceholder').hidden = true; byId<HTMLButtonElement>('floatingAnswerTab').setAttribute('aria-pressed', 'true'); byId<HTMLButtonElement>('floatingChatTab').setAttribute('aria-pressed', 'false'); };
byId<HTMLButtonElement>('floatingChatTab').onclick = () => { byId<HTMLElement>('floatingAnswerContent').hidden = true; byId<HTMLElement>('floatingChatPlaceholder').hidden = false; byId<HTMLButtonElement>('floatingAnswerTab').setAttribute('aria-pressed', 'false'); byId<HTMLButtonElement>('floatingChatTab').setAttribute('aria-pressed', 'true'); };
byId<HTMLButtonElement>('editAnswer').onclick = () => { const editor = byId<HTMLTextAreaElement>('answerEditor'); editor.value = currentAnswer; editor.hidden = false; byId<HTMLElement>('answer').hidden = true; editor.focus(); };
byId<HTMLButtonElement>('saveAnswer').onclick = async () => { const editor = byId<HTMLTextAreaElement>('answerEditor'); if (editor.hidden || !answerId) return; const button = byId<HTMLButtonElement>('saveAnswer'); button.disabled = true; try { const result = await window.genzz.version(rootInput.value.trim(), answerId, 'EDIT', editor.value); currentAnswer = result.version?.answer || editor.value; updateAnswerUI(); const item = savedAnswers.find(answer => answer.id === answerId); if (item) item.answer = currentAnswer; editor.hidden = true; byId<HTMLElement>('answer').hidden = false; setAnswerStatus('Saved'); } catch (e) { error('answerError', e instanceof Error ? e.message : 'Unable to save this edit.'); } finally { button.disabled = false; } };
byId<HTMLButtonElement>('disconnect').onclick = async () => {
  if (!sessionId || !window.confirm('End this practice session?')) return;
  const button = byId<HTMLButtonElement>('disconnect'); button.disabled = true;
  try {
    await stopListening(false);
    const result = await window.genzz.end(rootInput.value.trim());
    stopSessionTimer();
    byId<HTMLElement>('workspaceConnection').textContent = 'Completed';
    byId<HTMLElement>('workspaceConnection').classList.remove('connected');
    byId<HTMLElement>('status').textContent = 'Practice complete';
    byId<HTMLButtonElement>('generate').disabled = true;
    byId<HTMLButtonElement>('disconnect').disabled = true;
    byId<HTMLButtonElement>('footerEnd').disabled = true;
    const feedback = result.summary && typeof result.summary === 'object' ? result.summary : null;
    byId<HTMLElement>('completionStats').textContent = `${result.answerCount ?? sessionCount} saved answers · ${Math.floor((result.durationSeconds || 0) / 60)} minutes`;
    byId<HTMLElement>('completionFeedback').textContent = feedback ? [feedback.overallSummary, ...(feedback.strengths || []).map((item: any) => `Strength: ${item.title || item}`), ...(feedback.improvementAreas || []).map((item: any) => `Practice next: ${item.title || item}`)].filter(Boolean).join('\n\n') : 'Your saved questions and answers are available in session history.';
    byId<HTMLDialogElement>('completionDialog').showModal();
  } catch (e) { error('answerError', e instanceof Error ? e.message : 'Unable to end the practice session.'); }
  finally { button.disabled = byId<HTMLElement>('workspaceConnection').textContent === 'Completed'; }
};
byId<HTMLButtonElement>('viewFeedback').onclick = () => { const dialog = byId<HTMLDialogElement>('completionDialog'); dialog.close(); void window.genzz.openDashboard(rootInput.value.trim(), 'session', sessionId); };
byId<HTMLButtonElement>('practiceAgain').onclick = () => { byId<HTMLDialogElement>('completionDialog').close(); void window.genzz.openDashboard(rootInput.value.trim(), 'create'); };
byId<HTMLButtonElement>('completionDashboard').onclick = () => { byId<HTMLDialogElement>('completionDialog').close(); void window.genzz.openDashboard(rootInput.value.trim(), 'dashboard'); };
byId<HTMLButtonElement>('generate').onclick = () => void generateAnswer(byId<HTMLTextAreaElement>('question').value.trim(), currentQuestionId || undefined);
document.querySelectorAll<HTMLButtonElement>('.variant').forEach(button => button.onclick = async () => {
  if (!answerId || busy) return; busy = true; const action = button.dataset.action || ''; button.disabled = true; const label = button.textContent; button.textContent = 'Working…'; error('answerError');
  try { const result = await window.genzz.version(rootInput.value.trim(), answerId, action); currentAnswer = result.version.answer; updateAnswerUI(); setAnswerStatus('Complete'); const item = savedAnswers.find(answer => answer.id === answerId); if (item) item.answer = currentAnswer; }
  catch (e) { error('answerError', e instanceof Error ? e.message : 'Unable to update answer.'); }
  finally { busy = false; button.disabled = false; button.textContent = label; }
});
byId<HTMLButtonElement>('settingsJump').onclick = () => { const settings = byId<HTMLDetailsElement>('settingsPanel'); settings.open = true; settings.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
byId<HTMLButtonElement>('footerSettings').onclick = byId<HTMLButtonElement>('settingsJump').onclick;
byId<HTMLButtonElement>('footerMicButton').onclick = () => { if (listening) void stopListening(true); else byId<HTMLButtonElement>('startListeningText').click(); };
byId<HTMLButtonElement>('min').onclick = () => window.genzz.minimize(); byId<HTMLButtonElement>('max').onclick = () => window.genzz.maximize(); byId<HTMLButtonElement>('close').onclick = () => window.genzz.close();
for (const id of ['theme', 'fontSize', 'windowSize', 'notifications']) { const select = byId<HTMLSelectElement>(id), stored = localStorage.getItem(id); if (stored && Array.from(select.options).some(option => option.value === stored || option.text === stored)) select.value = stored; select.onchange = () => { localStorage.setItem(id, select.value); applySettings(); if (id === 'notifications' && select.value === 'on' && Notification.permission === 'default') void Notification.requestPermission(); }; }
function applySettings() { document.documentElement.style.fontSize = `${byId<HTMLSelectElement>('fontSize').value}px`; const size = byId<HTMLSelectElement>('windowSize').value; document.body.style.zoom = size === 'compact' ? '0.9' : size === 'large' ? '1.08' : '1'; const theme = byId<HTMLSelectElement>('theme').value; document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme; }
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (byId<HTMLSelectElement>('theme').value === 'system') applySettings(); });
applySettings();
window.genzz.onTrayAction(action => { if (action === 'reconnect') { void stopListening(false); void window.genzz.forget(); showDisconnected(); } if (action === 'session-info') void window.genzz.session(rootInput.value.trim()).then(data => showConnected(data.session, data.expiresAt, data.access, false, data.profile)).catch(e => error('connectError', e instanceof Error ? e.message : 'Unable to load session information.')); });
window.genzz.onConnectCode(code => { byId<HTMLInputElement>('code').value = code; error('connectError'); statusEl.textContent = '○ Disconnected'; });
