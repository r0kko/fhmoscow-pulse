import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

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
  JWT_SECRET: Joi.string().required(),
  SESSION_SECRET: Joi.string().required(),
  S3_BUCKET: Joi.string().optional(),
  S3_REGION: Joi.string().optional(),
  S3_ENDPOINT: Joi.string().optional(),
  S3_ACCESS_KEY: Joi.string().optional(),
  S3_SECRET_KEY: Joi.string().optional(),
  BASE_URL: Joi.string().optional(),
  SSL_CERT_PATH: Joi.string().optional(),
  SSL_KEY_PATH: Joi.string().optional(),
  COOKIE_DOMAIN: Joi.string().optional(),
  ALLOWED_ORIGINS: Joi.string().optional(),
  PDF_FONT_DIR: Joi.string().optional(),
}).unknown(true);

export default function validateEnv() {
  const { error } = schema.validate(process.env);
  if (error) {
    console.error(`Invalid environment configuration: ${error.message}`);
    process.exit(1);
  }
  if (
    process.env.S3_BUCKET &&
    (!process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY)
  ) {
    console.error('S3 configuration requires access and secret keys');
    process.exit(1);
  }
}
