import profileService from '../services/profileCompletionService.js';
import mapper from '../mappers/profileCompletionMapper.js';
import { sendError } from '../utils/api.js';
import { REFEREE_ROLES } from '../utils/roles.js';
import { hasAnySnilsBulk } from '../services/snilsService.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SCAN_LIMIT = 100;

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function normalizeCompletionStatus(value) {
  const val = String(value || '')
    .trim()
    .toLowerCase();
  if (val === 'complete' || val === 'incomplete') return val;
  return '';
}

function normalizeHasSnils(value) {
  const val = String(value || '')
    .trim()
    .toLowerCase();
  if (val === 'true' || val === '1' || val === 'yes') return true;
  if (val === 'false' || val === '0' || val === 'no') return false;
  return null;
}

function isProfileComplete(profile) {
  return Boolean(
    profile.passport &&
    profile.inn &&
    profile.snils &&
    profile.bank_account &&
    profile.addresses &&
    profile.taxation_type
  );
}

function profileMatchesFilters(profile, { completionStatus, hasSnils }) {
  if (hasSnils !== null && profile.snils !== hasSnils) return false;
  if (completionStatus === 'complete' && !isProfileComplete(profile)) {
    return false;
  }
  if (completionStatus === 'incomplete' && isProfileComplete(profile)) {
    return false;
  }
  return true;
}

async function mapProfilesWithSnils(rows) {
  const profiles = mapper.toPublicArray(rows);
  const snilsPresence = await hasAnySnilsBulk(
    profiles.map((profile) => profile.id)
  );
  profiles.forEach((profile) => {
    profile.snils = snilsPresence.get(String(profile.id)) === true;
  });
  return profiles;
}

export default {
  async list(req, res) {
    try {
      const page = normalizePage(req.query.page);
      const limit = normalizeLimit(req.query.limit);
      const search = String(req.query.search || '').trim();
      const completionStatus = normalizeCompletionStatus(
        req.query.completionStatus
      );
      const hasSnils = normalizeHasSnils(req.query.hasSnils);
      const hasAdvancedFilters = completionStatus !== '' || hasSnils !== null;

      if (!hasAdvancedFilters) {
        const result = await profileService.listByRole(REFEREE_ROLES, {
          search,
          page,
          limit,
        });
        const profiles = await mapProfilesWithSnils(result.rows);
        return res.json({
          profiles,
          meta: {
            total: result.count,
            page: result.page,
            pages: result.pages,
            limit: result.limit,
          },
        });
      }

      const firstChunk = await profileService.listByRole(REFEREE_ROLES, {
        search,
        page: 1,
        limit: SCAN_LIMIT,
      });

      const start = (page - 1) * limit;
      const end = start + limit;
      const pagedProfiles = [];
      let matchedTotal = 0;

      for (let chunkPage = 1; chunkPage <= firstChunk.pages; chunkPage += 1) {
        const chunk =
          chunkPage === 1
            ? firstChunk
            : await profileService.listByRole(REFEREE_ROLES, {
                search,
                page: chunkPage,
                limit: SCAN_LIMIT,
              });
        const profiles = await mapProfilesWithSnils(chunk.rows);
        for (const profile of profiles) {
          if (
            !profileMatchesFilters(profile, {
              completionStatus,
              hasSnils,
            })
          ) {
            continue;
          }
          if (matchedTotal >= start && matchedTotal < end) {
            pagedProfiles.push(profile);
          }
          matchedTotal += 1;
        }
      }

      return res.json({
        profiles: pagedProfiles,
        meta: {
          total: matchedTotal,
          page,
          pages: Math.max(1, Math.ceil(matchedTotal / Math.max(limit, 1))),
          limit,
        },
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
