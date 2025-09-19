import { buildExtFilePublicUrlCandidates } from '../config/extFiles.js';

function buildFullName(entity) {
  return [entity?.surname, entity?.name, entity?.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function mapClubs(player) {
  if (!player?.Clubs) return [];
  return player.Clubs.map((club) => ({
    id: club.id,
    name: club.name || null,
  }));
}

function mapTeams(player) {
  if (!player?.Teams) return [];
  return player.Teams.map((team) => ({
    id: team.id,
    name: team.name || null,
    birth_year: team.birth_year ?? null,
  }));
}

function mapPlayer(player) {
  if (!player) return null;
  let photo = null;
  let photoUrl = null;
  let photoUrls = [];
  if (player.Photo) {
    const candidates = buildExtFilePublicUrlCandidates(player.Photo);
    photoUrls = candidates;
    photoUrl = candidates.length ? candidates[0] : null;
    photo = {
      id: player.Photo.id,
      external_id: player.Photo.external_id,
      module: player.Photo.module || null,
      name: player.Photo.name || null,
      mime_type: player.Photo.mime_type || null,
      size: player.Photo.size ?? null,
      object_status: player.Photo.object_status || null,
      date_create: player.Photo.date_create || null,
      date_update: player.Photo.date_update || null,
      url: photoUrl,
      urls: candidates,
    };
  }
  return {
    id: player.id,
    external_id: player.external_id || null,
    surname: player.surname || null,
    name: player.name || null,
    patronymic: player.patronymic || null,
    full_name: buildFullName(player),
    date_of_birth: player.date_of_birth || null,
    clubs: mapClubs(player),
    teams: mapTeams(player),
    photo,
    photo_url: photoUrl,
    photo_url_candidates: photoUrls,
  };
}

function mapFile(file) {
  if (!file) return null;
  return {
    id: file.id,
    key: file.key,
    original_name: file.original_name,
    mime_type: file.mime_type,
    size: file.size,
    download_url: file.download_url || null,
  };
}

function mapReviewer(user) {
  if (!user) return null;
  const fullName = [user.last_name, user.first_name, user.patronymic]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    id: user.id,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
    patronymic: user.patronymic || null,
    full_name: fullName,
  };
}

function toPublic(request) {
  if (!request) return null;
  const statusAlias = request.Status?.alias || null;
  const statusName = request.Status?.name || null;
  return {
    id: request.id,
    status: statusAlias,
    status_alias: statusAlias,
    status_name: statusName,
    decision_reason: request.decision_reason || null,
    submitted_at: request.createdAt || request.created_at || null,
    updated_at: request.updatedAt || request.updated_at || null,
    reviewed_at: request.reviewed_at || null,
    player: mapPlayer(request.Player),
    file: mapFile(request.File),
    reviewed_by: mapReviewer(request.ReviewedBy),
  };
}

export default { toPublic };
