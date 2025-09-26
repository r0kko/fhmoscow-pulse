import Joi from 'joi';
import './env.js';

const schema = Joi.object({
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  LEGACY_DB_HOST: Joi.string().required(),
  LEGACY_DB_PORT: Joi.string().required(),
  LEGACY_DB_NAME: Joi.string().required(),
  LEGACY_DB_USER: Joi.string().required(),
  LEGACY_DB_PASS: Joi.string().required(),
  // Optional second external MariaDB connection
  EXT_DB_HOST: Joi.string().optional(),
  EXT_DB_PORT: Joi.string().optional(),
  EXT_DB_NAME: Joi.string().optional(),
  EXT_DB_USER: Joi.string().optional(),
  EXT_DB_PASS: Joi.string().optional(),
  JWT_SECRET: Joi.string().required(),
  SESSION_SECRET: Joi.string().required(),
  S3_BUCKET: Joi.string().optional(),
  S3_REGION: Joi.string().optional(),
  S3_ENDPOINT: Joi.string().optional(),
  S3_ACCESS_KEY: Joi.string().optional(),
  S3_SECRET_KEY: Joi.string().optional(),
  EXT_S3_BUCKET: Joi.string().optional(),
  EXT_S3_REGION: Joi.string().optional(),
  EXT_S3_ENDPOINT: Joi.string().optional(),
  EXT_S3_ACCESS_KEY: Joi.string().optional(),
  EXT_S3_SECRET_KEY: Joi.string().optional(),
  BASE_URL: Joi.string().optional(),
  EXT_FILES_PUBLIC_BASE_URL: Joi.string().uri().optional(),
  EXT_FILES_MODULE_MAP: Joi.string().optional(),
  VERIFY_HMAC_SECRET: Joi.string().optional(),
  SSL_CERT_PATH: Joi.string().optional(),
  SSL_KEY_PATH: Joi.string().optional(),
  COOKIE_DOMAIN: Joi.string().optional(),
  ALLOWED_ORIGINS: Joi.string().optional(),
  PDF_FONT_DIR: Joi.string().optional(),
}).unknown(true);

export default function validateEnv() {
  const { error } = schema.validate(process.env);
  if (error) {
    const err = new Error(
      `Invalid environment configuration: ${error.message}`
    );
    err.code = 'ENV_INVALID';
    throw err;
  }
  if (
    process.env.S3_BUCKET &&
    (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY)
  ) {
    const err = new Error('S3 configuration requires access and secret keys');
    err.code = 'ENV_INVALID';
    throw err;
  }
  if (
    process.env.EXT_S3_BUCKET &&
    (!process.env.EXT_S3_ACCESS_KEY || !process.env.EXT_S3_SECRET_KEY)
  ) {
    const err = new Error(
      'External S3 configuration requires access and secret keys'
    );
    err.code = 'ENV_INVALID';
    throw err;
  }
}
