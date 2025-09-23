import { readBool, readNumber, readString } from '../utils/env.js';

export const SMTP_HOST = readString(process.env.SMTP_HOST);
export const SMTP_PORT = readNumber(process.env.SMTP_PORT, 587);
export const SMTP_USER = readString(process.env.SMTP_USER);
export const SMTP_PASS = readString(process.env.SMTP_PASS);
export const EMAIL_FROM = readString(process.env.EMAIL_FROM);

export const SMTP_SECURE = readBool(process.env.SMTP_SECURE, SMTP_PORT === 465);
export const SMTP_REQUIRE_TLS = readBool(
  process.env.SMTP_REQUIRE_TLS,
  !SMTP_SECURE
);
export const SMTP_ALLOW_INSECURE_TLS = readBool(
  process.env.SMTP_ALLOW_INSECURE_TLS,
  false
);
export const SMTP_TLS_MIN_VERSION = readString(
  process.env.SMTP_TLS_MIN_VERSION,
  SMTP_ALLOW_INSECURE_TLS ? 'TLSv1' : 'TLSv1.2'
);
export const SMTP_TLS_REJECT_UNAUTHORIZED = readBool(
  process.env.SMTP_TLS_REJECT_UNAUTHORIZED,
  !SMTP_ALLOW_INSECURE_TLS && process.env.NODE_ENV !== 'development'
);
export const SMTP_TLS_SERVERNAME = readString(
  process.env.SMTP_TLS_SERVERNAME,
  SMTP_HOST
);
export const SMTP_TLS_CIPHERS = readString(process.env.SMTP_TLS_CIPHERS);
export const SMTP_LOCAL_ADDRESS = readString(process.env.SMTP_LOCAL_ADDRESS);
export const SMTP_ADDRESS_FAMILY = readNumber(
  process.env.SMTP_ADDRESS_FAMILY,
  undefined
);
export const SMTP_DEBUG = readBool(process.env.SMTP_DEBUG, false);
export const SMTP_POOL_ENABLED = readBool(process.env.SMTP_POOL, true);

export const EMAIL_TRANSPORT_MAX_CONNECTIONS = readNumber(
  process.env.EMAIL_TRANSPORT_MAX_CONNECTIONS,
  3
);
export const EMAIL_TRANSPORT_MAX_MESSAGES = readNumber(
  process.env.EMAIL_TRANSPORT_MAX_MESSAGES,
  100
);
export const EMAIL_TRANSPORT_CONN_TIMEOUT_MS = readNumber(
  process.env.EMAIL_TRANSPORT_CONN_TIMEOUT_MS,
  10_000
);
export const EMAIL_TRANSPORT_GREETING_TIMEOUT_MS = readNumber(
  process.env.EMAIL_TRANSPORT_GREETING_TIMEOUT_MS,
  8_000
);
export const EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS = readNumber(
  process.env.EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS,
  15_000
);
export const EMAIL_TRANSPORT_VERIFY_ON_BOOT = readBool(
  process.env.EMAIL_TRANSPORT_VERIFY_ON_BOOT,
  false
);

export default {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  SMTP_SECURE,
  SMTP_REQUIRE_TLS,
  SMTP_ALLOW_INSECURE_TLS,
  SMTP_TLS_MIN_VERSION,
  SMTP_TLS_REJECT_UNAUTHORIZED,
  SMTP_TLS_SERVERNAME,
  SMTP_TLS_CIPHERS,
  SMTP_LOCAL_ADDRESS,
  SMTP_ADDRESS_FAMILY,
  SMTP_DEBUG,
  SMTP_POOL_ENABLED,
  EMAIL_TRANSPORT_MAX_CONNECTIONS,
  EMAIL_TRANSPORT_MAX_MESSAGES,
  EMAIL_TRANSPORT_CONN_TIMEOUT_MS,
  EMAIL_TRANSPORT_GREETING_TIMEOUT_MS,
  EMAIL_TRANSPORT_SOCKET_TIMEOUT_MS,
  EMAIL_TRANSPORT_VERIFY_ON_BOOT,
};
