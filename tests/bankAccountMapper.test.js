import { describe, expect, test } from '@jest/globals';

const { default: mapper } = await import('../src/mappers/bankAccountMapper.js');

describe('bankAccountMapper.toPublic', () => {
  test('returns null for falsy input', () => {
    expect(mapper.toPublic(null)).toBeNull();
    expect(mapper.toPublic(undefined)).toBeNull();
  });

  test('maps instance with get({ plain: true })', () => {
    const obj = {
      id: 'a1',
      number: '40702810',
      bic: '044525225',
      bank_name: 'Bank',
      correspondent_account: '30101810400000000225',
      swift: 'XXXXXXXX',
      inn: '7700000000',
      kpp: '770000001',
      address: 'Moscow',
      extra: 'should be stripped',
    };
    const acc = { get: () => ({ ...obj }) };
    const res = mapper.toPublic(acc);
    expect(res).toEqual({
      id: 'a1',
      number: '40702810',
      bic: '044525225',
      bank_name: 'Bank',
      correspondent_account: '30101810400000000225',
      swift: 'XXXXXXXX',
      inn: '7700000000',
      kpp: '770000001',
      address: 'Moscow',
    });
    expect(res.extra).toBeUndefined();
  });

  test('maps plain object without get()', () => {
    const res = mapper.toPublic({ id: 'x', number: 'n', junk: 'x' });
    expect(res).toMatchObject({ id: 'x', number: 'n' });
    expect(res.junk).toBeUndefined();
  });
});
