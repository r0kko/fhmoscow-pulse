import { beforeEach, expect, jest, test } from '@jest/globals';

const applyRefereeAccrualActionMock = jest.fn();
const applyRefereeAccrualActionBulkMock = jest.fn();
const bulkDeleteRefereeAccrualDocumentsMock = jest.fn();
const listTournamentPaymentRegistryMock = jest.fn();
const exportTournamentPaymentRegistryXlsxMock = jest.fn();
const toPublicAccrualDocumentMock = jest.fn();
const toPublicAuditEventMock = jest.fn();
const sendErrorMock = jest.fn();

beforeEach(() => {
  applyRefereeAccrualActionMock.mockReset();
  applyRefereeAccrualActionBulkMock.mockReset();
  bulkDeleteRefereeAccrualDocumentsMock.mockReset();
  listTournamentPaymentRegistryMock.mockReset();
  exportTournamentPaymentRegistryXlsxMock.mockReset();
  toPublicAccrualDocumentMock.mockReset();
  toPublicAuditEventMock.mockReset();
  sendErrorMock.mockReset();
});

jest.unstable_mockModule('../src/services/refereeAccountingService.js', () => ({
  __esModule: true,
  default: {
    applyRefereeAccrualAction: applyRefereeAccrualActionMock,
    applyRefereeAccrualActionBulk: applyRefereeAccrualActionBulkMock,
    bulkDeleteRefereeAccrualDocuments: bulkDeleteRefereeAccrualDocumentsMock,
    listTournamentPaymentRegistry: listTournamentPaymentRegistryMock,
    exportTournamentPaymentRegistryXlsx:
      exportTournamentPaymentRegistryXlsxMock,
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

test('listTournamentPaymentRegistry returns service payload', async () => {
  const json = jest.fn();
  const res = { json };
  const payload = {
    rows: [{ referee_id: 'u1' }],
    total: 1,
    page: 1,
    limit: 50,
  };
  listTournamentPaymentRegistryMock.mockResolvedValue(payload);

  await controller.listTournamentPaymentRegistry(
    {
      params: { tournamentId: 'tour-1' },
      query: {
        page: '2',
        limit: '20',
        date_from: '2026-03-01',
        date_to: '2026-03-31',
        taxation_type_alias: 'NPD',
      },
    },
    res
  );

  expect(listTournamentPaymentRegistryMock).toHaveBeenCalledWith({
    tournamentId: 'tour-1',
    page: 2,
    limit: 20,
    dateFrom: '2026-03-01',
    dateTo: '2026-03-31',
    taxationTypeAlias: 'NPD',
  });
  expect(json).toHaveBeenCalledWith(payload);
});

test('exportTournamentPaymentRegistryXlsx writes workbook response', async () => {
  const setHeader = jest.fn();
  const send = jest.fn();
  exportTournamentPaymentRegistryXlsxMock.mockResolvedValue({
    filename: 'payment-registry-tour-1-2026-03-12.xlsx',
    buffer: Buffer.from('xlsx'),
  });

  await controller.exportTournamentPaymentRegistryXlsx(
    {
      params: { tournamentId: 'tour-1' },
      query: {
        date_from: '2026-03-01',
        taxation_type_alias: 'PERSON',
      },
    },
    { setHeader, send }
  );

  expect(exportTournamentPaymentRegistryXlsxMock).toHaveBeenCalledWith({
    tournamentId: 'tour-1',
    dateFrom: '2026-03-01',
    dateTo: undefined,
    taxationTypeAlias: 'PERSON',
  });
  expect(setHeader).toHaveBeenCalledWith(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  expect(setHeader).toHaveBeenCalledWith(
    'Content-Disposition',
    expect.stringContaining('payment-registry-tour-1-2026-03-12.xlsx')
  );
  expect(send).toHaveBeenCalledWith(Buffer.from('xlsx'));
});

test('exportTournamentPaymentRegistryXlsx sanitizes non-ascii filename for header', async () => {
  const setHeader = jest.fn();
  const send = jest.fn();
  exportTournamentPaymentRegistryXlsxMock.mockResolvedValue({
    filename: 'payment-registry-кубок-москвы-2026-03-12.xlsx',
    buffer: Buffer.from('xlsx'),
  });

  await controller.exportTournamentPaymentRegistryXlsx(
    {
      params: { tournamentId: 'tour-1' },
      query: {},
    },
    { setHeader, send }
  );

  const contentDispositionCall = setHeader.mock.calls.find(
    ([name]) => name === 'Content-Disposition'
  );
  expect(contentDispositionCall?.[1]).toContain('filename="payment-registry-');
  expect(contentDispositionCall?.[1]).toContain("filename*=UTF-8''");
  expect(contentDispositionCall?.[1]).not.toContain('кубок');
  expect(send).toHaveBeenCalledWith(Buffer.from('xlsx'));
});

test('bulkAccrualAction forwards filtered selection payload', async () => {
  const json = jest.fn();
  const res = { json };
  applyRefereeAccrualActionBulkMock.mockResolvedValue({
    success: 2,
    failed: 0,
  });

  await controller.bulkAccrualAction(
    {
      body: {
        selection_mode: 'filtered',
        filters: {
          tournament_id: 'tour-1',
          status: 'DRAFT',
          search: 'Иванов',
        },
        action_alias: 'APPROVE',
      },
      user: { id: 'admin-1' },
    },
    res
  );

  expect(applyRefereeAccrualActionBulkMock).toHaveBeenCalledWith({
    ids: undefined,
    selectionMode: 'filtered',
    filters: {
      tournament_id: 'tour-1',
      status: 'DRAFT',
      search: 'Иванов',
    },
    actionAlias: 'APPROVE',
    actorId: 'admin-1',
    comment: undefined,
  });
  expect(json).toHaveBeenCalledWith({ success: 2, failed: 0 });
});

test('bulkDeleteAccruals forwards filtered selection payload', async () => {
  const json = jest.fn();
  const res = { json };
  bulkDeleteRefereeAccrualDocumentsMock.mockResolvedValue({
    success: 3,
    failed: 1,
  });

  await controller.bulkDeleteAccruals(
    {
      body: {
        selection_mode: 'filtered',
        filters: {
          tournament_id: 'tour-1',
          status: 'ACCRUED',
        },
        reason_code: 'DEL_DRAFT',
        comment: 'cleanup',
      },
      user: { id: 'admin-1' },
    },
    res
  );

  expect(bulkDeleteRefereeAccrualDocumentsMock).toHaveBeenCalledWith({
    ids: undefined,
    selectionMode: 'filtered',
    filters: {
      tournament_id: 'tour-1',
      status: 'ACCRUED',
    },
    reasonCode: 'DEL_DRAFT',
    comment: 'cleanup',
    actorId: 'admin-1',
  });
  expect(json).toHaveBeenCalledWith({ success: 3, failed: 1 });
});
