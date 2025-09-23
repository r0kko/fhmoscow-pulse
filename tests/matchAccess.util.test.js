import { describe, expect, test } from '@jest/globals';

import ServiceError from '../src/errors/ServiceError.js';
import {
  buildPermissionPayload,
  ensureParticipantOrThrow,
  evaluateStaffMatchRestrictions,
} from '../src/utils/matchAccess.js';

describe('evaluateStaffMatchRestrictions', () => {
  test('blocks agreements for coach but allows lineups', () => {
    const context = {
      roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
      hasStaff: true,
      isAdmin: false,
      isHome: true,
      isAway: false,
      homePositionAlias: 'COACH',
      awayPositionAlias: null,
    };
    const res = evaluateStaffMatchRestrictions(context);
    expect(res.agreementsBlocked).toBe(true);
    expect(res.lineupsBlocked).toBe(false);
    expect(res.activePositions).toEqual(['COACH']);
  });

  test('blocks agreements and lineups for accountant', () => {
    const context = {
      roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
      hasStaff: true,
      isAdmin: false,
      isHome: true,
      isAway: true,
      homePositionAlias: 'ACCOUNTANT',
      awayPositionAlias: 'COACH',
    };
    const res = evaluateStaffMatchRestrictions(context);
    expect(res.agreementsBlocked).toBe(true);
    expect(res.lineupsBlocked).toBe(true);
    expect(res.activePositions).toEqual(['ACCOUNTANT', 'COACH']);
  });

  test('blocks agreements and lineups for media manager', () => {
    const context = {
      roles: [{ alias: 'SPORT_SCHOOL_STAFF' }],
      hasStaff: true,
      isAdmin: false,
      isHome: false,
      isAway: true,
      homePositionAlias: null,
      awayPositionAlias: 'MEDIA_MANAGER',
    };
    const res = evaluateStaffMatchRestrictions(context);
    expect(res.agreementsBlocked).toBe(true);
    expect(res.lineupsBlocked).toBe(true);
    expect(res.activePositions).toEqual(['MEDIA_MANAGER']);
  });

  test('admins bypass staff restrictions', () => {
    const context = {
      roles: [{ alias: 'SPORT_SCHOOL_ADMIN' }],
      hasStaff: true,
      isAdmin: true,
      isHome: true,
      isAway: false,
      homePositionAlias: 'ACCOUNTANT',
    };
    const res = evaluateStaffMatchRestrictions(context);
    expect(res.agreementsBlocked).toBe(false);
    expect(res.lineupsBlocked).toBe(false);
    expect(res.activePositions).toEqual(['ACCOUNTANT']);
  });
});

describe('buildPermissionPayload', () => {
  test('includes reasons and resolved staff positions', () => {
    const restrictions = {
      agreementsBlocked: true,
      lineupsBlocked: false,
      activePositions: ['ACCOUNTANT'],
    };
    const context = {
      homePositionAlias: 'ACCOUNTANT',
      awayPositionAlias: null,
    };
    const payload = buildPermissionPayload(restrictions, context);
    expect(payload.agreements).toEqual({
      allowed: false,
      reason: 'staff_position_restricted',
    });
    expect(payload.lineups).toEqual({
      allowed: true,
      reason: null,
    });
    expect(payload.staff_positions).toEqual({
      active: ['ACCOUNTANT'],
      home: 'ACCOUNTANT',
      away: null,
    });
  });
});

describe('ensureParticipantOrThrow', () => {
  test('throws when match lacks participants', () => {
    const ctx = {
      match: { team1_id: null, team2_id: null },
      isHome: false,
      isAway: false,
    };
    expect(() => ensureParticipantOrThrow(ctx)).toThrow(ServiceError);
    try {
      ensureParticipantOrThrow(ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect(err.code).toBe('match_teams_not_set');
      expect(err.status).toBe(409);
    }
  });

  test('throws when user is not match participant', () => {
    const ctx = {
      match: { team1_id: 't1', team2_id: 't2' },
      isHome: false,
      isAway: false,
    };
    expect(() => ensureParticipantOrThrow(ctx)).toThrow(ServiceError);
    try {
      ensureParticipantOrThrow(ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceError);
      expect(err.code).toBe('forbidden_not_match_member');
      expect(err.status).toBe(403);
    }
  });

  test('passes when user is on either side', () => {
    const ctx = {
      match: { team1_id: 't1', team2_id: 't2' },
      isHome: true,
      isAway: false,
    };
    expect(() => ensureParticipantOrThrow(ctx)).not.toThrow();
  });
});
