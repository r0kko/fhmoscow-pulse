'use strict';

const { createHash, randomBytes, randomUUID } = require('crypto');

const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const byteToHex = Array.from({ length: 256 }, (_value, index) =>
  index.toString(16).padStart(2, '0')
);

let nodeId;
let clockseq;
let lastMSecs = 0;
let lastNSecs = 0;

function assertBuffer(buf, offset = 0) {
  if (!buf || typeof buf.length !== 'number') {
    throw new TypeError('A byte array is required');
  }
  if (!Number.isInteger(offset) || offset < 0 || offset + 16 > buf.length) {
    throw new RangeError('UUID buffer range is out of bounds');
  }
}

function bytesToUuid(bytes, offset = 0) {
  assertBuffer(bytes, offset);

  return (
    byteToHex[bytes[offset]] +
    byteToHex[bytes[offset + 1]] +
    byteToHex[bytes[offset + 2]] +
    byteToHex[bytes[offset + 3]] +
    '-' +
    byteToHex[bytes[offset + 4]] +
    byteToHex[bytes[offset + 5]] +
    '-' +
    byteToHex[bytes[offset + 6]] +
    byteToHex[bytes[offset + 7]] +
    '-' +
    byteToHex[bytes[offset + 8]] +
    byteToHex[bytes[offset + 9]] +
    '-' +
    byteToHex[bytes[offset + 10]] +
    byteToHex[bytes[offset + 11]] +
    byteToHex[bytes[offset + 12]] +
    byteToHex[bytes[offset + 13]] +
    byteToHex[bytes[offset + 14]] +
    byteToHex[bytes[offset + 15]]
  );
}

