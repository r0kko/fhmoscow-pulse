import { beforeEach, expect, jest, test } from '@jest/globals';

const findAgreementMock = jest.fn();
const findSignTypeMock = jest.fn();

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  Document: { findOne: findAgreementMock },
  DocumentType: {},
  DocumentStatus: {},
  UserSignType: { findOne: findSignTypeMock },
  SignType: {},
}));

const { default: buildEquipmentTransferPdf } =
  await import('../src/services/docBuilders/equipmentTransfer.js');

beforeEach(() => {
  findAgreementMock.mockReset();
  findSignTypeMock.mockReset();
});

test('renders PDF with agreement metadata and stamp placeholders', async () => {
  findAgreementMock.mockResolvedValue({
    id: 'doc-eia',
    DocumentType: { alias: 'ELECTRONIC_INTERACTION_AGREEMENT', name: 'EИА' },
    DocumentStatus: { alias: 'SIGNED', name: 'Подписан' },
  });
  findSignTypeMock.mockResolvedValue({
    SignType: { alias: 'ESIGN', name: 'ЭП' },
  });

  const user = {
    id: 'user-1',
    last_name: 'Петров',
    first_name: 'Пётр',
    patronymic: 'Петрович',
  };
  const equipment = {
    type: { name: 'Свитер' },
    manufacturer: { name: 'CCM' },
    size: { name: 'L' },
    number: 17,
  };
  const meta = {
    docId: 'equip-42',
    number: '42/25',
    esign: { signedAt: '2025-01-01T12:00:00Z', signId: 'sign-1' },
  };

  const pdfBuffer = await buildEquipmentTransferPdf(user, equipment, meta);
  expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
  expect(pdfBuffer.slice(0, 4).toString()).toBe('%PDF');
  expect(pdfBuffer.length).toBeGreaterThan(500);
  expect(findAgreementMock).toHaveBeenCalled();
  expect(findSignTypeMock).toHaveBeenCalledWith({
    where: { user_id: 'user-1' },
    include: [{ model: expect.any(Object), attributes: ['alias', 'name'] }],
  });
});
