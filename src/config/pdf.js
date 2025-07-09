import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const DEFAULT_FONT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/fonts/DejaVuSans.ttf'
);

function isReadable(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch (_) {
    return false;
  }
}

const candidate = process.env.PDF_FONT_PATH || DEFAULT_FONT;
let fontPath;
if (isReadable(candidate)) {
  fontPath = candidate;
} else {
  if (process.env.PDF_FONT_PATH) {
    console.warn(`PDF font not found at ${candidate}, falling back to default`);
  }
  fontPath = undefined;
}

export const PDF_FONT_PATH = fontPath;