function bytesFromUuid(uuid) {
  if (!validate(uuid)) {
    throw new TypeError('Invalid UUID');
  }

  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function writeOrStringify(bytes, buf, offset = 0) {
  if (!buf) {
    return bytesToUuid(bytes);
  }

  assertBuffer(buf, offset);
  for (let i = 0; i < 16; i += 1) {
    buf[offset + i] = bytes[i];
  }
  return buf;
}

function validate(uuid) {
  return (
    typeof uuid === 'string' &&
    (uuid.toLowerCase() === NIL ||
      uuid.toLowerCase() === MAX ||
      UUID_RE.test(uuid))
  );
}

function version(uuid) {
  if (!validate(uuid)) {
    throw new TypeError('Invalid UUID');
  }
  if (uuid.toLowerCase() === NIL) {
    return 0;
  }
  if (uuid.toLowerCase() === MAX) {
    return 15;
  }
  return Number.parseInt(uuid[14], 16);
}

function v4(options, buf, offset = 0) {
  if (!options && !buf && typeof randomUUID === 'function') {
    return randomUUID();
  }

  const random =
    options?.random ||
    (typeof options?.rng === 'function' ? options.rng() : randomBytes(16));
  if (!random || random.length < 16) {
    throw new TypeError('Random bytes length must be at least 16');
  }

  const bytes = Uint8Array.from(random.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return writeOrStringify(bytes, buf, offset);
}

function v7(options, buf, offset = 0) {
  const now = BigInt(options?.msecs ?? Date.now());
  const random =
    options?.random ||
    (typeof options?.rng === 'function' ? options.rng() : randomBytes(10));
  if (!random || random.length < 10) {
    throw new TypeError('Random bytes length must be at least 10');
  }

  const bytes = new Uint8Array(16);
  bytes[0] = Number((now >> 40n) & 0xffn);
  bytes[1] = Number((now >> 32n) & 0xffn);
  bytes[2] = Number((now >> 24n) & 0xffn);
  bytes[3] = Number((now >> 16n) & 0xffn);
  bytes[4] = Number((now >> 8n) & 0xffn);
  bytes[5] = Number(now & 0xffn);
  for (let i = 0; i < 10; i += 1) {
    bytes[6 + i] = random[i];
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return writeOrStringify(bytes, buf, offset);
}

function v1(options = {}, buf, offset = 0) {
  if (!nodeId) {
    nodeId = randomBytes(6);
    nodeId[0] |= 0x01;
  }
  if (clockseq === undefined) {
    clockseq = ((randomBytes(2)[0] << 8) | randomBytes(2)[1]) & 0x3fff;
  }

  const msecs = options.msecs ?? Date.now();
  let nsecs = options.nsecs ?? lastNSecs + 1;
  const dt = msecs - lastMSecs + (nsecs - lastNSecs) / 10000;
  if (dt < 0 && options.clockseq === undefined) {
    clockseq = (clockseq + 1) & 0x3fff;
  }
  if ((dt < 0 || msecs > lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  }
  if (nsecs >= 10000) {
    throw new Error('Cannot create more than 10M UUIDs/sec');
  }

  lastMSecs = msecs;
  lastNSecs = nsecs;

  const activeNode = options.node || nodeId;
  const activeClockseq = options.clockseq ?? clockseq;
  const timestamp = BigInt(msecs + 12219292800000) * 10000n + BigInt(nsecs);
  const bytes = new Uint8Array(16);
  const timeLow = Number(timestamp & 0xffffffffn);
  const timeMid = Number((timestamp >> 32n) & 0xffffn);
  const timeHigh = Number((timestamp >> 48n) & 0x0fffn);

  bytes[0] = (timeLow >>> 24) & 0xff;
  bytes[1] = (timeLow >>> 16) & 0xff;
  bytes[2] = (timeLow >>> 8) & 0xff;
  bytes[3] = timeLow & 0xff;
  bytes[4] = (timeMid >>> 8) & 0xff;
  bytes[5] = timeMid & 0xff;
  bytes[6] = ((timeHigh >>> 8) & 0x0f) | 0x10;
  bytes[7] = timeHigh & 0xff;
  bytes[8] = ((activeClockseq >>> 8) & 0x3f) | 0x80;
  bytes[9] = activeClockseq & 0xff;
  for (let i = 0; i < 6; i += 1) {
    bytes[10 + i] = activeNode[i];
  }

  return writeOrStringify(bytes, buf, offset);
}

function uuidHash(name, namespace, algorithm, uuidVersion, buf, offset = 0) {
  const namespaceBytes =
    typeof namespace === 'string' ? bytesFromUuid(namespace) : namespace;
  if (!namespaceBytes || namespaceBytes.length !== 16) {
    throw new TypeError('Namespace must be a UUID or 16-byte array');
  }

  const value =
    Array.isArray(name) || ArrayBuffer.isView(name)
      ? Buffer.from(name)
      : Buffer.from(String(name));
  const bytes = Uint8Array.from(
    createHash(algorithm)
      .update(Buffer.from(namespaceBytes))
      .update(value)
      .digest()
      .subarray(0, 16)
  );
  bytes[6] = (bytes[6] & 0x0f) | (uuidVersion << 4);
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return writeOrStringify(bytes, buf, offset);
}

function v3(name, namespace, buf, offset) {
  return uuidHash(name, namespace, 'md5', 3, buf, offset);
}
v3.DNS = DNS;
v3.URL = URL;

function v5(name, namespace, buf, offset) {
  return uuidHash(name, namespace, 'sha1', 5, buf, offset);
}
v5.DNS = DNS;
v5.URL = URL;

function parse(uuid) {
  return bytesFromUuid(uuid);
}

function stringify(bytes, offset = 0) {
  const uuid = bytesToUuid(bytes, offset);
  if (!validate(uuid)) {
    throw new TypeError('Stringified UUID is invalid');
  }
  return uuid;
}

function unsupportedConversion(uuid) {
  if (!validate(uuid)) {
    throw new TypeError('Invalid UUID');
  }
  return uuid;
}

module.exports = {
  DNS,
  MAX,
  NIL,
  URL,
  parse,
  stringify,
  v1,
  v1ToV6: unsupportedConversion,
  v3,
  v4,
  v5,
  v6: v1,
  v6ToV1: unsupportedConversion,
  v7,
  validate,
  version,
};
module.exports.default = module.exports;
