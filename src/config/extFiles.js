import path from 'path';

const DEFAULT_MODULE_PATHS = {
  playerPhoto: 'person/player/photo',
  staffPhoto: 'person/staff/photo',
  clubPhoto: 'person/club/photo',
  clubLogo: 'club/logo',
};

let modulePathCache = null;

function parseModulePathOverrides() {
  if (modulePathCache) return modulePathCache;
  const overrides = new Map();
  const raw = process.env.EXT_FILES_MODULE_MAP || '';
  if (raw.trim()) {
    for (const entry of raw.split(',')) {
      const [key, value] = entry.split('=').map((part) => part?.trim());
      if (!key || !value) continue;
      overrides.set(key, value.replace(/^\/+|\/+$/g, ''));
    }
  }
  modulePathCache = overrides;
  return overrides;
}

export function getExtFilesPublicBaseUrl() {
  const rawBase = process.env.EXT_FILES_PUBLIC_BASE_URL || '';
  const normalizedBase = rawBase.trim();
  const cleaned = normalizedBase ? normalizedBase.replace(/\/+$/, '') : '';
  return cleaned || null;
}

function moduleToSegments(module) {
  if (!module) return [];
  return module
    .replace(/([a-z0-9])([A-Z]+)/g, '$1 $2')
    .split(/[\s._-]+/)
    .map((segment) => segment.toLowerCase())
    .filter(Boolean);
}

function resolveModulePath(module) {
  const overrides = parseModulePathOverrides();
  if (overrides.has(module)) return overrides.get(module);
  if (DEFAULT_MODULE_PATHS[module]) return DEFAULT_MODULE_PATHS[module];
  const segments = moduleToSegments(module);
  return segments.join('/');
}

export function getModuleStoragePath(module) {
  const resolved = resolveModulePath(module || '');
  return resolved.replace(/^\/+|\/+$/g, '');
}

function normalizeExtension(ext) {
  if (!ext) return '';
  const trimmed = ext.startsWith('.') ? ext : `.${ext}`;
  return trimmed.toLowerCase();
}

function extractExtensionFromName(name) {
  if (!name) return '';
  return normalizeExtension(path.extname(name));
}

function deriveExtensionFromMime(mime) {
  if (!mime) return '';
  const map = {
    'image/jpeg': '.jpeg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime.toLowerCase()] || '';
}

function collectCandidateExtensions(file) {
  const ordered = [];
  const push = (value) => {
    const ext = normalizeExtension(value);
    if (ext && !ordered.includes(ext)) ordered.push(ext);
  };

  push(deriveExtensionFromMime(file?.mime_type));
  push(extractExtensionFromName(file?.name));

  const isJpeg =
    (file?.mime_type || '').toLowerCase().includes('jpeg') ||
    ordered.some((ext) => ext === '.jpg' || ext === '.jpeg');

  if (isJpeg) {
    push('.jpeg');
    push('.jpg');
  }

  if (!ordered.length) ordered.push('');
  return ordered;
}

function collectCandidateNames(file) {
  const names = [];
  const externalId = file?.external_id ? String(file.external_id) : '';
  const extensions = collectCandidateExtensions(file);

  if (externalId) {
    for (const ext of extensions) {
      if (ext) names.push(`${externalId}${ext}`);
    }
  }

  const originalName = (file?.name || '').trim();
  if (originalName) {
    const sanitized = originalName.replace(/^\/+/, '');
    if (sanitized && !names.includes(sanitized)) names.push(sanitized);
  }

  return names;
}

export function buildExtFilePublicUrlCandidates(file) {
  const base = getExtFilesPublicBaseUrl();
  if (!base || !file) return [];

  const modulePath = resolveModulePath(file.module || '');
  const names = collectCandidateNames(file);
  if (!names.length) return [];

  const uniqueUrls = new Set();
  for (const name of names) {
    const segments = [modulePath, name]
      .filter((part) => Boolean(part))
      .map((part) => part.replace(/^\/+|\/+$/g, ''));
    const finalPath = segments.join('/');
    if (!finalPath) continue;
    uniqueUrls.add(`${base}/${finalPath}`);
  }

  return Array.from(uniqueUrls.values());
}

export function buildExtFilePublicUrl(file) {
  const candidates = buildExtFilePublicUrlCandidates(file);
  return candidates.length ? candidates[0] : null;
}

export default {
  getExtFilesPublicBaseUrl,
  buildExtFilePublicUrl,
  buildExtFilePublicUrlCandidates,
  getModuleStoragePath,
};
