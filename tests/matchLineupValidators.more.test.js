import { describe, expect, test } from '@jest/globals';

const { setLineupRules } =
  await import('../src/validators/matchLineupValidators.js');
const { validationResult } = await import('express-validator');

async function runValidation(body) {
  const req = { body };
  for (const rule of setLineupRules) {
    if (typeof rule.run === 'function') await rule.run(req);
  }
  return validationResult(req).array();
}

describe('matchLineupValidators setLineupRules', () => {
  test('accepts simple player_ids array alternative', async () => {
    const errors = await runValidation({
      team_id: 't1',
      player_ids: ['a', 'b'],
    });
    expect(errors).toHaveLength(0);
  });

  test('rejects when both arrays missing', async () => {
    const errors = await runValidation({ team_id: 't1' });
    expect(errors.some((e) => e.msg === 'player_ids_must_be_array')).toBe(true);
  });

  test('validates selected=true branch with leadership and squad fields', async () => {
    const errors = await runValidation({
      team_id: 't',
      players: [
        {
          team_player_id: 'tp1',
          selected: true,
          number: 9,
          role_id: 'r1',
          is_captain: false,
          assistant_order: 2,
          squad_no: 1,
          squad_both: true,
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  test('errors when captain also has assistant_order', async () => {
    const errors = await runValidation({
      team_id: 't',
      players: [
        {
          team_player_id: 'tp1',
          selected: true,
          number: 10,
          role_id: 'r1',
          is_captain: true,
          assistant_order: 1,
        },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  test('validates selected=false branch strict defaults', async () => {
    const errors = await runValidation({
      team_id: 't',
      players: [
        { team_player_id: 'tp1', selected: false },
        { team_player_id: 'tp2' },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  test('rejects invalid number range and role id', async () => {
    const errors = await runValidation({
      team_id: 't',
      players: [
        { team_player_id: 'tp1', selected: true, number: 123, role_id: 42 },
      ],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
