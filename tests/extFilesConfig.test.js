import {
  afterAll,
  afterEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

const originalBase = process.env.EXT_FILES_PUBLIC_BASE_URL;
const originalMap = process.env.EXT_FILES_MODULE_MAP;

async function loadHelpers() {
  jest.resetModules();
  return import('../src/config/extFiles.js');
}

describe('extFiles config helpers', () => {
  afterEach(() => {
    process.env.EXT_FILES_MODULE_MAP = originalMap || '';
  });

  afterAll(() => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = originalBase;
    process.env.EXT_FILES_MODULE_MAP = originalMap;
  });

  test('buildExtFilePublicUrl combines base, module path, and external id filename', async () => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = 'https://cdn.example.com/base/';
    process.env.EXT_FILES_MODULE_MAP = 'playerPhoto=person/player/photo';
    const { buildExtFilePublicUrl } = await loadHelpers();
    const url = buildExtFilePublicUrl({
      module: 'playerPhoto',
      name: 'bezukhov.jpg',
      external_id: 45784,
    });
    expect(url).toBe(
      'https://cdn.example.com/base/person/player/photo/45784.jpg'
    );
  });

  test('falls back to mime-derived extension when original name missing', async () => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = 'https://cdn.example.com';
    process.env.EXT_FILES_MODULE_MAP = '';
    const { buildExtFilePublicUrl } = await loadHelpers();
    const url = buildExtFilePublicUrl({
      module: 'teamLogo',
      external_id: 12,
      mime_type: 'image/png',
      name: '',
    });
    expect(url).toBe('https://cdn.example.com/team/logo/12.png');
  });

  test('uses jpeg extension when mime reports image/jpeg', async () => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = 'https://cdn.example.com';
    process.env.EXT_FILES_MODULE_MAP = 'playerPhoto=person/player/photo';
    const { buildExtFilePublicUrl } = await loadHelpers();
    const url = buildExtFilePublicUrl({
      module: 'playerPhoto',
      external_id: 56752,
      mime_type: 'image/jpeg',
      name: '',
    });
    expect(url).toBe('https://cdn.example.com/person/player/photo/56752.jpeg');
  });

  test('returns null when base url is missing', async () => {
    process.env.EXT_FILES_PUBLIC_BASE_URL = '';
    process.env.EXT_FILES_MODULE_MAP = '';
    const { buildExtFilePublicUrl } = await loadHelpers();
    expect(
      buildExtFilePublicUrl({ module: 'playerPhoto', name: 'photo.jpg' })
    ).toBeNull();
  });
});
