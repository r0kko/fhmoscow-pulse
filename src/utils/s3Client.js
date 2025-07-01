import { S3Client } from '@aws-sdk/client-s3';

import {
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_REGION,
  S3_ENDPOINT,
} from '../config/s3.js';

const client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: Boolean(S3_ENDPOINT),
  credentials: S3_ACCESS_KEY
    ? { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY }
    : undefined,
});

export default client;
