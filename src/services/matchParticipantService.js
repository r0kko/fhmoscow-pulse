import {
  Match,
  MatchParticipantPlayer,
  MatchParticipantStaff,
  Player,
  PlayerRole,
  Staff,
  Team,
  Tournament,
  TournamentType,
  ScheduleManagementType,
} from '../models/index.js';
import {
  resolveMatchAccessContext,
  evaluateStaffMatchRestrictions,
  evaluateScheduleManagementRestrictions,
  mergeMatchRestrictions,
} from '../utils/matchAccess.js';

function fullName(person) {
  return [person?.surname, person?.name, person?.patronymic]
    .filter(Boolean)
    .join(' ');
}

async function loadMatchOrThrow(matchId) {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'team1_id', 'team2_id', 'tournament_id'],
    include: [
      { model: Team, as: 'HomeTeam', attributes: ['id', 'name'] },
      { model: Team, as: 'AwayTeam', attributes: ['id', 'name'] },
      {
        model: Tournament,
        attributes: ['id', 'type_id'],
        include: [
          { model: TournamentType, attributes: ['double_protocol'] },
          { model: ScheduleManagementType, attributes: ['alias', 'name'] },
        ],
      },
    ],
  });
  if (!match) {
    const err = new Error('match_not_found');
    err.code = 404;
    throw err;
  }
  return match;
}

async function assertAccess(match, actorUserId) {
  const context = await resolveMatchAccessContext({
    matchOrId: match,
    userId: actorUserId,
  });
  const isAdmin = Boolean(context.isAdmin);
  if (!context.isHome && !context.isAway && !isAdmin) {
    const err = new Error('forbidden_not_match_member');
    err.code = 403;
    throw err;
  }
  const restrictions = mergeMatchRestrictions(
    evaluateStaffMatchRestrictions(context),
    evaluateScheduleManagementRestrictions(match)
  );
  if (restrictions.lineupsBlocked) {
    const err = new Error('staff_position_restricted');
    err.code = 403;
    throw err;
  }
}

function mapPlayer(row) {
  return {
    id: row.id,
    external_id: row.external_id,
    external_game_id: row.external_game_id,
    external_team_id: row.external_team_id,
    external_player_id: row.external_player_id,
    match_id: row.match_id,
    team_id: row.team_id,
    player_id: row.player_id,
    team_side: row.team_side,
    team_name: row.Team?.name || null,
    full_name: fullName(row.Player) || null,
    number: row.number,
    role: {
      id: row.role_id,
      external_id: row.role_external_id,
      name: row.role_name || row.PlayerRole?.name || null,
      abbreviation: row.role_abbreviation || null,
    },
    match_position: {
      external_id: row.match_position_external_id,
      name: row.match_position_name || null,
      abbreviation: row.match_position_abbreviation || null,
    },
    lineup_number: row.lineup_number,
    played: row.played,
    played_in_lineup: row.played_in_lineup,
  };
}

function mapStaff(row) {
  return {
    id: row.id,
    external_id: row.external_id,
    external_game_id: row.external_game_id,
    external_team_id: row.external_team_id,
    external_staff_id: row.external_staff_id,
    match_id: row.match_id,
    team_id: row.team_id,
    staff_id: row.staff_id,
    team_side: row.team_side,
    team_name: row.Team?.name || null,
    full_name: fullName(row.Staff) || null,
    position: row.position,
  };
}

function sidePayload(match, side, players, staff) {
  const teamId = side === 1 ? match.team1_id : match.team2_id;
  const team = side === 1 ? match.HomeTeam : match.AwayTeam;
  return {
    team_id: teamId || null,
    team_name: team?.name || null,
    players: players.filter((row) => Number(row.team_side) === side),
    staff: staff.filter((row) => Number(row.team_side) === side),
  };
}

export async function list(matchId, actorUserId) {
  const match = await loadMatchOrThrow(matchId);
  await assertAccess(match, actorUserId);

  const [players, staff] = await Promise.all([
    MatchParticipantPlayer.findAll({
      where: { match_id: match.id },
      include: [
        { model: Team, attributes: ['id', 'name'], required: false },
        {
          model: Player,
          attributes: ['id', 'surname', 'name', 'patronymic'],
          required: false,
        },
        { model: PlayerRole, attributes: ['id', 'name'], required: false },
      ],
      order: [
        ['team_side', 'ASC'],
        ['number', 'ASC'],
        ['external_id', 'ASC'],
      ],
    }),
    MatchParticipantStaff.findAll({
      where: { match_id: match.id },
      include: [
        { model: Team, attributes: ['id', 'name'], required: false },
        {
          model: Staff,
          attributes: ['id', 'surname', 'name', 'patronymic'],
          required: false,
        },
      ],
      order: [
        ['team_side', 'ASC'],
        ['position', 'ASC'],
        ['external_id', 'ASC'],
      ],
    }),
  ]);

  const mappedPlayers = players.map(mapPlayer);
  const mappedStaff = staff.map(mapStaff);

  return {
    match_id: match.id,
    synced_snapshot: true,
    home: sidePayload(match, 1, mappedPlayers, mappedStaff),
    away: sidePayload(match, 2, mappedPlayers, mappedStaff),
  };
}

export default { list };
