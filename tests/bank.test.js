import { describe, expect, test } from '@jest/globals';
import { isValidAccountNumber } from '../src/utils/bank.js';

describe('bank utils', () => {
  test('isValidAccountNumber validates checksum', () => {
    expect(isValidAccountNumber('40702810900000005555', '044525225')).toBe(
      true
    );
    expect(isValidAccountNumber('40702810900000005554', '044525225')).toBe(
      false
    );
  });
});
