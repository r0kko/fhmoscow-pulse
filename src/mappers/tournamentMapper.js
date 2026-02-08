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
  toPublicCompetitionType(t) {
    if (!t) return null;
    const plain = typeof t.get === 'function' ? t.get({ plain: true }) : t;
    return {
      id: plain.id,
      alias: plain.alias,
      name: plain.name,
    };
  },
  toPublicScheduleManagementType(t) {
    if (!t) return null;
    const plain = typeof t.get === 'function' ? t.get({ plain: true }) : t;
    return {
      id: plain.id,
      alias: plain.alias,
      name: plain.name,
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
      competition_type_id: t.competition_type_id || null,
      schedule_management_type_id: t.schedule_management_type_id || null,
      match_format: t.match_format || null,
      referee_payment_type: t.referee_payment_type || null,
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
    if (t.CompetitionType) {
      out.competition_type = {
        id: t.CompetitionType.id,
        alias: t.CompetitionType.alias,
        name: t.CompetitionType.name,
      };
    }
    if (t.ScheduleManagementType) {
      out.schedule_management_type = {
        id: t.ScheduleManagementType.id,
        alias: t.ScheduleManagementType.alias,
        name: t.ScheduleManagementType.name,
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
      match_duration_minutes: g.match_duration_minutes ?? null,
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
  toPublicTournamentMatch(match) {
    if (!match) return null;
    const out = {
      id: match.id,
      external_id: match.external_id,
      date_start: match.date_start || null,
      scheduled_date: match.scheduled_date || null,
      tournament_id: match.tournament_id || null,
      stage_id: match.stage_id || null,
      ground_id: match.ground_id || null,
      home_team_id: match.team1_id || null,
      away_team_id: match.team2_id || null,
    };
    if (match.Tournament) {
      out.tournament = {
        id: match.Tournament.id,
        name: match.Tournament.name,
      };
    }
    if (match.Stage) {
      out.stage = {
        id: match.Stage.id,
        name: match.Stage.name || null,
      };
    }
    if (match.Ground) {
      out.ground = {
        id: match.Ground.id,
        name: match.Ground.name || null,
      };
    }
    if (match.HomeTeam) {
      out.home_team = {
        id: match.HomeTeam.id,
        name: match.HomeTeam.name,
      };
    }
    if (match.AwayTeam) {
      out.away_team = {
        id: match.AwayTeam.id,
        name: match.AwayTeam.name,
      };
    }
    return out;
  },

  toPublicRefereeRoleGroup(group) {
    if (!group) return null;
    const plain =
      typeof group.get === 'function' ? group.get({ plain: true }) : group;
    return {
      id: plain.id,
      name: plain.name,
      roles: (plain.RefereeRoles || plain.referee_roles || []).map((r) => ({
        id: r.id,
        name: r.name,
      })),
    };
  },
};
