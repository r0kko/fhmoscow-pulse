import path from 'path';

import playerPhotoRequestService from '../services/playerPhotoRequestService.js';
import playerPhotoRequestMapper from '../mappers/playerPhotoRequestMapper.js';
import fileService from '../services/fileService.js';
import { sendError } from '../utils/api.js';

function parseIds(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((val) => val.trim())
    .filter(Boolean);
}

function guessFileExtension(file) {
  const originalExt = file?.original_name
    ? path.extname(file.original_name).toLowerCase()
    : '';
  if (['.png', '.jpg', '.jpeg'].includes(originalExt)) {
    return originalExt === '.jpeg' ? '.jpg' : originalExt;
  }
  const mime = (file?.mime_type || '').toLowerCase();
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg') return '.jpg';
  return '.jpg';
}

function buildDownloadFilename(request) {
  const player = request?.Player || {};
  const parts = [player.surname, player.name, player.patronymic]
    .map((val) => (val || '').trim())
    .filter(Boolean);
  const fio = parts.join(' ');
  let birthYear = '';
  if (player.date_of_birth) {
    const year = new Date(player.date_of_birth).getFullYear();
    if (Number.isFinite(year)) birthYear = String(year);
  }
  if (!birthYear && Array.isArray(player.Teams)) {
    const teamYear = player.Teams.find((team) => team?.birth_year);
    if (teamYear?.birth_year) birthYear = String(teamYear.birth_year);
  }
  const ext = guessFileExtension(request?.File);
  const base = `${fio || 'Игрок'}${birthYear ? ` ${birthYear}` : ''}`
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safeBase = base || 'photo';
  return `${safeBase}${ext}`;
}

async function enrichWithDownloadUrl(request) {
  if (!request?.File) return request;
  try {
    const filename = buildDownloadFilename(request);
    const url = await fileService.getDownloadUrl(request.File, {
      filename,
    });
    request.File.download_url = url;
  } catch (err) {
    void err;
    request.File.download_url = null;
  }
  return request;
}

export default {
  async list(req, res) {
    try {
      const {
        status = 'pending',
        page,
        limit,
        search,
        club_id,
        team_id,
      } = req.query || {};
      const clubIds = parseIds(club_id);
      const teamIds = parseIds(team_id);
      const result = await playerPhotoRequestService.list({
        status,
        page,
        limit,
        search,
        clubIds,
        teamIds,
      });
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const enriched = await Promise.all(
        rows.map((row) => enrichWithDownloadUrl(row))
      );
      const mapped = enriched.map((row) =>
        playerPhotoRequestMapper.toPublic(row)
      );
      const total =
        typeof result.count === 'number'
          ? result.count
          : Array.isArray(result.count)
            ? result.count.length
            : 0;
      const perPage = Number(result.pageSize || limit || 25);
      const currentPage = Number(result.page || page || 1);
      const totalPages = perPage ? Math.ceil(total / perPage) : 0;
      return res.json({
        requests: mapped,
        total,
        page: currentPage,
        per_page: perPage,
        total_pages: totalPages,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async show(req, res) {
    try {
      const request = await playerPhotoRequestService.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ error: 'photo_request_not_found' });
      }
      await enrichWithDownloadUrl(request);
      return res.json({ request: playerPhotoRequestMapper.toPublic(request) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async approve(req, res) {
    try {
      const updated = await playerPhotoRequestService.approve({
        requestId: req.params.id,
        actorId: req.user?.id || null,
      });
      await enrichWithDownloadUrl(updated);
      return res.json({
        request: playerPhotoRequestMapper.toPublic(updated),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async reject(req, res) {
    try {
      const updated = await playerPhotoRequestService.reject({
        requestId: req.params.id,
        actorId: req.user?.id || null,
        reason: req.body?.reason,
      });
      await enrichWithDownloadUrl(updated);
      return res.json({
        request: playerPhotoRequestMapper.toPublic(updated),
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
