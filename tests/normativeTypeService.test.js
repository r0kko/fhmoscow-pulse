import { expect, test, describe } from '@jest/globals';
import { parseValue, stepForUnit } from '../src/services/normativeTypeService.js';

describe('normativeTypeService helpers', () => {
  test('parseValue parses MIN_SEC', () => {
    const unit = { alias: 'MIN_SEC', fractional: false };
    expect(parseValue('03:45', unit)).toBe(225);
  });

  test('parseValue parses numeric with rounding', () => {
    const unit = { alias: 'REPS', fractional: false };
    expect(parseValue('12.7', unit)).toBe(13);
  });

  test('stepForUnit returns fractional step', () => {
    expect(stepForUnit({ alias: 'SECONDS', fractional: true })).toBe(0.01);
  });

  test('stepForUnit defaults to 1', () => {
    expect(stepForUnit({ alias: 'METERS', fractional: false })).toBe(1);
  });
});
