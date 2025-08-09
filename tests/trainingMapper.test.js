import { expect, test } from '@jest/globals';
import mapper from '../src/mappers/trainingMapper.js';

test('maps teachers and coaches', () => {
  const start = new Date().toISOString();
  const end = new Date(Date.now() + 3600000).toISOString();
  const training = {
    id: 't1',
    start_at: start,
    end_at: end,
    capacity: 10,
    ground_id: null,
    season_id: null,
    attendance_marked: false,
    TrainingRegistrations: [
      {
        TrainingRole: { alias: 'TEACHER' },
        User: { id: 'u1', first_name: 'A', last_name: 'B' },
      },
      {
        TrainingRole: { alias: 'COACH' },
        User: { id: 'u2', first_name: 'C', last_name: 'D' },
      },
    ],
  };
  const res = mapper.toPublic(training);
  expect(res.teachers).toHaveLength(1);
  expect(res.coaches).toHaveLength(1);
});
