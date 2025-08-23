import teamMapper from './teamMapper.js';
import clubMapper from './clubMapper.js';

function buildFullName(player) {
  return [player.surname, player.name, player.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export default {
  toPublic(player) {
    if (!player) return null;
    const out = {
      id: player.id,
      external_id: player.external_id,
      surname: player.surname || null,
      name: player.name || null,
      patronymic: player.patronymic || null,
      full_name: buildFullName(player),
      date_of_birth: player.date_of_birth || null,
      height: player.height || null,
      weight: player.weight || null,
      grip: player.grip || null,
    };
    if (player.Teams) {
      out.teams = player.Teams.map((t) => teamMapper.toPublic(t));
    }
    if (player.Clubs) {
      out.clubs = player.Clubs.map((c) => clubMapper.toPublic(c));
    }
    return out;
  },
};
