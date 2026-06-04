import type { OcrAdapter } from '../../types/adapters.js';
import { createTesseractAdapter } from './tesseract.adapter.js';

let _instance: OcrAdapter | null = null;

export function getOcrAdapter(): OcrAdapter {
  if (!_instance) {
    _instance = createTesseractAdapter();
  }
  return _instance;
}
