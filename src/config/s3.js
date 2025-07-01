import dotenv from 'dotenv';

dotenv.config();

export const S3_ENDPOINT = process.env.S3_ENDPOINT
  ? /^https?:\/\//.test(process.env.S3_ENDPOINT)
    ? process.env.S3_ENDPOINT
    : `https://${process.env.S3_ENDPOINT}`
  : undefined;
export const S3_REGION = process.env.S3_REGION || 'us-east-1';
export const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
export const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
export const S3_BUCKET = process.env.S3_BUCKET;
