import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './env.js';

// Candidate font directories, in priority order
const CANDIDATE_FONT_DIRS = [
  process.env.PDF_FONT_DIR,
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/src/fonts'),
].filter(Boolean);

function readable(file) {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveFont(name) {
  for (const dir of CANDIDATE_FONT_DIRS) {
    const file = path.join(dir, name);
    if (readable(file)) return file;
  }
  return undefined;
}

export const PDF_FONTS = {
  regular: resolveFont('SBSansText-Regular.ttf'),
  bold: resolveFont('SBSansText-Bold.ttf'),
  italic: resolveFont('SBSansText-Italic.ttf'),
  boldItalic: resolveFont('SBSansText-BoldItalic.ttf'),
};

const DEFAULT_LOGO_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../assets'
);

function resolveLogo(envName, fallback) {
  const envPath = process.env[envName];
  if (envPath && readable(envPath)) return envPath;
  const file = path.join(DEFAULT_LOGO_DIR, fallback);
  return readable(file) ? file : undefined;
}

/* istanbul ignore next */
function resolveFederationLogo() {
  // Priority: env override -> fhm-for-documents.png -> fhm-logo.png
  const env = resolveLogo('PDF_FEDERATION_LOGO', 'fhm-for-documents.png');
  if (env) return env;
  const alt1 = resolveLogo('PDF_FEDERATION_LOGO', 'fhm-logo.png');
  return alt1;
}

export const PDF_LOGOS = {
  federation: resolveFederationLogo(),
  system: resolveLogo('PDF_SYSTEM_LOGO', 'system-logo.png'),
};

export const PDF_META = {
  systemLabel: process.env.PDF_SYSTEM_LABEL || undefined,
  // Optional style tuning for barcodes
  barcodeWidth: process.env.PDF_BARCODE_WIDTH
    ? Number(process.env.PDF_BARCODE_WIDTH)
    : undefined,
  barcodeOpacity: process.env.PDF_BARCODE_OPACITY
    ? Number(process.env.PDF_BARCODE_OPACITY)
    : undefined,
};
