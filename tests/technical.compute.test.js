import { expect, test } from '@jest/globals';

const { computeTechnicalWinner } = await import('../src/utils/technical.js');

test('computeTechnicalWinner returns null when not technical', () => {
  expect(computeTechnicalWinner({ technical_defeat: 0 })).toBeNull();
  expect(computeTechnicalWinner({})).toBeNull();
});

test('computeTechnicalWinner picks home when only team1 points present', () => {
  const g = {
    technical_defeat: 1,
    points_for_tournament_table_team1: 3,
    points_for_tournament_table_team2: null,
  };
  expect(computeTechnicalWinner(g)).toBe('home');
});

test('computeTechnicalWinner picks away when only team2 points present', () => {
  const g = {
    technical_defeat: 1,
    points_for_tournament_table_team1: null,
    points_for_tournament_table_team2: 3,
  };
  expect(computeTechnicalWinner(g)).toBe('away');
});

test('computeTechnicalWinner returns null when only team1 points are non-positive', () => {
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: 0,
      points_for_tournament_table_team2: null,
    })
  ).toBeNull();
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: -2,
      points_for_tournament_table_team2: undefined,
    })
  ).toBeNull();
});

test('computeTechnicalWinner returns null when only team2 points are non-positive', () => {
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: null,
      points_for_tournament_table_team2: 0,
    })
  ).toBeNull();
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: 'x',
      points_for_tournament_table_team2: -1,
    })
  ).toBeNull();
});

test('computeTechnicalWinner compares when both present', () => {
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: 5,
      points_for_tournament_table_team2: 2,
    })
  ).toBe('home');
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: 1,
      points_for_tournament_table_team2: 4,
    })
  ).toBe('away');
});

test('computeTechnicalWinner returns null on equal points', () => {
  expect(
    computeTechnicalWinner({
      technical_defeat: 1,
      points_for_tournament_table_team1: 3,
      points_for_tournament_table_team2: 3,
    })
  ).toBeNull();
});
