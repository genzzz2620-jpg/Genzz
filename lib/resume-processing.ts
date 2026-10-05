import mammoth from 'mammoth';
import * as yauzl from 'yauzl';
import type { ResumeExtension } from '@/lib/resume-storage';

const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_DOCX_ENTRIES = 2000;
const MAX_PDF_PAGES = 100;
const MAX_EXTRACTED_CHARACTERS = 200000;

export function detectResumeFile(buffer: Buffer, originalName: string, mimeType: string): ResumeExtension {
  const extension = originalName.toLowerCase().split('.').pop();
  const pdfHeader = buffer.subarray(0, 1024).toString('latin1');

  if (extension === 'pdf' && mimeType === 'application/pdf' && pdfHeader.includes('%PDF-')) {
    return 'pdf';
  }

  const zipSignatures = ['504b0304', '504b0506', '504b0708'];
  const hasZipSignature = zipSignatures.includes(buffer.subarray(0, 4).toString('hex'));
  const docxMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'docx' && mimeType === docxMimeType && hasZipSignature) {
    return 'docx';
  }

  throw new Error('Upload a valid PDF or DOCX resume.');
}

export async function extractResumeText(buffer: Buffer, extension: ResumeExtension) {
  const text = extension === 'pdf' ? await extractPdfText(buffer) : await extractDocxText(buffer);
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    throw new Error('No readable text was found in this file. Scanned image-only resumes are not supported yet.');
  }
  if (normalized.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error('The extracted resume text is too long to process.');
  }

  return normalized;
}

async function extractPdfText(buffer: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: true,
  }).promise;

  try {
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error('Resume PDF has too many pages to process.');
    }

    const pages: string[] = [];
    let extractedCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const chunks: string[] = [];
      for (const item of content.items) {
        if ('str' in item && item.str) {
          extractedCharacters += item.str.length;
          if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
            throw new Error('The extracted resume text is too long to process.');
          }
          chunks.push(item.str);
          chunks.push('hasEOL' in item && item.hasEOL ? '\n' : ' ');
        }
      }
      pages.push(chunks.join(''));
      page.cleanup();
    }
    return pages.join('\n\n');
  } finally {
    await document.destroy();
  }
}

async function inspectDocxArchive(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(buffer, {
      lazyEntries: true,
      validateEntrySizes: true,
      strictFileNames: true,
    }, (error, archive) => {
      if (error || !archive) {
        reject(new Error('The DOCX archive is invalid.'));
        return;
      }

      let entryCount = 0;
      let expandedSize = 0;
      let hasContentTypes = false;
      let hasDocumentXml = false;
      let finished = false;
      const fail = () => {
        if (!finished) {
          finished = true;
          archive.close();
          reject(new Error('The DOCX archive is invalid or too large.'));
        }
      };

      archive.on('error', fail);
      archive.on('entry', (entry) => {
        entryCount += 1;
        expandedSize += entry.uncompressedSize;
        const entryName = entry.fileName.replace(/\\/g, '/');
        const segments: string[] = entryName.split('/');
        const hasUnsafeSegment = segments.some((segment) => segment === '..' || segment === '.');
        const compressionRatio = entry.compressedSize === 0
          ? entry.uncompressedSize
          : entry.uncompressedSize / entry.compressedSize;

        if (
          entryCount > MAX_DOCX_ENTRIES ||
          expandedSize > MAX_DOCX_UNCOMPRESSED_BYTES ||
          hasUnsafeSegment ||
          yauzl.validateFileName(entry.fileName) !== null ||
          compressionRatio > 200
        ) {
          fail();
          return;
        }

        if (entryName === '[Content_Types].xml') hasContentTypes = true;
        if (entryName === 'word/document.xml') hasDocumentXml = true;
        archive.readEntry();
      });
      archive.on('end', () => {
        if (finished) return;
        finished = true;
        if (!hasContentTypes || !hasDocumentXml) {
          reject(new Error('This ZIP file is not a valid DOCX document.'));
          return;
        }
        resolve();
      });
      archive.readEntry();
    });
  });
}

async function extractDocxText(buffer: Buffer) {
  await inspectDocxArchive(buffer);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
