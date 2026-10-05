import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ResumeExtension = 'pdf' | 'docx';

export interface ResumeStorage {
  upload(buffer: Buffer, extension: ResumeExtension): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

const keyPattern = /^[0-9a-f-]{36}\.(pdf|docx)$/i;

function storageDirectory() {
  const configuredDirectory = process.env.RESUME_STORAGE_DIR || './data/private-resumes';
  const directory = path.resolve(process.cwd(), configuredDirectory);
  const publicDirectory = path.resolve(process.cwd(), 'public');
  const relativeToPublic = path.relative(publicDirectory, directory);
  if (relativeToPublic === '' || (!relativeToPublic.startsWith('..') && !path.isAbsolute(relativeToPublic))) {
    throw new Error('Resume storage must be outside the public directory.');
  }
  return directory;
}

function filePath(storageKey: string) {
  if (!keyPattern.test(storageKey)) {
    throw new Error('Invalid storage key.');
  }
  return path.join(storageDirectory(), storageKey);
}

export class ResumeStorageService implements ResumeStorage {
  async upload(buffer: Buffer, extension: ResumeExtension) {
    const storageKey = `${randomUUID()}.${extension}`;
    await mkdir(storageDirectory(), { recursive: true, mode: 0o700 });
    await writeFile(filePath(storageKey), buffer, { flag: 'wx', mode: 0o600 });
    return storageKey;
  }

  async get(storageKey: string) {
    return readFile(filePath(storageKey));
  }

  async delete(storageKey: string) {
    try {
      await unlink(filePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export const resumeStorage = new ResumeStorageService();
