import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './env.js';

// Candidate font directories, in priority order
const CANDIDATE_FONT_DIRS = [
  process.env.PDF_FONT_DIR,
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../assets/fonts'
  ),
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../client/src/fonts'
  ),
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
  return resolveLogo('PDF_FEDERATION_LOGO', 'fhm-logo.png');
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
  // E-sign stamp and QR tuning
  stampWidth: process.env.PDF_STAMP_WIDTH
    ? Number(process.env.PDF_STAMP_WIDTH)
    : 270,
  // Optional minimum width for the e-sign stamp when auto-shrinking is applied
  stampWidthMin: process.env.PDF_STAMP_MIN_WIDTH
    ? Number(process.env.PDF_STAMP_MIN_WIDTH)
    : 220,
  stampHeight: process.env.PDF_STAMP_HEIGHT
    ? Number(process.env.PDF_STAMP_HEIGHT)
    : 66,
  stampGap: process.env.PDF_STAMP_GAP ? Number(process.env.PDF_STAMP_GAP) : 10,
  stampPadX: process.env.PDF_STAMP_PAD_X
    ? Number(process.env.PDF_STAMP_PAD_X)
    : 10,
  stampPadY: process.env.PDF_STAMP_PAD_Y
    ? Number(process.env.PDF_STAMP_PAD_Y)
    : 8,
  qrMinSize: process.env.PDF_QR_MIN_SIZE
    ? Number(process.env.PDF_QR_MIN_SIZE)
    : 40,
  // Target proportion of QR side to the smaller of stamp inner width/height.
  // Clamped in code to a sane range [0.25..0.6].
  qrIdealRatio: process.env.PDF_QR_IDEAL_RATIO
    ? Number(process.env.PDF_QR_IDEAL_RATIO)
    : 0.46,
  qrQuietZoneModules: process.env.PDF_QR_QUIET_MODULES
    ? Number(process.env.PDF_QR_QUIET_MODULES)
    : 4,
};

// Visual style for PDF elements (info boxes etc.)
const STYLE_VARIANT = (process.env.PDF_STYLE_VARIANT || 'brand').toLowerCase();
const VARIANTS = {
  compact: { borderWidth: 0.6, radius: 4, padX: 8, padY: 6 },
  brand: { borderWidth: 0.8, radius: 6, padX: 10, padY: 8 },
  cozy: { borderWidth: 1.0, radius: 8, padX: 12, padY: 10 },
};
const chosen = VARIANTS[STYLE_VARIANT] || VARIANTS.brand;

export const PDF_STYLE = {
  infoBox: {
    borderWidth: chosen.borderWidth,
    borderColor: '#D0D5DD',
    radius: chosen.radius,
    padX: chosen.padX,
    padY: chosen.padY,
    background: '#FAFAFA',
    primaryColor: '#000000',
    secondaryColor: '#666666',
    primarySize: 11,
    secondarySize: 10,
  },
  caption: {
    color: '#666666',
    size: 9,
  },
};
