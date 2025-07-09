const fontPath = process.env.PDF_FONT_PATH || new URL('../../assets/fonts/DejaVuSans.ttf', import.meta.url).pathname;
export const PDF_FONT_PATH = fontPath;
