// Compute technical winner side based on external game fields
// Returns 'home', 'away' or null
export function computeTechnicalWinner(extGame) {
  try {
    const tech = Number(extGame?.technical_defeat);
    if (tech !== 1) return null;
    const p1 = extGame?.points_for_tournament_table_team1;
    const p2 = extGame?.points_for_tournament_table_team2;
    const n1 = Number.isFinite(Number(p1)) ? Number(p1) : null;
    const n2 = Number.isFinite(Number(p2)) ? Number(p2) : null;
    if (n1 == null && n2 == null) return null;
    if (n1 != null && n2 != null) {
      if (n1 > n2) return 'home';
      if (n2 > n1) return 'away';
      return null;
    }
    // If only one side has a numeric value, treat positive value as winner
    if (n1 != null && n2 == null) return n1 > 0 ? 'home' : null;
    if (n2 != null && n1 == null) return n2 > 0 ? 'away' : null;
    return null;
  } catch {
    return null;
  }
}

export default { computeTechnicalWinner };
