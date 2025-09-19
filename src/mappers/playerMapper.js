import {
  buildExtFilePublicUrlCandidates,
} from '../config/extFiles.js';

import teamMapper from './teamMapper.js';
import clubMapper from './clubMapper.js';
import playerPhotoRequestMapper from './playerPhotoRequestMapper.js';

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
    if (player.Photo) {
      const photo = player.Photo;
      const candidates = buildExtFilePublicUrlCandidates(photo);
      const url = candidates.length ? candidates[0] : null;
      out.photo = {
        id: photo.id,
        external_id: photo.external_id,
        module: photo.module || null,
        name: photo.name || null,
        mime_type: photo.mime_type || null,
        size: photo.size ?? null,
        object_status: photo.object_status || null,
        date_create: photo.date_create || null,
        date_update: photo.date_update || null,
        url,
        urls: candidates,
      };
      out.photo_url = url;
      out.photo_url_candidates = candidates;
    } else {
      out.photo = null;
      out.photo_url = null;
      out.photo_url_candidates = [];
    }
    if (player.Teams) {
      out.teams = player.Teams.map((t) => teamMapper.toPublic(t));
    }
    if (player.Clubs) {
      out.clubs = player.Clubs.map((c) => clubMapper.toPublic(c));
    }
    if (Array.isArray(player.PhotoRequests) && player.PhotoRequests.length) {
      const request = player.PhotoRequests[0];
      const mappedRequest = playerPhotoRequestMapper.toPublic(request);
      if (mappedRequest) {
        delete mappedRequest.player;
      }
      out.photo_request = mappedRequest || null;
    } else {
      out.photo_request = null;
    }
    return out;
  },
};
