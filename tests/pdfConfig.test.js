/* global process */
import { beforeAll, expect, jest, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const tmpDir = path.join(process.cwd(), 'tests', '.tmp');

beforeAll(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

test('PDF style variant respects env and falls back', async () => {
  jest.resetModules();
  process.env.PDF_STYLE_VARIANT = 'compact';
  let mod = await import('../src/config/pdf.js');
  expect(mod.PDF_STYLE.infoBox.borderWidth).toBe(0.6);

  jest.resetModules();
  process.env.PDF_STYLE_VARIANT = 'unknown';
  mod = await import('../src/config/pdf.js');
  // brand fallback
  expect(mod.PDF_STYLE.infoBox.borderWidth).toBe(0.8);
});

test('PDF meta converts numeric envs to numbers', async () => {
  jest.resetModules();
  process.env.PDF_BARCODE_WIDTH = '123';
  process.env.PDF_BARCODE_OPACITY = '0.7';
  process.env.PDF_SYSTEM_LABEL = 'FHMP';
  const mod = await import('../src/config/pdf.js');
  expect(mod.PDF_META.barcodeWidth).toBe(123);
  expect(mod.PDF_META.barcodeOpacity).toBe(0.7);
  expect(mod.PDF_META.systemLabel).toBe('FHMP');
});

test('PDF assets resolve via env-provided directories and files', async () => {
  jest.resetModules();
  const fontDir = path.join(tmpDir, 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  fs.writeFileSync(path.join(fontDir, 'SBSansText-Regular.ttf'), '');
  process.env.PDF_FONT_DIR = fontDir;

  const sysLogo = path.join(tmpDir, 'system-logo.png');
  const fedLogo = path.join(tmpDir, 'fhm.png');
  fs.writeFileSync(sysLogo, '');
  fs.writeFileSync(fedLogo, '');
  process.env.PDF_SYSTEM_LOGO = sysLogo;
  process.env.PDF_FEDERATION_LOGO = fedLogo;

  const mod = await import('../src/config/pdf.js');
  expect(mod.PDF_FONTS.regular.endsWith('SBSansText-Regular.ttf')).toBe(true);
  expect(mod.PDF_LOGOS.system).toBe(sysLogo);
  expect(mod.PDF_LOGOS.federation).toBe(fedLogo);
});
