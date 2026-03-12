import { beforeEach, expect, jest, test } from '@jest/globals';

const applyRefereeAccrualActionMock = jest.fn();
const toPublicAccrualDocumentMock = jest.fn();
const toPublicAuditEventMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  applyRefereeAccrualActionMock.mockReset();
  toPublicAccrualDocumentMock.mockReset();
  toPublicAuditEventMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/refereeAccountingService.js', () => ({
  __esModule: true,
  default: {
    applyRefereeAccrualAction: applyRefereeAccrualActionMock,
  },
}));

jest.unstable_mockModule('../src/mappers/refereeAccountingMapper.js', () => ({
  __esModule: true,
  default: {
    toPublicAccrualDocument: toPublicAccrualDocumentMock,
    toPublicAuditEvent: toPublicAuditEventMock,
  },
}));

jest.unstable_mockModule('../src/utils/api.js', () => ({
  __esModule: true,
  sendError: sendErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/refereeAccountingController.js');

test('approveAccrual works when invoked as an unbound legacy handler', async () => {
  applyRefereeAccrualActionMock.mockResolvedValue({
    document: { id: 'doc-1' },
    audit_events: [],
  });
  toPublicAccrualDocumentMock.mockReturnValue({ id: 'doc-1' });

  const json = jest.fn();
  const res = { json };
  const req = {
    params: { id: 'doc-1' },
    body: {},
    user: { id: 'admin-1' },
  };

  const handler = controller.approveAccrual;
  await handler(req, res);

  expect(applyRefereeAccrualActionMock).toHaveBeenCalledWith(
    'doc-1',
    'APPROVE',
    'admin-1',
    undefined
  );
  expect(json).toHaveBeenCalledWith({
    document: { id: 'doc-1' },
    audit_events: [],
  });
});
