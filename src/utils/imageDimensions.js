import { Buffer } from 'node:buffer';

/**
 * Lightweight image dimension reader for PNG and JPEG buffers.
 * Avoids pulling heavy native dependencies while giving us the
 * minimum metadata required for upload validation.
 */

function readPngDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null;
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!signature.equals(expected)) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function isStartOfFrame(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readJpegDimensions(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    offset += 2;

    // Standalone markers without payload
    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;

    if (isStartOfFrame(marker)) {
      if (offset + 5 >= buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += length;
  }
  return null;
}

export function getImageDimensions(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const firstByte = buffer[0];
  const secondByte = buffer[1];
  if (firstByte === 0x89 && secondByte === 0x50) {
    return readPngDimensions(buffer);
  }
  if (firstByte === 0xff && secondByte === 0xd8) {
    return readJpegDimensions(buffer);
  }
  return null;
}

export default {
  getImageDimensions,
};
