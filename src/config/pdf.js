import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets/fonts'
);

function readable(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

const dir = process.env.PDF_FONT_DIR || DEFAULT_DIR;

function resolveFont(name) {
  const file = path.join(dir, name);
  return readable(file) ? file : undefined;
}

export const PDF_FONTS = {
  regular: resolveFont('SBSansText-Regular.ttf'),
  bold: resolveFont('SBSansText-Bold.ttf'),
  italic: resolveFont('SBSansText-Italic.ttf'),
  boldItalic: resolveFont('SBSansText-BoldItalic.ttf'),
};
