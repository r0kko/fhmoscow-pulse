import { expect, test, describe } from '@jest/globals';
import {
  parseValue,
  stepForUnit,
  determineZone,
} from '../src/services/normativeTypeService.js';

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

  test('determineZone finds correct zone', () => {
    const type = {
      NormativeTypeZones: [
        { min_value: 10, max_value: null, NormativeZone: { alias: 'GREEN' } },
        { min_value: 5, max_value: 9, NormativeZone: { alias: 'YELLOW' } },
        { min_value: null, max_value: 4, NormativeZone: { alias: 'RED' } },
      ],
    };
    const zone = determineZone(type, 7);
    expect(zone.NormativeZone.alias).toBe('YELLOW');
  });
});
