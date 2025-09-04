import { expect, test, jest } from '@jest/globals';
import { Buffer } from 'buffer';

async function loadWithMock(factory) {
  jest.resetModules();
  if (factory) {
    jest.unstable_mockModule('bwip-js', factory);
  }
  return (await import('../src/utils/barcode.js')).renderPdf417;
}

test('returns false when text is missing', async () => {
  const renderPdf417 = await loadWithMock();
  const result = await renderPdf417({ image: jest.fn() }, 0, 0, 10, 10, '');
  expect(result).toBe(false);
});

test('renders barcode when bwip-js is available', async () => {
  const toBuffer = jest.fn().mockResolvedValue(Buffer.from('png'));
  const renderPdf417 = await loadWithMock(() => ({ default: { toBuffer } }));
  const doc = { image: jest.fn() };
  const result = await renderPdf417(doc, 1, 2, 100, 20, 'data');
  expect(result).toBe(true);
  expect(toBuffer).toHaveBeenCalled();
  expect(doc.image).toHaveBeenCalled();
});

test('returns false when bwip-js fails to render', async () => {
  const toBuffer = jest.fn().mockRejectedValue(new Error('fail'));
  const renderPdf417 = await loadWithMock(() => ({ default: { toBuffer } }));
  const result = await renderPdf417(
    { image: jest.fn() },
    1,
    2,
    100,
    20,
    'data'
  );
  expect(result).toBe(false);
});

test('falls back to require when module import fails', async () => {
  const renderPdf417 = await loadWithMock(() => {
    throw new Error('missing');
  });
  const result = await renderPdf417(
    { image: jest.fn() },
    1,
    2,
    100,
    20,
    'data'
  );
  expect(result).toBe(true);
});
