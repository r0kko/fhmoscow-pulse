import { beforeEach, expect, jest, test } from '@jest/globals';

const validationResultMock = jest.fn();

const loggerInfoMock = jest.fn();
const loggerWarnMock = jest.fn();
const getWorkspaceMock = jest.fn();
const updateUserMock = jest.fn();
const getUserMock = jest.fn();
const userToPublicMock = jest.fn((v) => v);

const incProfileWorkspaceLoadMock = jest.fn();
const observeProfileWorkspaceLoadDurationMock = jest.fn();
const incProfileSectionUpdateMock = jest.fn();
const observeProfileSectionUpdateDurationMock = jest.fn();
const incProfileSectionUpdateErrorMock = jest.fn();

jest.unstable_mockModule('express-validator', () => ({
  __esModule: true,
  validationResult: validationResultMock,
}));

jest.unstable_mockModule('../logger.js', () => ({
  __esModule: true,
  default: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
}));

jest.unstable_mockModule('../src/services/profileWorkspaceService.js', () => ({
  __esModule: true,
  default: {
    getWorkspace: getWorkspaceMock,
  },
}));

jest.unstable_mockModule('../src/services/userService.js', () => ({
  __esModule: true,
  default: {
    updateUser: updateUserMock,
    getUser: getUserMock,
  },
}));

jest.unstable_mockModule('../src/services/passportService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/innService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/snilsService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/bankAccountService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/taxationService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/dadataService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/addressService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/clubUserService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/services/teamService.js', () => ({
  __esModule: true,
  default: {},
}));

jest.unstable_mockModule('../src/mappers/userMapper.js', () => ({
  __esModule: true,
  default: {
    toPublic: userToPublicMock,
  },
}));

jest.unstable_mockModule('../src/mappers/passportMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/innMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/snilsMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/bankAccountMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/taxationMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/addressMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/clubMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));
jest.unstable_mockModule('../src/mappers/teamMapper.js', () => ({
  __esModule: true,
  default: { toPublic: (v) => v },
}));

jest.unstable_mockModule('../src/config/metrics.js', () => ({
  __esModule: true,
  incProfileWorkspaceLoad: incProfileWorkspaceLoadMock,
  observeProfileWorkspaceLoadDuration: observeProfileWorkspaceLoadDurationMock,
  incProfileSectionUpdate: incProfileSectionUpdateMock,
  observeProfileSectionUpdateDuration: observeProfileSectionUpdateDurationMock,
  incProfileSectionUpdateError: incProfileSectionUpdateErrorMock,
}));

const { default: controller } =
  await import('../src/controllers/profileWorkspaceAdminController.js');

beforeEach(() => {
  validationResultMock.mockReset();
  loggerInfoMock.mockReset();
  loggerWarnMock.mockReset();
  getWorkspaceMock.mockReset();
  updateUserMock.mockReset();
  getUserMock.mockReset();
  userToPublicMock.mockClear();
  incProfileWorkspaceLoadMock.mockReset();
  observeProfileWorkspaceLoadDurationMock.mockReset();
  incProfileSectionUpdateMock.mockReset();
  observeProfileSectionUpdateDurationMock.mockReset();
  incProfileSectionUpdateErrorMock.mockReset();
  validationResultMock.mockReturnValue({
    isEmpty: () => true,
    array: () => [],
  });
});

test('getWorkspace returns payload and records metrics', async () => {
  getWorkspaceMock.mockResolvedValue({ user: { id: 'u-1' } });

  const req = { params: { id: 'u-1' }, user: { id: 'admin' }, id: 'req-1' };
  const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

  await controller.getWorkspace(req, res);

  expect(getWorkspaceMock).toHaveBeenCalledWith('u-1', req.user);
  expect(res.json).toHaveBeenCalledWith({ user: { id: 'u-1' } });
  expect(incProfileWorkspaceLoadMock).toHaveBeenCalledWith('success');
  expect(observeProfileWorkspaceLoadDurationMock).toHaveBeenCalled();
});

test('updatePersonal returns unified validation error response', async () => {
  validationResultMock.mockReturnValue({
    isEmpty: () => false,
    array: () => [{ path: 'email', msg: 'invalid_email' }],
  });

  const req = {
    id: 'req-2',
    params: { id: 'u-2' },
    body: { email: 'bad' },
    user: { id: 'admin' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await controller.updatePersonal(req, res);

  expect(res.status).toHaveBeenCalledWith(422);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: 'validation_error',
      request_id: 'req-2',
      field_errors: [
        {
          field: 'email',
          code: 'invalid_email',
          message: 'invalid_email',
        },
      ],
    })
  );
  expect(updateUserMock).not.toHaveBeenCalled();
});

test('updateRoles rejects multiple federation positions', async () => {
  const req = {
    id: 'req-3',
    params: { id: 'u-3' },
    body: {
      roles: ['FHMO_JUDGING_HEAD', 'FHMO_MEDIA_PRESS_SECRETARY'],
    },
    user: { id: 'admin' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await controller.updateRoles(req, res);

  expect(res.status).toHaveBeenCalledWith(422);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: 'invalid_fhmo_roles',
      request_id: 'req-3',
      field_errors: [
        expect.objectContaining({
          field: 'roles',
          code: 'invalid_fhmo_roles',
        }),
      ],
    })
  );
  expect(getUserMock).not.toHaveBeenCalled();
});
