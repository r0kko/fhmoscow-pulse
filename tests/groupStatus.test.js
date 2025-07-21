import { expect, test, describe } from '@jest/globals';
import { calculateGroupStatus } from '../client/src/utils/groupStatus.js';

describe('calculateGroupStatus', () => {
  test('all optional single type shows done', () => {
    const group = {
      id: 'g1',
      types: [
        { id: 't1', required: false, groups: [{ group_id: 'g1', required: false }] },
      ],
    };
    expect(calculateGroupStatus(group).text).toBe('Все сдано');
  });

  test('multiple optional none passed shows cross', () => {
    const group = {
      id: 'g1',
      types: [
        { id: 't1', required: false, groups: [{ group_id: 'g1', required: false }] },
        { id: 't2', required: false, groups: [{ group_id: 'g1', required: false }] },
      ],
    };
    const res = calculateGroupStatus(group);
    expect(res.icon).toContain('x-circle');
  });

  test('required not passed shows cross', () => {
    const group = {
      id: 'g1',
      types: [
        { id: 't1', required: true, groups: [{ group_id: 'g1', required: true }] },
        { id: 't2', required: false, groups: [{ group_id: 'g1', required: false }] },
      ],
    };
    const res = calculateGroupStatus(group);
    expect(res.icon).toContain('x-circle');
  });
});
