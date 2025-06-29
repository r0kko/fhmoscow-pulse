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
}).unknown(true);

export default function validateEnv() {
  const { error } = schema.validate(process.env);
  if (error) {
    console.error(`Invalid environment configuration: ${error.message}`);
    process.exit(1);
  }
}
