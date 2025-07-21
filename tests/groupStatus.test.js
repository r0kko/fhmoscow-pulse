import { expect, test, describe } from '@jest/globals';
import { calculateGroupStatus } from '../client/src/utils/groupStatus.js';

describe('calculateGroupStatus', () => {
  test('single optional can be skipped', () => {
    const group = {
      id: 'g1',
      types: [
        {
          id: 't1',
          required: false,
          result: null,
          groups: [{ group_id: 'g1', required: false }],
        },
      ],
    };
    expect(calculateGroupStatus(group).text).toBe('Все сдано');
  });

  test('multiple optional none passed shows cross', () => {
    const group = {
      id: 'g1',
      types: [
        {
          id: 't1',
          required: false,
          result: null,
          groups: [{ group_id: 'g1', required: false }],
        },
        {
          id: 't2',
          required: false,
          result: null,
          groups: [{ group_id: 'g1', required: false }],
        },
      ],
    };
    const res = calculateGroupStatus(group);
    expect(res.icon).toContain('x-circle');
  });

  test('required passed shows done', () => {
    const group = {
      id: 'g1',
      types: [
        {
          id: 't1',
          required: true,
          result: { zone: { alias: 'GREEN' } },
          groups: [{ group_id: 'g1', required: true }],
        },
      ],
    };
    const res = calculateGroupStatus(group);
    expect(res.text).toBe('Все сдано');
  });

  test('required not passed shows cross', () => {
    const group = {
      id: 'g1',
      types: [
        {
          id: 't1',
          required: true,
          result: { zone: { alias: 'RED' } },
          groups: [{ group_id: 'g1', required: true }],
        },
      ],
    };
    const res = calculateGroupStatus(group);
    expect(res.icon).toContain('x-circle');
  });
});
