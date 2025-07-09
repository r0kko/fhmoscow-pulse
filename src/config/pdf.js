import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

dotenv.config();

const defaultPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/fonts/DejaVuSans.ttf'
);

const candidate = process.env.PDF_FONT_PATH || defaultPath;
let fontPath;
if (fs.existsSync(candidate)) {
  fontPath = candidate;
} else {
  if (process.env.PDF_FONT_PATH) {
    console.warn(`PDF font not found at ${candidate}, falling back to default`);
  }
  fontPath = undefined;
}

export const PDF_FONT_PATH = fontPath;
