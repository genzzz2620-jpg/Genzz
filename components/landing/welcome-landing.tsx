'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Circle,
  Copy,
  FileText,
  LayoutDashboard,
  Mic,
  Minus,
  MessageSquare,
  Monitor,
  Pencil,
  NotebookTabs,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Upload,
  UserRound,
  Zap,
  X,
} from 'lucide-react';

const navigationItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Interview Sessions', icon: MessageSquare },
  { label: 'Resumes', icon: FileText },
  { label: 'Question Bank', icon: BookOpen },
  { label: 'Resume Maker', icon: NotebookTabs },
];

const features = [
  { icon: Sparkles, title: 'AI Interview Practice', description: 'Practice with answers shaped around your role, experience, and preferences.' },
  { icon: UserRound, title: 'Resume-Based Preparation', description: 'Bring your uploaded resume into focused, personalized practice sessions.' },
  { icon: BookOpen, title: 'Question Bank', description: 'Explore HR, technical, behavioral, and scenario-based practice prompts.' },
  { icon: FileText, title: 'Resume Maker', description: 'Create and improve a professional resume for your next opportunity.' },
  { icon: Monitor, title: 'Desktop Practice', description: 'Access authorized practice sessions from the companion desktop application.' },
  { icon: Zap, title: 'Multiple AI Models', description: 'Choose a supported AI provider for your preparation workflow.' },
];

const languageAnswers: Record<string, string[]> = {
  English: [
    'I start by checking the scope of the issue and confirming which users or services are affected.',
    'Then I work through connectivity, routing, and device logs to isolate the cause.',
    'I communicate progress clearly and verify the fix with the people affected.',
  ],
  Hindi: [
    'सबसे पहले मैं समस्या का दायरा समझता हूं और पता करता हूं कि कौन से उपयोगकर्ता या सेवाएं प्रभावित हैं।',
    'फिर मैं कनेक्टिविटी, रूटिंग और डिवाइस लॉग की जांच करके कारण पहचानता हूं।',
    'मैं प्रगति की जानकारी देता हूं और प्रभावित लोगों के साथ समाधान की पुष्टि करता हूं।',
  ],
  Telugu: [
    'మొదట సమస్య పరిధిని తెలుసుకుని, ఏ వినియోగదారులు లేదా సేవలు ప్రభావితమయ్యాయో నిర్ధారిస్తాను.',
    'తర్వాత కనెక్టివిటీ, రూటింగ్, పరికరాల లాగ్‌లను పరిశీలించి కారణాన్ని గుర్తిస్తాను.',
    'పురోగతిని స్పష్టంగా తెలియజేసి, పరిష్కారాన్ని ప్రభావితమైన వారితో ధృవీకరిస్తాను.',
  ],
};

const toneIntros: Record<string, Record<string, string>> = {
  English: {
    Formal: 'My approach is methodical. ',
    Professional: 'I take a structured approach. ',
    Simple: 'I take it one step at a time. ',
    Conversational: 'I usually start with the basics. ',
  },
  Hindi: {
    Formal: 'मेरा तरीका व्यवस्थित रहता है। ',
    Professional: 'मैं एक व्यवस्थित तरीका अपनाता हूं। ',
    Simple: 'मैं इसे एक-एक कदम करके देखता हूं। ',
    Conversational: 'मैं आमतौर पर बुनियादी जांच से शुरू करता हूं। ',
  },
  Telugu: {
    Formal: 'నా విధానం క్రమబద్ధంగా ఉంటుంది. ',
    Professional: 'నేను క్రమబద్ధమైన విధానాన్ని అనుసరిస్తాను. ',
    Simple: 'నేను ఒక్కో దశగా పరిశీలిస్తాను. ',
    Conversational: 'నేను సాధారణంగా ప్రాథమిక తనిఖీలతో ప్రారంభిస్తాను. ',
  },
};

const starLabels: Record<string, string[]> = {
  English: ['Situation', 'Task', 'Action', 'Result'],
  Hindi: ['स्थिति', 'कार्य', 'कार्रवाई', 'परिणाम'],
  Telugu: ['పరిస్థితి', 'పని', 'చర్య', 'ఫలితం'],
};

