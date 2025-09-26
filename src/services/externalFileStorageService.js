import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import externalS3Client from '../utils/externalS3Client.js';
import { getExternalS3Bucket } from '../config/externalS3.js';
import ServiceError from '../errors/ServiceError.js';

function ensureExternalS3Configured() {
  const bucket = getExternalS3Bucket();
  if (!bucket) {
    throw new ServiceError('external_s3_not_configured', 500);
  }
  return bucket;
}

function normalizeKey(key) {
  return String(key || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/g, '')
    .replace(/\\/g, '/');
}

async function uploadBuffer({ key, body, contentType }) {
  const bucket = ensureExternalS3Configured();
  if (!body || !Buffer.isBuffer(body)) {
    throw new ServiceError('external_s3_invalid_body', 500);
  }
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) {
    throw new ServiceError('external_s3_invalid_key', 500);
  }
  try {
    await externalS3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: normalizedKey,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
      })
    );
    return { bucket, key: normalizedKey };
  } catch (err) {
    console.error('External S3 upload failed', err);
    const error = new ServiceError('external_s3_upload_failed', 502);
    error.cause = err;
    throw error;
  }
}

async function removeObject({ key }) {
  const bucket = ensureExternalS3Configured();
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return;
  try {
    await externalS3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: normalizedKey,
      })
    );
  } catch (err) {
    console.error('External S3 delete failed', err);
  }
}

export default {
  uploadBuffer,
  removeObject,
};
