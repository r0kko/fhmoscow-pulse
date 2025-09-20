export const emailTheme = {
  brandName: process.env.EMAIL_BRAND_NAME || 'АСОУ ПД Пульс',
  brandColor: '#0F62FE',
  backgroundColor: '#F5F7FB',
  containerBackground: '#FFFFFF',
  containerBorder: '#E2E8F0',
  textColor: '#1F2933',
  mutedTextColor: '#64748B',
  dividerColor: '#E2E8F0',
  linkColor: '#0F62FE',
  codeBackground: '#0F172A',
  codeTextColor: '#F8FAFC',
  buttonTextColor: '#FFFFFF',
  fontFamily:
    '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
  monoFontFamily:
    '"SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", monospace',
  containerMaxWidth: 640,
};

export function getTheme() {
  return emailTheme;
}

export default getTheme;
