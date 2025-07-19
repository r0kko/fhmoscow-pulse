import { describe, test, expect } from '@jest/globals';
import mapper from '../src/mappers/normativeResultMapper.js';

const zoneMapper = await import('../src/mappers/normativeZoneMapper.js');
const groupMapper = await import('../src/mappers/normativeGroupMapper.js');

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
    });
  });

  test('toPublic returns null for null', () => {
    expect(mapper.toPublic(null)).toBeNull();
  });
});
