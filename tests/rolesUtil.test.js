import { expect, test } from '@jest/globals';

import {
  hasRole,
  hasAdminRole,
  hasRefereeRole,
  hasFieldRefereeRole,
  isBrigadeRefereeOnly,
  hasStaffRole,
  isStaffOnly,
  hasFhmoStaffRole,
  isFhmoStaffOnly,
} from '../src/utils/roles.js';

const role = (alias) => ({ alias });

test('role helpers detect aliases on plain strings and objects', () => {
  expect(hasRole(['ADMIN'], ['ADMIN'])).toBe(true);
  expect(hasRole([role('ADMIN')], ['ADMIN'])).toBe(true);
  expect(hasAdminRole([role('ADMIN')])).toBe(true);
  expect(hasRefereeRole(['REFEREE'])).toBe(true);
  expect(hasFieldRefereeRole([role('REFEREE'), role('SPORT_SCHOOL_STAFF')])).toBe(
    true
  );
});

test('brigade-only detection respects mixed roles', () => {
  expect(isBrigadeRefereeOnly([role('BRIGADE_REFEREE')])).toBe(true);
  expect(isBrigadeRefereeOnly([role('BRIGADE_REFEREE'), role('REFEREE')])).toBe(
    false
  );
});

test('staff helpers handle staff-only and mixed cases', () => {
  const staff = [role('SPORT_SCHOOL_STAFF')];
  expect(hasStaffRole(staff)).toBe(true);
  expect(isStaffOnly(staff)).toBe(true);
  expect(isStaffOnly([role('SPORT_SCHOOL_STAFF'), role('REFEREE')])).toBe(false);
});

test('FHMO helpers cover staff and content subsets', () => {
  const fhmo = [role('FHMO_JUDGING_HEAD')];
  expect(hasFhmoStaffRole(fhmo)).toBe(true);
  expect(isFhmoStaffOnly(fhmo)).toBe(true);
  expect(
    isFhmoStaffOnly([role('FHMO_JUDGING_HEAD'), role('SPORT_SCHOOL_STAFF')])
  ).toBe(false);
});
