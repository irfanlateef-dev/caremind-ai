import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { logger } from '../../config/logger.js';
import { AppError } from '../../core/errors.js';
import type { OcrAdapter } from '../../types/adapters.js';

const execFileAsync = promisify(execFile);

const TESSERACT_LANG = process.env.TESSERACT_LANG ?? 'eng';
const TESSERACT_PDF_DPI = process.env.TESSERACT_PDF_DPI ?? '200';
const TESSERACT_MAX_PDF_PAGES = Number(process.env.TESSERACT_MAX_PDF_PAGES ?? '100');
const EXEC_MAX_BUFFER = 64 * 1024 * 1024;

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'jpg';
}

async function runTesseract(imagePath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'tesseract',
    [imagePath, 'stdout', '-l', TESSERACT_LANG, '--psm', '3'],
    { maxBuffer: EXEC_MAX_BUFFER },
  );
  return typeof stdout === 'string' ? stdout.trim() : '';
}

async function pdfPageImages(pdfPath: string, outDir: string): Promise<string[]> {
  const prefix = join(outDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', TESSERACT_PDF_DPI, pdfPath, prefix], {
    maxBuffer: EXEC_MAX_BUFFER,
  });
  const files = (await readdir(outDir))
    .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files.map((f) => join(outDir, f));
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), 'caremind-pdf-'));
  try {
    const pdfPath = join(workDir, 'document.pdf');
    await writeFile(pdfPath, buffer);

    const imagePaths = await pdfPageImages(pdfPath, workDir);
    if (imagePaths.length === 0) {
      return '';
    }

    const limit = Math.min(imagePaths.length, TESSERACT_MAX_PDF_PAGES);
    if (imagePaths.length > limit) {
      logger.warn(
        { totalPages: imagePaths.length, limit },
        'PDF exceeds TESSERACT_MAX_PDF_PAGES — processing first pages only',
      );
    }

    const parts: string[] = [];
    for (let i = 0; i < limit; i++) {
      const text = await runTesseract(imagePaths[i]!);
      if (text) {
        parts.push(`--- Page ${i + 1} ---\n${text}`);
      }
    }
    return parts.join('\n\n');
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const workDir = await mkdtemp(join(tmpdir(), 'caremind-img-'));
  try {
    const imagePath = join(workDir, `document.${extensionForMime(mimeType)}`);
    await writeFile(imagePath, buffer);
    return await runTesseract(imagePath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function createTesseractAdapter(): OcrAdapter {
  return {
    async extractText({ imageBuffer, mimeType }) {
      try {
        const text =
          mimeType === 'application/pdf'
            ? await extractFromPdf(imageBuffer)
            : await extractFromImage(imageBuffer, mimeType);

        logger.info(
          { mimeType, textLength: text.length },
          'Tesseract text extraction completed',
        );

        return { text };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('ENOENT')) {
          throw new AppError(
            'Tesseract or poppler (pdftoppm) is not installed on the server',
            503,
            'TESSERACT_NOT_AVAILABLE',
          );
        }
        logger.error({ err, mimeType }, 'Tesseract extraction failed');
        throw new AppError(`Tesseract extraction failed: ${message}`, 502, 'TESSERACT_ERROR');
      }
    },
  };
}
