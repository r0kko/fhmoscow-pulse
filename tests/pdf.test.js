import { expect, jest, test, beforeEach } from '@jest/globals';

const accessMock = jest.fn();
const registerFontMock = jest.fn();

jest.unstable_mockModule('fs', () => ({
  __esModule: true,
  default: { accessSync: accessMock, constants: { R_OK: 4 } },
  accessSync: accessMock,
  constants: { R_OK: 4 },
}));

jest.unstable_mockModule('../src/config/pdf.js', () => ({
  __esModule: true,
  PDF_FONTS: {
    regular: '/reg.ttf',
    bold: '/bold.ttf',
    italic: '/italic.ttf',
    boldItalic: '/bi.ttf',
  },
}));

const { applyFonts } = await import('../src/utils/pdf.js');

beforeEach(() => {
  accessMock.mockReset();
  registerFontMock.mockReset();
});

test('applyFonts registers provided fonts', () => {
  const doc = { registerFont: registerFontMock };
  applyFonts(doc);
  expect(accessMock).toHaveBeenCalledTimes(4);
  expect(registerFontMock).toHaveBeenCalledWith('SB-Regular', '/reg.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-Bold', '/bold.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-Italic', '/italic.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-BoldItalic', '/bi.ttf');
});

test('applyFonts falls back when fonts missing', () => {
  accessMock.mockImplementation(() => {
    throw new Error('missing');
  });
  const doc = { registerFont: registerFontMock };
  const res = applyFonts(doc);
  expect(registerFontMock).toHaveBeenCalledWith(
    'Default-Regular',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
  );
  expect(registerFontMock).toHaveBeenCalledWith(
    'Default-Bold',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  );
  expect(res).toEqual({ regular: 'Default-Regular', bold: 'Default-Bold' });
});
