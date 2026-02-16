function parseBoolEnv(raw: unknown, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const value = String(raw).trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

export const REFEREE_ASSIGNMENTS_V2_UI_ENABLED = parseBoolEnv(
  import.meta.env['VITE_REFEREE_ASSIGNMENTS_V2_UI'],
  true
);
