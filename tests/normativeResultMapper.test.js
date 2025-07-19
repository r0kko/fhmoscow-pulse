import { describe, test, expect } from '@jest/globals';
import mapper from '../src/mappers/normativeResultMapper.js';

const zoneMapper = await import('../src/mappers/normativeZoneMapper.js');
const groupMapper = await import('../src/mappers/normativeGroupMapper.js');
const userMapper = await import('../src/mappers/userMapper.js');
const trainingMapper = await import('../src/mappers/trainingMapper.js');

const zone = { alias: 'GREEN', name: 'Green' };
const group = { id: 'g1', name: 'Group1' };

const resultModel = {
  get: () => ({
    id: 'r1',
    user_id: 'u1',
    season_id: 's1',
    training_id: 't1',
    type_id: 'n1',
    value_type_id: 'v1',
    unit_id: 'u1',
    value: 10,
    zone,
    group,
    User: { id: 'u1', first_name: 'John' },
    Training: { id: 't1', start_at: '2025-07-18T10:00:00Z' },
  }),
};

describe('normativeResultMapper', () => {
  test('toPublic maps associations', () => {
    const res = mapper.toPublic(resultModel);
    expect(res).toEqual({
      id: 'r1',
      user_id: 'u1',
      season_id: 's1',
      training_id: 't1',
      type_id: 'n1',
      value_type_id: 'v1',
      unit_id: 'u1',
      value: 10,
      zone: zoneMapper.default.toPublic(zone),
      group: groupMapper.default.toPublic(group),
      user: userMapper.default.toPublic({ id: 'u1', first_name: 'John' }),
      training: trainingMapper.default.toPublic({ id: 't1', start_at: '2025-07-18T10:00:00Z' }),
    });
  });

  test('toPublic returns null for null', () => {
    expect(mapper.toPublic(null)).toBeNull();
  });
});