const steps = [
  { number: '01', title: 'Create Your Session', detail: 'Choose a company, role, experience level, and optional resume.' },
  { number: '02', title: 'Set Your Preferences', detail: 'Choose answer length, format, tone, language, technical depth, and AI model.' },
  { number: '03', title: 'Practice', detail: 'Use the web practice interface or the desktop practice application.' },
  { number: '04', title: 'Review', detail: 'Review your practice history and keep improving your responses.' },
];

const answerLengths = ['Short', 'Balanced', 'Long'];
const answerFormats = ['Normal', 'Bullet Points', 'Script', 'STAR'];
const tones = ['Formal', 'Professional', 'Simple', 'Conversational'];
const languages = ['English', 'Hindi', 'Telugu'];

type PreviewSettings = {
  length: string;
  format: string;
  tone: string;
  language: string;
};

function preferencePreview(settings: PreviewSettings) {
  const all = languageAnswers[settings.language] || languageAnswers.English;
  const intro = toneIntros[settings.language]?.[settings.tone] || toneIntros.English.Professional;
  const selected = settings.length === 'Short' ? all.slice(0, 1) : settings.length === 'Balanced' ? all.slice(0, 2) : all;

  if (settings.format === 'Bullet Points') {
    return selected.map((part) => `• ${part}`).join('\n');
  }
  if (settings.format === 'STAR') {
    const labels = starLabels[settings.language] || starLabels.English;
    const starContent = [
      all[0],
      all[0],
      all[1],
      all[2],
    ];
    return labels.map((label, index) => `${label}: ${starContent[index]}`).join('\n\n');
  }
  if (settings.format === 'Script') {
    const lead = settings.language === 'Hindi' ? 'मैं कहूंगा: ' : settings.language === 'Telugu' ? 'నేను ఇలా చెబుతాను: ' : 'I would say: ';
    return `${lead}${intro}${selected.join(' ')}`;
  }
  return `${intro}${selected.join(' ')}`;
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="landing-eyebrow">{children}</p>;
}

