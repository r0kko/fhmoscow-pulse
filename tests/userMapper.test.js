import { describe, expect, test } from '@jest/globals';
import mapper from '../src/mappers/userMapper.js';

describe('userMapper', () => {
  test('toPublic unwraps user model', () => {
    const user = { get: () => ({ id: '1', first_name: 'A' }) };
    expect(mapper.toPublic(user)).toEqual({ id: '1', first_name: 'A' });
  });

  test('toPublic removes technical fields', () => {
    const user = {
      get: () => ({
        id: '1',
        first_name: 'A',
        password: 'x',
        createdAt: 't',
        updatedAt: 't',
        deletedAt: null,
      }),
    };
    expect(mapper.toPublic(user)).toEqual({ id: '1', first_name: 'A' });
  });

  test('toPublic returns null for null input', () => {
    expect(mapper.toPublic(null)).toBeNull();
  });

  test('toPublicArray maps array', () => {
    const users = [
      { get: () => ({ id: '1' }) },
      { get: () => ({ id: '2' }) },
    ];
    expect(mapper.toPublicArray(users)).toEqual([{ id: '1' }, { id: '2' }]);
  });
});
