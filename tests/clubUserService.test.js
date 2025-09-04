import { beforeEach, expect, jest, test, describe } from '@jest/globals';

// Mocks
const userFindByPkMock = jest.fn();
const clubFindByPkMock = jest.fn();
const userClubFindOneMock = jest.fn();
const teamFindAllMock = jest.fn();
const userTeamFindOneMock = jest.fn();

const clubModelStub = { __name: 'ClubModel' };
const teamModelStub = { __name: 'TeamModel' };

// Transaction mock calls the callback immediately
const txObj = {};
const transactionMock = jest.fn(async (cb) => cb(txObj));

beforeEach(() => {
  userFindByPkMock.mockReset();
  clubFindByPkMock.mockReset();
  userClubFindOneMock.mockReset();
  teamFindAllMock.mockReset();
  userTeamFindOneMock.mockReset();
  transactionMock.mockClear();
});

jest.unstable_mockModule('../src/config/database.js', () => ({
  __esModule: true,
  default: { transaction: transactionMock },
}));

jest.unstable_mockModule('../src/models/index.js', () => ({
  __esModule: true,
  User: { findByPk: userFindByPkMock },
  Club: { findByPk: clubFindByPkMock, ...clubModelStub },
  UserClub: { findOne: userClubFindOneMock },
  Team: { findAll: teamFindAllMock, ...teamModelStub },
  UserTeam: { findOne: userTeamFindOneMock },
}));

const svcMod = await import('../src/services/clubUserService.js');
const service = svcMod.default;
const { listClubUsers, addClubUser, removeClubUser } = svcMod;

function makeUserInst() {
  return {
    addClub: jest.fn(),
    addTeam: jest.fn(),
    removeClub: jest.fn(),
    removeTeam: jest.fn(),
  };
}

describe('clubUserService.listUserClubs', () => {
  test('throws when user not found', async () => {
    userFindByPkMock.mockResolvedValue(null);
    await expect(service.listUserClubs('u1')).rejects.toThrow('user_not_found');
  });

  test('returns empty array when no clubs', async () => {
    userFindByPkMock.mockResolvedValue({ Clubs: undefined });
    const res = await service.listUserClubs('u1');
    expect(res).toEqual([]);
  });
});

describe('clubUserService.addUserClub/removeUserClub', () => {
  test('addUserClub creates new link and attaches to all teams', async () => {
    const u = makeUserInst();
    userFindByPkMock.mockResolvedValue(u);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    userClubFindOneMock.mockResolvedValue(null);
    teamFindAllMock.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    userTeamFindOneMock.mockResolvedValue(null);

    await service.addUserClub('u1', 'c1', 'actor');
    expect(transactionMock).toHaveBeenCalled();
    expect(u.addClub).toHaveBeenCalledWith(
      { id: 'c1' },
      expect.objectContaining({
        through: expect.objectContaining({
          created_by: 'actor',
          updated_by: 'actor',
        }),
        transaction: expect.any(Object),
      })
    );
    // Two teams attached
    expect(u.addTeam).toHaveBeenCalledTimes(2);
  });

  test('addUserClub restores soft-deleted links', async () => {
    const u = makeUserInst();
    userFindByPkMock.mockResolvedValue(u);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    const restoreMock = jest.fn();
    const updateMock = jest.fn();
    userClubFindOneMock.mockResolvedValue({
      deletedAt: new Date(),
      restore: restoreMock,
      update: updateMock,
    });
    const tRestore = jest.fn();
    const tUpdate = jest.fn();
    teamFindAllMock.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
    userTeamFindOneMock
      .mockResolvedValueOnce({
        deletedAt: new Date(),
        restore: tRestore,
        update: tUpdate,
      })
      .mockResolvedValueOnce({
        deletedAt: new Date(),
        restore: tRestore,
        update: tUpdate,
      });

    await service.addUserClub('u1', 'c1', 'actor');
    expect(restoreMock).toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith(
      { updated_by: 'actor' },
      expect.any(Object)
    );
    expect(tRestore).toHaveBeenCalled();
    expect(tUpdate).toHaveBeenCalled();
    // In restore path, user.addClub should not be called
    expect(u.addClub).not.toHaveBeenCalled();
  });

  test('removeUserClub updates link and removes from teams', async () => {
    const u = makeUserInst();
    userFindByPkMock.mockResolvedValue(u);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    const linkUpdate = jest.fn();
    userClubFindOneMock.mockResolvedValue({ update: linkUpdate });
    const tUpdate = jest.fn();
    teamFindAllMock.mockResolvedValue([{ id: 't1' }]);
    userTeamFindOneMock.mockResolvedValue({ update: tUpdate });

    await service.removeUserClub('u1', 'c1', 'actor');
    expect(linkUpdate).toHaveBeenCalledWith(
      { updated_by: 'actor' },
      expect.any(Object)
    );
    expect(u.removeClub).toHaveBeenCalled();
    expect(tUpdate).toHaveBeenCalled();
    expect(u.removeTeam).toHaveBeenCalled();
  });

  test('addUserClub throws when user/club not found', async () => {
    userFindByPkMock.mockResolvedValue(null);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    await expect(service.addUserClub('u1', 'c1', 'actor')).rejects.toThrow(
      'user_not_found'
    );
    userFindByPkMock.mockResolvedValue({});
    clubFindByPkMock.mockResolvedValue(null);
    await expect(service.addUserClub('u1', 'c1', 'actor')).rejects.toThrow(
      'club_not_found'
    );
  });

  test('removeUserClub throws when user/club not found', async () => {
    userFindByPkMock.mockResolvedValue(null);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    await expect(service.removeUserClub('u1', 'c1', 'actor')).rejects.toThrow(
      'user_not_found'
    );
    userFindByPkMock.mockResolvedValue({});
    clubFindByPkMock.mockResolvedValue(null);
    await expect(service.removeUserClub('u1', 'c1', 'actor')).rejects.toThrow(
      'club_not_found'
    );
  });
});

describe('club-centric helpers', () => {
  test('listClubUsers returns users for existing club', async () => {
    clubFindByPkMock.mockResolvedValue({ Users: [{ id: 1 }] });
    const res = await listClubUsers('c1');
    expect(res).toEqual([{ id: 1 }]);
  });

  test('listClubUsers throws when club missing', async () => {
    clubFindByPkMock.mockResolvedValue(null);
    await expect(listClubUsers('c1')).rejects.toThrow('club_not_found');
  });

  test('addClubUser/removeClubUser delegate to user operations', async () => {
    const u = makeUserInst();
    userFindByPkMock.mockResolvedValue(u);
    clubFindByPkMock.mockResolvedValue({ id: 'c1' });
    userClubFindOneMock.mockResolvedValue(null);
    teamFindAllMock.mockResolvedValue([]);

    await addClubUser('c1', 'u1', 'actor');
    expect(u.addClub).toHaveBeenCalled();
    await removeClubUser('c1', 'u1', 'actor');
    expect(u.removeClub).toHaveBeenCalled();
  });
});
