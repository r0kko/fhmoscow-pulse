import { S3Client } from '@aws-sdk/client-s3';

import {
  EXT_S3_ACCESS_KEY,
  EXT_S3_SECRET_KEY,
  EXT_S3_REGION,
  EXT_S3_ENDPOINT,
} from '../config/externalS3.js';

const externalClient = new S3Client({
  region: EXT_S3_REGION,
  endpoint: EXT_S3_ENDPOINT,
  forcePathStyle: Boolean(EXT_S3_ENDPOINT),
  credentials: EXT_S3_ACCESS_KEY
    ? { accessKeyId: EXT_S3_ACCESS_KEY, secretAccessKey: EXT_S3_SECRET_KEY }
    : undefined,
});

export default externalClient;
