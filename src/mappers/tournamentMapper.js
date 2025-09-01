export default {
  toPublicType(t) {
    if (!t) return null;
    const plain = typeof t.get === 'function' ? t.get({ plain: true }) : t;
    return {
      id: plain.id,
      name: plain.name,
      double_protocol: !!plain.double_protocol,
    };
  },

  toPublicTournament(t) {
    if (!t) return null;
    const out = {
      id: t.id,
      external_id: t.external_id,
      name: t.name,
      full_name: t.full_name || null,
      birth_year: t.birth_year || null,
      season_id: t.season_id || null,
      type_id: t.type_id || null,
    };
    if (t.Season) {
      out.season = { id: t.Season.id, name: t.Season.name };
    }
    if (t.TournamentType) {
      out.type = {
        id: t.TournamentType.id,
        name: t.TournamentType.name,
        double_protocol: !!t.TournamentType.double_protocol,
      };
    }
    if (t.counts) out.counts = t.counts;
    return out;
  },

  toPublicStage(s) {
    if (!s) return null;
    const out = {
      id: s.id,
      external_id: s.external_id,
      name: s.name || null,
      tournament_id: s.tournament_id || null,
    };
    if (s.Tournament) {
      const t = s.Tournament;
      out.tournament = {
        id: t.id,
        name: t.name,
        birth_year: t.birth_year || null,
      };
      if (t.Season)
        out.tournament.season = { id: t.Season.id, name: t.Season.name };
      if (t.TournamentType)
        out.tournament.type = {
          id: t.TournamentType.id,
          name: t.TournamentType.name,
        };
    }
    return out;
  },

  toPublicGroup(g) {
    if (!g) return null;
    const out = {
      id: g.id,
      external_id: g.external_id,
      name: g.name || null,
      tournament_id: g.tournament_id || null,
      stage_id: g.stage_id || null,
    };
    if (g.Tournament) {
      const t = g.Tournament;
      out.tournament = {
        id: t.id,
        name: t.name,
        birth_year: t.birth_year || null,
      };
      if (t.Season)
        out.tournament.season = { id: t.Season.id, name: t.Season.name };
    }
    if (g.Stage)
      out.stage = {
        id: g.Stage.id,
        external_id: g.Stage.external_id,
        name: g.Stage.name || null,
      };
    return out;
  },

  toPublicTournamentTeam(tt) {
    if (!tt) return null;
    const out = {
      id: tt.id,
      external_id: tt.external_id,
      tournament_id: tt.tournament_id || null,
      tournament_group_id: tt.tournament_group_id || null,
      team_id: tt.team_id || null,
    };
    if (tt.Tournament)
      out.tournament = { id: tt.Tournament.id, name: tt.Tournament.name };
    if (tt.TournamentGroup)
      out.group = {
        id: tt.TournamentGroup.id,
        name: tt.TournamentGroup.name || null,
      };
    if (tt.Team) out.team = { id: tt.Team.id, name: tt.Team.name };
    return out;
  },
};
