import Link from 'next/link';

const pages = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'Draft for legal and operational review. This page is not a representation that the policy has been reviewed or approved.',
    sections: [
      ['Information collected', 'Before publication, document the account, resume, interview practice, preference, device, payment, and diagnostic data the service actually collects, including sources and purposes.'],
      ['AI providers and service providers', 'Identify each provider that receives prompts, resume text, or other personal data; describe the data sent, processing purpose, retention, and applicable provider terms. Do not promise that providers do not retain or train on data until verified.'],
      ['Storage, security, and retention', 'Specify hosting regions, safeguards, retention periods, backup retention, and how uploaded resumes and account data are protected. Confirm these details with the operators before publication.'],
      ['Your choices and contact', 'Add the legal entity, contact address, applicable privacy rights, request process, and any jurisdiction-specific disclosures before publication.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'Draft for legal review. Replace every operational and legal placeholder with terms approved for the service and its operating jurisdictions.',
    sections: [
      ['Operator and eligibility', 'Add the legal operator name, address, eligibility requirements, and governing law after legal review.'],
      ['Acceptable use', 'Describe permitted use, account responsibilities, prohibited conduct, and the process for suspension or account closure.'],
      ['Service availability and disclaimers', 'Document service limitations, availability commitments if any, warranties, liability limits, and dispute procedures only after the operator and counsel confirm them.'],
      ['Contact', 'Add a monitored support and legal-notice contact before publication.'],
    ],
  },
  'ai-usage': {
    title: 'AI Usage Disclosure',
    intro: 'Genzz AI provides practice support. AI-generated interview assistance is not guaranteed to be accurate, employer-specific, or predictive of hiring outcomes.',
    sections: [
      ['How AI is used', 'The service can send user-provided prompts and, when selected, resume or role context to the configured AI provider to generate practice answers, questions, feedback, or preparation material. Confirm the active providers and exact data flows before publication.'],
      ['Review generated content', 'AI output can be incomplete, inaccurate, or unsuitable. Review it before relying on it, and do not treat it as professional, employment, or employer-authored advice.'],
      ['Provider processing', 'Name the providers, explain their applicable data processing and retention terms, and link to their current policies after verification.'],
    ],
  },
  billing: {
    title: 'Subscription and Billing Terms',
    intro: 'Draft for legal and payment-provider review. Billing terms must match the actual products, prices, cancellation process, and jurisdictions before checkout is enabled.',
    sections: [
      ['Plans and charges', 'Insert verified plan features, prices, currency, billing interval, taxes, renewal behavior, and any credit-pack rules.'],
      ['Cancellation and refunds', 'Explain how to cancel, when cancellation takes effect, and the applicable refund process and exceptions after legal review.'],
      ['Payment processing', 'Identify the payment processor and explain which payment details it handles. Do not publish until test-mode and live-mode configuration are clearly separated.'],
      ['Support', 'Add the billing support contact and expected response process.'],
    ],
  },
  'data-deletion': {
    title: 'Data Deletion',
    intro: 'Draft instructions. Confirm the request channel, identity checks, processing times, and backup-retention behavior with the service operator before publication.',
    sections: [
      ['Request deletion', 'Add a monitored account or privacy contact where users can request account and associated data deletion. The current service workflow must be confirmed before promising in-app deletion.'],
      ['What deletion covers', 'Document how account records, resumes and files, interview history, preparation data, billing records, security records, and provider-held data are handled. Explain any records retained for legal or operational reasons only after review.'],
      ['Backups and timing', 'State verified deletion timing and how data expires from backups. Do not promise immediate removal from backups unless the backup system supports it.'],
    ],
  },
} as const;

export type LegalDraftKey = keyof typeof pages;

export function LegalDraftPage({ page }: { page: LegalDraftKey }) {
  const content = pages[page];
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-14 text-slate-100 sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm text-cyan-300 hover:text-cyan-200" href="/">Genzz AI</Link>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Draft · legal review required</p>
        <h1 className="mt-3 text-4xl font-bold">{content.title}</h1>
        <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">{content.intro}</p>
        <div className="mt-9 space-y-7">
          {content.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-xl font-semibold">{heading}</h2>
              <p className="mt-2 leading-7 text-slate-300">{body}</p>
            </section>
          ))}
        </div>
        <nav aria-label="Legal pages" className="mt-12 flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-800 pt-6 text-sm text-cyan-300">
          <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/ai-usage">AI usage</Link><Link href="/billing-terms">Billing</Link><Link href="/data-deletion">Data deletion</Link>
        </nav>
      </article>
    </main>
  );
}