export function WelcomeLanding() {
  const [settings, setSettings] = useState<PreviewSettings>({
    length: 'Balanced',
    format: 'Normal',
    tone: 'Professional',
    language: 'English',
  });

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="Genzz AI home">
          <span className="landing-brand-mark"><Sparkles size={18} /></span>
          <span>Genzz AI</span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#preview">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <div className="landing-header-actions">
          <Link href="/login" className="landing-login">Login</Link>
          <Link href="/register" className="landing-header-cta">Get started <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <SectionEyebrow><span className="landing-live-dot" /> PREPARE SMARTER. INTERVIEW BETTER.</SectionEyebrow>
          <h1>Prepare Smarter for Your <span>Next Interview</span></h1>
          <p className="landing-hero-subtitle">Practice interviews with AI-powered preparation built around your resume, role, experience, and preferred answer style.</p>
          <div className="landing-hero-actions">
            <Link href="/register" className="landing-button-primary">Start Practicing <ArrowRight size={17} /></Link>
            <Link href="/login" className="landing-button-secondary">Login</Link>
          </div>
          <div className="landing-proofline"><span><Check size={15} /> Your preferences, your practice</span><span><Check size={15} /> Resume-aware sessions</span></div>
        </div>
        <div className="landing-hero-aside" aria-hidden="true">
          <div className="hero-stamp"><span>Make</span><span>every</span><span>answer</span><strong>yours.</strong></div>
          <div className="hero-orbit-label"><span className="hero-orbit-line" /> PRACTICE WITH PURPOSE</div>
          <span className="hero-index">01 / 04</span>
        </div>
      </section>

      <section id="preview" className="landing-preview-section">
        <div className="landing-section-heading landing-preview-heading">
          <div><SectionEyebrow>THE WORKSPACE</SectionEyebrow><h2>One place to get <span>interview-ready.</span></h2></div>
          <p>A closer look at the practice workspace. The example details below are demonstration content only.</p>
        </div>
        <div className="demo-app-window">
          <div className="demo-app-sidebar">
            <div className="demo-app-brand"><span className="demo-app-brand-mark"><Sparkles size={15} /></span><span>Genzz AI</span></div>
            <p className="demo-nav-label">WORKSPACE</p>
            <nav aria-label="Demonstration workspace navigation">
              {navigationItems.map(({ label, icon: Icon }, index) => (
                <div key={label} className={`demo-nav-item ${index === 0 ? 'demo-nav-item-active' : ''}`}><Icon size={15} /><span>{label}</span></div>
              ))}
            </nav>
            <div className="demo-sidebar-foot"><span className="demo-avatar">D</span><span><b>Demo account</b><small>Preview only</small></span></div>
          </div>
          <div className="demo-app-main">
            <div className="demo-app-topbar"><div><span className="demo-breadcrumb">Workspace /</span> Dashboard</div><span className="demo-tag">DEMO</span></div>
            <div className="demo-dashboard-content">
              <div className="demo-welcome-row"><div><span className="demo-date">YOUR PRACTICE OVERVIEW</span><h3>Good morning, Alex</h3><p>Pick up where you left off.</p></div><span className="demo-plan">FREE PLAN</span></div>
              <div className="demo-stat-grid">
                <div className="demo-stat"><span>Practice sessions</span><b>08</b><small><span className="demo-stat-up">+2</span> this week</small></div>
                <div className="demo-stat"><span>Questions practiced</span><b>34</b><small>Across 4 sessions</small></div>
                <div className="demo-stat demo-stat-accent"><span>Readiness check-in</span><b>Getting there</b><small>Keep your rhythm</small></div>
              </div>
              <div className="demo-lower-grid">
                <div className="demo-session-panel">
                  <div className="demo-panel-head"><div><span className="demo-date">DEMO SESSION</span><h4>Recent practice</h4></div><span className="demo-status">ACTIVE</span></div>
                  <div className="demo-session-company"><span className="demo-company-icon"><BriefcaseBusiness size={18} /></span><span><b>Accenture</b><small>Network Engineer</small></span><ArrowUpRight size={16} /></div>
                  <div className="demo-session-meta"><span><small>Experience</small><b>5 Years</b></span><span><small>Answer style</small><b>Balanced</b></span><span><small>AI model</small><b>ChatGPT</b></span></div>
                  <div className="demo-panel-note">Sample session details for demonstration. Not an actual interview or company-provided content.</div>
                </div>
                <div className="demo-quick-panel"><span className="demo-quick-icon"><SlidersHorizontal size={17} /></span><span className="demo-date">SESSION BUILDER</span><h4>Make practice fit you.</h4><p>Choose a role, set your answer preferences, and build a session around your preparation goals.</p><span className="demo-quick-link">Explore the workflow <ArrowRight size={14} /></span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="demo-caption"><span><span className="demo-caption-dot" /> DEMO PREVIEW</span><span>All names and session details shown are illustrative.</span></div>
      </section>

      <section className="landing-interview-section">
        <div className="landing-section-heading"><div><SectionEyebrow>A PRACTICE MOMENT</SectionEyebrow><h2>See How It <span>Works</span></h2></div><p>A sample question and response show how a prepared practice session can feel.</p></div>
        <div className="interview-demo-layout">
          <div className="interview-demo-side"><span className="demo-number">01</span><h3>Think it through.<br />Then say it your way.</h3><p>Use practice to find a clear structure for the experience you want to talk about.</p><span className="example-label"><Sparkles size={14} /> Example AI-generated practice response</span></div>
          <div className="interview-dialogue">
            <div className="dialogue-block"><div className="dialogue-label"><span className="dialogue-label-mark">Q</span><span>QUESTION</span><span className="dialogue-kind">BEHAVIORAL</span></div><p className="dialogue-question">“Tell me about your experience with network troubleshooting.”</p></div>
            <div className="dialogue-divider"><span /></div>
            <div className="dialogue-block"><div className="dialogue-label"><span className="dialogue-label-mark dialogue-label-answer">A</span><span>ANSWER</span><span className="example-chip">DEMO</span></div><p className="dialogue-answer">“I have experience troubleshooting network connectivity, routing, switching, and infrastructure-related issues. I begin by understanding who is affected, then use a structured process to isolate the cause, communicate progress, and verify the resolution.”</p><div className="dialogue-response-footer"><span>Example practice content · not a real interview response</span><span>Balanced · Professional</span></div></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-steps-section">
        <div className="landing-section-heading"><div><SectionEyebrow>YOUR FOUR-STEP ROUTINE</SectionEyebrow><h2>From setup to <span>stronger answers.</span></h2></div><p>A simple loop to make interview preparation more focused and repeatable.</p></div>
        <div className="landing-steps-grid">{steps.map((step) => <article key={step.number} className="step-card"><span className="step-number">{step.number}</span><span className="step-rule" /><h3>{step.title}</h3><p>{step.detail}</p><ArrowUpRight size={18} className="step-arrow" /></article>)}</div>
      </section>

      <section id="features" className="landing-features-section">
        <div className="landing-section-heading"><div><SectionEyebrow>BUILT FOR YOUR PREP</SectionEyebrow><h2>Everything around the <span>interview.</span></h2></div><p>Practical tools that bring your preparation into one connected workspace.</p></div>
        <div className="landing-features-grid">{features.map(({ icon: Icon, title, description }, index) => <article key={title} className="feature-item"><span className={`feature-icon feature-icon-${index}`}><Icon size={19} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <DesktopWorkflowSection />

      <section className="landing-preferences-section">
        <div className="landing-section-heading"><div><SectionEyebrow>YOUR ANSWER STYLE</SectionEyebrow><h2>Choose How You Want <span>Your Answers</span></h2></div><p>Change the settings to see a local example preview. This demo makes no AI requests.</p></div>
        <PreferenceDemo settings={settings} onChange={setSettings} />
      </section>

      <section className="landing-resume-section">
        <div className="resume-demo-copy"><SectionEyebrow>RESUME-AWARE PRACTICE</SectionEyebrow><h2>Start with your story. <span>Build from there.</span></h2><p>Upload a PDF or DOCX resume to keep your experience close while you prepare. In the app, extracted text stays in your private account.</p><Link href="/register" className="landing-text-link">Create an account to explore <ArrowRight size={16} /></Link></div>
        <div className="resume-demo-visual"><div className="resume-upload-line"><span className="resume-upload-icon"><Upload size={17} /></span><span><b>Upload Resume</b><small>PDF / DOCX · Demo</small></span><span className="resume-upload-check"><Check size={15} /></span></div><div className="resume-processing-line"><span className="resume-processing-mark"><FileText size={17} /></span><span className="resume-line" /><span className="resume-processing-done"><Check size={13} /></span></div><div className="resume-extract-card"><div className="resume-card-heading"><span>RESUME PREVIEW</span><span className="demo-tag">DEMO</span></div><h3>Alex Morgan</h3><p>Network Engineer</p><div className="resume-skill-label">EXAMPLE SKILLS</div><div className="resume-skill-list"><span>TCP/IP</span><span>Routing</span><span>Switching</span><span>Troubleshooting</span></div><div className="resume-demo-foot">Illustrative sample information only. No real resume is uploaded on this page.</div></div></div>
      </section>

      <section className="landing-final-cta"><div><span className="landing-live-dot" /><span>YOUR NEXT PRACTICE SESSION STARTS HERE</span></div><h2>Make your next interview<br /><em>feel more familiar.</em></h2><Link href="/register" className="landing-button-primary">Start Practicing <ArrowRight size={17} /></Link></section>

      <footer className="landing-footer"><Link href="/" className="landing-brand"><span className="landing-brand-mark"><Sparkles size={16} /></span><span>Genzz AI</span></Link><p>Prepare Smarter. Interview Better.</p><div><Link href="/login">Login</Link><Link href="/register">Create account</Link></div><small>© 2026 Genzz AI · Demo content is illustrative.</small></footer>
    </main>
  );
}

function DesktopWorkflowSection() {
  const [previewListening, setPreviewListening] = useState(false);

  return (
    <section className="desktop-workflow-section" aria-labelledby="desktop-workflow-title">
      <div className="desktop-workflow-inner">
        <div className="desktop-workflow-heading">
          <div>
            <span className="desktop-workflow-badge"><Monitor size={13} /> Genzz AI Desktop</span>
            <h2 id="desktop-workflow-title">How Genzz AI Works <span>on Desktop</span></h2>
          </div>
          <p>Connect your practice session to the Genzz AI desktop app and get personalized AI-powered interview practice in a focused workspace.</p>
        </div>

        <div className="desktop-preview-caption"><span><span className="desktop-preview-caption-dot" /> DESKTOP APP PREVIEW</span><span>Illustrative practice session · No installation required</span></div>
        <div className="desktop-app-window" aria-label="Demonstration of the Genzz AI Windows desktop application">
          <div className="desktop-titlebar">
            <div className="desktop-titlebar-app"><span className="desktop-titlebar-logo"><Sparkles size={13} /></span><span>Genzz AI</span><span className="desktop-titlebar-divider">—</span><span className="desktop-titlebar-subtitle">Interview Practice</span></div>
            <div className="desktop-window-controls" aria-hidden="true"><span><Minus size={12} /></span><span><Square size={10} /></span><span className="desktop-window-close"><X size={12} /></span></div>
          </div>

          <div className="desktop-app-body">
            <aside className="desktop-app-sidebar">
              <div className="desktop-app-brand"><span><Sparkles size={16} /></span><div><b>Genzz AI</b><small>Interview Practice</small></div></div>
              <p className="desktop-nav-label">WORKSPACE</p>
              <nav className="desktop-app-nav" aria-label="Desktop preview navigation">
                <div className="desktop-nav-item desktop-nav-item-active"><MessageSquare size={15} />Interview</div>
                <div className="desktop-nav-item"><Circle size={14} />Questions</div>
                <div className="desktop-nav-item"><FileText size={15} />Resume</div>
                <div className="desktop-nav-item"><SlidersHorizontal size={15} />Preferences</div>
                <div className="desktop-nav-item"><LayoutDashboard size={15} />Session History</div>
              </nav>
              <div className="desktop-sidebar-bottom">
                <span className="desktop-practice-chip"><span /> Practice Mode</span>
                <p><ShieldCheck size={13} /> Your microphone is controlled by you.</p>
              </div>
            </aside>

            <div className="desktop-app-main">
              <div className="desktop-app-topbar">
                <div><span className="desktop-topbar-kicker">PRACTICE WORKSPACE</span><h3>Interview Practice</h3></div>
                <span className="desktop-connected"><i /> Connected</span>
              </div>

              <div className="desktop-session-header">
                <div className="desktop-session-icon"><BriefcaseBusiness size={18} /></div>
                <div className="desktop-session-copy"><span>ACTIVE PRACTICE SESSION</span><h4>Java Developer — Practice Session</h4><p>Example Technology Company <b>·</b> 4+ Years</p></div>
                <span className="desktop-demo-pill">DEMO</span>
              </div>

              <div className="desktop-content-grid">
                <section className="desktop-transcript-card">
                  <div className="desktop-card-heading"><div><span className="desktop-card-icon desktop-mic-icon"><AudioLines size={15} /></span><div><span className="desktop-card-eyebrow">LIVE TRANSCRIPT</span><h5>Listen and review</h5></div></div><span className="desktop-sample-label">SAMPLE</span></div>
                  <div className="desktop-transcript-body"><span className="desktop-transcript-quote">“</span><p>Can you explain how you handled a production issue in your previous project?</p></div>
                  <div className="desktop-detected-state"><span className="desktop-live-pulse" /><span>Question detected</span><span className="desktop-detected-time">DEMO</span></div>
                  <div className={`desktop-microphone ${previewListening ? 'desktop-microphone-listening' : ''}`}>
                    <div className="desktop-microphone-status"><span className="desktop-mic-round"><Mic size={16} /></span><div><b>{previewListening ? 'Listening' : 'Microphone Off'}</b><small>{previewListening ? 'Visual preview only · no audio is captured' : 'Microphone is currently off'}</small></div><span className="desktop-mic-state-dot" /></div>
                    <button type="button" onClick={() => setPreviewListening((current) => !current)} className="desktop-listen-button"><Mic size={14} />{previewListening ? 'Stop Preview' : 'Start Listening'}</button>
                  </div>
                </section>

                <section className="desktop-answer-card">
                  <div className="desktop-card-heading"><div><span className="desktop-card-icon desktop-answer-icon"><Sparkles size={15} /></span><div><span className="desktop-card-eyebrow">AI PRACTICE ANSWER</span><h5>A thoughtful way to respond</h5></div></div><span className="desktop-answer-ready"><i /> READY</span></div>
                  <p className="desktop-answer-text">“I would approach a production issue by first assessing the impact and priority, then coordinating the relevant teams to isolate the root cause. I would communicate updates clearly to stakeholders, implement the appropriate resolution, and document the RCA and preventive actions afterward.”</p>
                  <div className="desktop-answer-metadata"><span><small>FORMAT</small><b>Professional</b></span><span><small>LENGTH</small><b>Balanced</b></span><span><small>TECHNICAL DEPTH</small><b>Intermediate</b></span><span><small>PROVIDER</small><b>AI</b></span></div>
                  <p className="desktop-answer-context"><ShieldCheck size={13} /> Practice answer generated from your selected resume, role and preferences.</p>
                  <div className="desktop-answer-actions"><button type="button"><Copy size={13} />Copy</button><button type="button"><Pencil size={13} />Edit</button><button type="button"><RefreshCw size={13} />Regenerate</button><button type="button" className="desktop-save-button"><Save size={13} />Save</button></div>
                </section>
              </div>
              <div className="desktop-app-footer"><span><ShieldCheck size={13} /> Practice Mode · Use only where AI assistance is permitted</span><span>DEMONSTRATION CONTENT</span></div>
            </div>
          </div>
        </div>
        <p className="desktop-workflow-disclaimer">This is a visual demonstration of the desktop practice workspace. The page does not request microphone access or capture audio.</p>
      </div>
    </section>
  );
}

function PreferenceDemo({ settings, onChange }: { settings: PreviewSettings; onChange: (settings: PreviewSettings) => void }) {
  const change = (field: keyof PreviewSettings, value: string) => onChange({ ...settings, [field]: value });
  return (
    <div className="preference-demo">
      <div className="preference-controls">
        <PreferenceGroup label="ANSWER LENGTH" options={answerLengths} value={settings.length} onSelect={(value) => change('length', value)} />
        <PreferenceGroup label="ANSWER FORMAT" options={answerFormats} value={settings.format} onSelect={(value) => change('format', value)} />
        <PreferenceGroup label="TONE" options={tones} value={settings.tone} onSelect={(value) => change('tone', value)} />
        <PreferenceGroup label="LANGUAGE" options={languages} value={settings.language} onSelect={(value) => change('language', value)} />
      </div>
      <div className="preference-preview">
        <div className="preference-preview-head"><span><Sparkles size={15} /> RESPONSE PREVIEW</span><span className="demo-tag">LOCAL DEMO</span></div>
        <p className="preference-preview-question">How do you approach a network issue?</p>
        <div className="preference-preview-answer" aria-live="polite">{preferencePreview(settings)}</div>
        <div className="preference-preview-foot"><span>{settings.length} · {settings.format} · {settings.tone} · {settings.language}</span><span>No AI API calls</span></div>
      </div>
    </div>
  );
}

function PreferenceGroup({ label, options, value, onSelect }: { label: string; options: string[]; value: string; onSelect: (value: string) => void }) {
  return (
    <fieldset className="preference-group"><legend>{label}</legend><div className="preference-options">{options.map((option) => <button key={option} type="button" className={value === option ? 'preference-option preference-option-active' : 'preference-option'} aria-pressed={value === option} onClick={() => onSelect(option)}>{option}</button>)}</div></fieldset>
  );
}
