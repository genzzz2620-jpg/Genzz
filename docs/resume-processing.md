# Resume Processing

## Supported files

Only PDF and DOCX files are accepted. Legacy DOC, TXT, images, archives, and other formats are not supported. Uploads are limited to 10 MB.

PDF text extraction uses PDF.js and supports selectable text. Scanned or image-only PDFs are not OCR-processed. DOCX files are validated as ZIP-based Office documents before text extraction; archive size, entry count, paths, and compression ratios are bounded.

## Private storage

In development, files are stored outside the public web root in `RESUME_STORAGE_DIR` (default: `./data/private-resumes`). The directory and files are created with restrictive permissions where the operating system supports them. Files use random server-generated storage keys; client filenames are display metadata only.

Downloads are streamed through an authenticated route that checks resume ownership. There are no public file URLs. Local disk is not durable/shared storage for most multi-instance or serverless production deployments. Implement the `ResumeStorage` contract in `lib/resume-storage.ts` with private S3-compatible object storage before deploying to such an environment, and configure access controls, encryption, backups, and lifecycle policies there.

## Processing behavior

Uploads are parsed synchronously after storage. Processing status is saved as `PROCESSING`, then `COMPLETED` or `FAILED`. Failed extraction can be retried from the resume list. Extracted text is stored in PostgreSQL and is visible only to the owning user. No AI analysis, resume optimization, or OCR is performed.
