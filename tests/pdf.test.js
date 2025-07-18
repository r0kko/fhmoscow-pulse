import { expect, jest, test, beforeEach } from '@jest/globals';

const accessMock = jest.fn();
const registerFontMock = jest.fn();
const imageMock = jest.fn();
const textMock = jest.fn();
let docStub;
const fillColorMock = jest.fn(() => docStub);
const fontSizeMock = jest.fn(() => docStub);

function setup(logos) {
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
    PDF_LOGOS: logos,
  }));

  return import('../src/utils/pdf.js');
}

beforeEach(() => {
  jest.resetModules();
  accessMock.mockReset();
  registerFontMock.mockReset();
  imageMock.mockReset();
  textMock.mockReset();
});

test('applyFonts registers provided fonts', async () => {
  const { applyFonts } = await setup({});
  const doc = { registerFont: registerFontMock };
  applyFonts(doc);
  expect(accessMock).toHaveBeenCalledTimes(4);
  expect(registerFontMock).toHaveBeenCalledWith('SB-Regular', '/reg.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-Bold', '/bold.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-Italic', '/italic.ttf');
  expect(registerFontMock).toHaveBeenCalledWith('SB-BoldItalic', '/bi.ttf');
});

test('applyFonts falls back when fonts missing', async () => {
  const { applyFonts } = await setup({});
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

test('applyFirstPageHeader draws logos and text', async () => {
  const { applyFirstPageHeader } = await setup({
    federation: '/fhm.png',
    system: '/sys.png',
  });
  const doc = {
    page: { width: 500, height: 300 },
    image: imageMock,
    text: textMock,
    fillColor: fillColorMock,
    fontSize: fontSizeMock,
  };
  docStub = doc;
  applyFirstPageHeader(doc);
  expect(imageMock).toHaveBeenCalledWith('/fhm.png', 30, 30, { height: 40 });
  expect(imageMock).toHaveBeenCalledWith('/sys.png', 270, 30, { width: 200 });
  expect(textMock).toHaveBeenCalled();
});

test('applyFirstPageHeader works without logos', async () => {
  const { applyFirstPageHeader } = await setup({});
  const doc = {
    page: { width: 100, height: 150 },
    image: imageMock,
    text: textMock,
    fillColor: fillColorMock,
    fontSize: fontSizeMock,
  };
  docStub = doc;
  applyFirstPageHeader(doc);
  expect(imageMock).not.toHaveBeenCalled();
  expect(textMock).toHaveBeenCalled();
});
