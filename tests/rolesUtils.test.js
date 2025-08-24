import { expect, test } from '@jest/globals';
import {
  hasRole,
  hasAdminRole,
  hasRefereeRole,
  hasFieldRefereeRole,
  isBrigadeRefereeOnly,
  hasStaffRole,
  isStaffOnly,
} from '../src/utils/roles.js';

test('hasRole supports string and object roles', () => {
  expect(hasRole(['ADMIN'], ['ADMIN'])).toBe(true);
  expect(hasRole([{ alias: 'REFEREE' }], ['REFEREE'])).toBe(true);
  expect(hasAdminRole([{ alias: 'ADMIN' }])).toBe(true);
  expect(hasRefereeRole([{ alias: 'REFEREE' }])).toBe(true);
  expect(hasFieldRefereeRole([{ alias: 'REFEREE' }])).toBe(true);
});

test('brigade referee only logic', () => {
  expect(isBrigadeRefereeOnly([{ alias: 'BRIGADE_REFEREE' }])).toBe(true);
  expect(
    isBrigadeRefereeOnly([{ alias: 'BRIGADE_REFEREE' }, { alias: 'REFEREE' }])
  ).toBe(false);
});

test('staff role checks', () => {
  expect(hasStaffRole([{ alias: 'SPORT_SCHOOL_STAFF' }])).toBe(true);
  expect(isStaffOnly([{ alias: 'SPORT_SCHOOL_STAFF' }])).toBe(true);
  expect(
    isStaffOnly([{ alias: 'SPORT_SCHOOL_STAFF' }, { alias: 'REFEREE' }])
  ).toBe(false);
  expect(isStaffOnly([{ alias: 'REFEREE' }])).toBe(false);
});

