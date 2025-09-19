import { Buffer } from 'node:buffer';

import { getImageDimensions } from '../src/utils/imageDimensions.js';

describe('getImageDimensions', () => {
  it('reads PNG dimensions', () => {
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAI0lEQVR4nGNgYGD4z0AEMGDiPwMDA8O/f/8ZGBgYGJgYGAQADE8C/Ki1iK8AAAAASUVORK5CYII=';
    const buffer = Buffer.from(base64, 'base64');
    const dims = getImageDimensions(buffer);
    expect(dims).toEqual({ width: 4, height: 4 });
  });

  it('reads JPEG dimensions', () => {
    const bytes = [
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x02, 0x01,
      0x01, 0x11, 0x00, 0xff, 0xd9,
    ];
    const buffer = Buffer.from(bytes);
    const dims = getImageDimensions(buffer);
    expect(dims).toEqual({ width: 2, height: 2 });
  });

  it('skips standalone markers in JPEG stream', () => {
    const bytes = [
      0xff, 0xd8, 0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x03, 0x20, 0x03,
      0x20, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9,
    ];
    const buffer = Buffer.from(bytes);
    const dims = getImageDimensions(buffer);
    expect(dims).toEqual({ width: 800, height: 800 });
  });

  it('returns null on truncated JPEG segment', () => {
    const bytes = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x01, 0xff, 0xd9];
    const buffer = Buffer.from(bytes);
    expect(getImageDimensions(buffer)).toBeNull();
  });

  it('returns null when PNG header is incomplete', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    expect(getImageDimensions(buffer)).toBeNull();
  });

  it('returns null for corrupt PNG signature', () => {
    const buffer = Buffer.from([
      0x89, 0x51, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(getImageDimensions(buffer)).toBeNull();
  });

  it('returns null for unsupported data', () => {
    const buffer = Buffer.from('not an image');
    expect(getImageDimensions(buffer)).toBeNull();
  });
});
