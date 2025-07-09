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
export const PDF_FONT_PATH = fs.existsSync(candidate) ? candidate : undefined;
