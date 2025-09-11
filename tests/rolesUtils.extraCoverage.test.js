import { expect, test } from '@jest/globals';

test('roles utils extra coverage for grouped helpers', async () => {
  const rolesMod = await import('../src/utils/roles.js');
  const {
    hasRole,
    hasAdminRole,
    hasRefereeRole,
    hasFieldRefereeRole,
    isBrigadeRefereeOnly,
    hasStaffRole,
  } = rolesMod;

  // hasRole with string and object inputs
  expect(hasRole(['ADMIN'], ['ADMIN'])).toBe(true);
  expect(hasRole([{ alias: 'REFEREE' }], ['REFEREE'])).toBe(true);
  expect(hasRole(['USER'], ['ADMIN'])).toBe(false);

  // Grouped helpers
  expect(hasAdminRole([{ alias: 'ADMIN' }])).toBe(true);
  expect(hasRefereeRole([{ alias: 'REFEREE' }])).toBe(true);
  expect(hasFieldRefereeRole([{ alias: 'REFEREE' }])).toBe(true);
  expect(isBrigadeRefereeOnly([{ alias: 'BRIGADE_REFEREE' }])).toBe(true);
  expect(hasStaffRole([{ alias: 'SPORT_SCHOOL_STAFF' }])).toBe(true);
});
