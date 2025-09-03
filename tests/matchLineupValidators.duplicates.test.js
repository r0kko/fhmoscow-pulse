import { expect, test } from '@jest/globals';

const { setLineupRules } = await import('../src/validators/matchLineupValidators.js');
const { validationResult } = await import('express-validator');

async function runValidation(body) {
  const req = { body };
  for (const rule of setLineupRules) {
    // Only run body validators; ignore ones expecting other fields
    // All validators expose run(req)
    if (typeof rule.run === 'function') {
      await rule.run(req);
    }
  }
  return validationResult(req);
}

test('fails when duplicate match numbers among selected players', async () => {
  const res = await runValidation({
    team_id: 't1',
    players: [
      { team_player_id: 'a', selected: true, number: 7, role_id: 'r1', is_captain: true },
      { team_player_id: 'b', selected: true, number: 7, role_id: 'r2' },
    ],
  });
  expect(res.isEmpty()).toBe(false);
  const codes = res.array().map((e) => e.msg || e.param || e);
  expect(codes).toContain('duplicate_match_numbers');
});

test('passes when numbers are unique or null', async () => {
  const res = await runValidation({
    team_id: 't1',
    players: [
      { team_player_id: 'a', selected: true, number: 7, role_id: 'r1' },
      { team_player_id: 'b', selected: true, number: null, role_id: 'r2' },
      { team_player_id: 'c', selected: true, number: 8, role_id: 'r3' },
    ],
  });
  expect(res.isEmpty()).toBe(true);
});
