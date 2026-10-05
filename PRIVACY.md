# Privacy and data handling

## Account information

The application stores a user's name, email address, bcrypt password hash, subscription state, account role/status, and activity timestamps. If a user chooses to save onboarding preferences, the account also stores a target role, experience level, preferred answer language, answer format, AI provider, and onboarding progress. Passwords are not stored in plaintext. A complete account export and account deletion workflow are not currently available; contact the service operator for account-level data requests until those controls exist.

## Resume processing

PDF and DOCX uploads are stored in a private server-side directory outside the public web root, associated with the owning account, and checked through authenticated endpoints. The application extracts resume text and stores it in the database for interview and resume-maker features. Uploading a resume does not make it available through a public URL. Users can delete an uploaded resume; deletion removes its database record and attempts to remove its stored file. Existing interview records may continue to contain answers generated using that resume.

## AI processing

When a user requests AI assistance, the server sends the question and relevant session settings to the selected configured AI provider. Interview generation selects relevant resume and job-description excerpts, and includes user-supplied custom instructions as untrusted reference text. Explicit resume import or optimization can send the extracted resume and selected resume/job data to the configured provider. AI providers process that data under their own service terms. The app stores generated answers and request metadata such as provider, model, status, and available token counts; provider keys and full prompts are not returned to the browser.

## Speech-to-text

Microphone access requires an explicit user action and OS/browser permission. The desktop displays a microphone status and provides a stop control. Speech recognition is provided by the browser/Electron recognition service and may send audio to that service. Genzz AI does not intentionally store raw audio. Recognized transcript/question text can be saved as an interview answer in the account's interview history.

## Interview history and desktop connections

Interview sessions, questions, generated answers, answer versions, and AI usage records are stored in the application database. Users can delete interview sessions through the history controls; dependent answers, AI usage records linked to the session, and desktop connections are removed by database relations. Desktop connection codes expire after five minutes and are single-use. Desktop bearer tokens are stored as hashes in the database, held in application memory on the desktop, expire after two hours, and can be revoked by disconnecting or by administrator suspension.

## Subscription information

The application stores plan/status, provider customer/subscription references, dates, and cancellation state. It does not store payment card numbers or CVV. Payment credentials stay server-side; Stripe handles payment credentials under its own privacy terms.

## Admin access

Administrators with the server-side ADMIN role can see account and service metadata required for support and operations, including interview/session metadata, resume names/status (not resume body in list views), subscription references, AI usage counts/tokens, and audit records. User detail views omit passwords, API keys, full resume content, and answer text. Admin changes are recorded in append-oriented audit records.

## Deletion and retention

Resume deletion removes the uploaded file on a best-effort basis and deletes the resume row. Interview deletion removes the session and dependent answers and linked usage/desktop records through configured cascading relations. Resume-maker documents can be deleted through their existing API and associated versions cascade. Deleting a question can retain interview answer text while unlinking the deleted question-bank item. There is no automatic retention or purge job: standalone AI usage records, subscriptions, and admin audit records may remain until an operator applies a documented retention process. Backups may retain deleted data until backup rotation expires them.

The database and private file store are operated by the service deployment. Backup frequency, backup retention, and provider-side retention depend on the operator's deployment and provider configuration; this repository does not enforce a universal retention period.
