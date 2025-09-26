import './env.js';

export const EXT_S3_ENDPOINT = process.env.EXT_S3_ENDPOINT
  ? /^https?:\/\//.test(process.env.EXT_S3_ENDPOINT)
    ? process.env.EXT_S3_ENDPOINT
    : `https://${process.env.EXT_S3_ENDPOINT}`
  : undefined;
export const EXT_S3_REGION = process.env.EXT_S3_REGION || 'us-east-1';
export const EXT_S3_ACCESS_KEY = process.env.EXT_S3_ACCESS_KEY;
export const EXT_S3_SECRET_KEY = process.env.EXT_S3_SECRET_KEY;
export const EXT_S3_BUCKET = process.env.EXT_S3_BUCKET;

export function getExternalS3Bucket() {
  return process.env.EXT_S3_BUCKET;
}
