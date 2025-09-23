import helmet from 'helmet';

import { isSecureEnv } from './security.js';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

const CSP_SELF = '\u0027self\u0027';
const CSP_NONE = '\u0027none\u0027';
const CSP_UNSAFE_INLINE = '\u0027unsafe-inline\u0027';
const CSP_DATA = 'data:';
const CSP_BLOB = 'blob:';
const CSP_HTTPS = 'https:';
const CSP_WSS = 'wss:';

function envFlag(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const value = String(raw).trim().toLowerCase();
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  return defaultValue;
}

function numberFromEnv(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  return defaultValue;
}

function listFromEnv(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function extendDirective(directives, key, extras) {
  if (!Array.isArray(extras) || extras.length === 0) return;
  if (!Array.isArray(directives[key])) {
    directives[key] = extras.slice();
    return;
  }
  directives[key] = [...directives[key], ...extras];
}

const baseCspDirectives = {
  defaultSrc: [CSP_SELF],
  baseUri: [CSP_SELF],
  blockAllMixedContent: [],
  connectSrc: [CSP_SELF, CSP_HTTPS, CSP_WSS],
  fontSrc: [CSP_SELF, CSP_DATA],
  formAction: [CSP_SELF],
  frameAncestors: [CSP_NONE],
  imgSrc: [CSP_SELF, CSP_DATA, CSP_BLOB],
  objectSrc: [CSP_NONE],
  scriptSrc: [CSP_SELF],
  scriptSrcAttr: [CSP_NONE],
  styleSrc: [CSP_SELF],
  upgradeInsecureRequests: [],
  workerSrc: [CSP_SELF, CSP_BLOB],
};

extendDirective(
  baseCspDirectives,
  'connectSrc',
  listFromEnv('SECURITY_CSP_CONNECT_SRC')
);
extendDirective(
  baseCspDirectives,
  'fontSrc',
  listFromEnv('SECURITY_CSP_FONT_SRC')
);
extendDirective(
  baseCspDirectives,
  'imgSrc',
  listFromEnv('SECURITY_CSP_IMG_SRC')
);
extendDirective(
  baseCspDirectives,
  'scriptSrc',
  listFromEnv('SECURITY_CSP_SCRIPT_SRC')
);
extendDirective(
  baseCspDirectives,
  'styleSrc',
  listFromEnv('SECURITY_CSP_STYLE_SRC')
);
extendDirective(
  baseCspDirectives,
  'workerSrc',
  listFromEnv('SECURITY_CSP_WORKER_SRC')
);

const swaggerScriptExtras = listFromEnv('SECURITY_SWAGGER_SCRIPT_SRC');
const swaggerStyleExtras = listFromEnv('SECURITY_SWAGGER_STYLE_SRC');

const swaggerCspDirectives = {
  ...baseCspDirectives,
  scriptSrc: [
    ...baseCspDirectives.scriptSrc,
    CSP_UNSAFE_INLINE,
    ...swaggerScriptExtras,
  ],
  styleSrc: [
    ...baseCspDirectives.styleSrc,
    CSP_UNSAFE_INLINE,
    ...swaggerStyleExtras,
  ],
};

const referrerPolicy =
  process.env.SECURITY_REFERRER_POLICY?.trim() ||
  'strict-origin-when-cross-origin';

const frameguardEnabled = envFlag('SECURITY_ENABLE_FRAMEGUARD', true);
const frameguardAction =
  process.env.SECURITY_FRAMEGUARD_ACTION?.trim().toLowerCase() === 'sameorigin'
    ? 'sameorigin'
    : 'deny';

const hstsEnabled = envFlag('SECURITY_ENABLE_HSTS', isSecureEnv());
const hstsMaxAge = numberFromEnv('SECURITY_HSTS_MAX_AGE', 31536000);
const hstsIncludeSubdomains = envFlag('SECURITY_HSTS_INCLUDE_SUBDOMAINS', true);
const hstsPreload = envFlag('SECURITY_HSTS_PRELOAD', false);

const helmetOptions = {
  contentSecurityPolicy: false,
  frameguard: frameguardEnabled ? { action: frameguardAction } : false,
  referrerPolicy: envFlag('SECURITY_ENABLE_REFERRER_POLICY', true)
    ? { policy: referrerPolicy }
    : false,
};

if (hstsEnabled) {
  helmetOptions.hsts = {
    maxAge: hstsMaxAge,
    includeSubDomains: hstsIncludeSubdomains,
    preload: hstsPreload,
  };
} else {
  helmetOptions.hsts = false;
}

if (!envFlag('SECURITY_ENABLE_COEP', true)) {
  helmetOptions.crossOriginEmbedderPolicy = false;
}

if (!envFlag('SECURITY_ENABLE_COOP', true)) {
  helmetOptions.crossOriginOpenerPolicy = false;
}

if (!envFlag('SECURITY_ENABLE_CORP', true)) {
  helmetOptions.crossOriginResourcePolicy = false;
}

if (!envFlag('SECURITY_ENABLE_PERMITTED_CDP', false)) {
  helmetOptions.permittedCrossDomainPolicies = false;
}

if (envFlag('SECURITY_ALLOW_DNS_PREFETCH', false)) {
  helmetOptions.dnsPrefetchControl = { allow: true };
}

const helmetMiddleware = helmet(helmetOptions);

const cspEnabled = envFlag('SECURITY_ENABLE_CSP', true);
const cspReportOnly = envFlag('SECURITY_CSP_REPORT_ONLY', false);

const contentSecurityPolicyMiddleware = cspEnabled
  ? helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: baseCspDirectives,
      reportOnly: cspReportOnly,
    })
  : null;

const swaggerContentSecurityPolicyMiddleware =
  cspEnabled && envFlag('SECURITY_ENABLE_SWAGGER_CSP', true)
    ? helmet.contentSecurityPolicy({
        useDefaults: false,
        directives: swaggerCspDirectives,
        reportOnly: cspReportOnly,
      })
    : null;

export {
  helmetMiddleware,
  contentSecurityPolicyMiddleware,
  swaggerContentSecurityPolicyMiddleware,
};
