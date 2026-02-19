import { validationResult } from 'express-validator';

import logger from '../../logger.js';
import profileWorkspaceService from '../services/profileWorkspaceService.js';
import userService from '../services/userService.js';
import passportService from '../services/passportService.js';
import innService from '../services/innService.js';
import snilsService from '../services/snilsService.js';
import bankAccountService from '../services/bankAccountService.js';
import taxationService from '../services/taxationService.js';
import dadataService from '../services/dadataService.js';
import addressService from '../services/addressService.js';
import clubUserService from '../services/clubUserService.js';
import teamService from '../services/teamService.js';
import userMapper from '../mappers/userMapper.js';
import passportMapper from '../mappers/passportMapper.js';
import innMapper from '../mappers/innMapper.js';
import snilsMapper from '../mappers/snilsMapper.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';
import taxationMapper from '../mappers/taxationMapper.js';
import addressMapper from '../mappers/addressMapper.js';
import clubMapper from '../mappers/clubMapper.js';
import teamMapper from '../mappers/teamMapper.js';
import {
  incProfileSectionUpdate,
  incProfileSectionUpdateError,
  incProfileWorkspaceLoad,
  observeProfileSectionUpdateDuration,
  observeProfileWorkspaceLoadDuration,
} from '../config/metrics.js';
import { FHMO_STAFF_ROLES } from '../utils/roles.js';

const ADDRESS_TYPES = new Set(['REGISTRATION', 'RESIDENCE']);

function nowMs() {
  return Date.now();
}

function toErrorCode(err, fallback = 'validation_error') {
  if (err?.code) return String(err.code);
  if (err?.status && err.status >= 500) return 'internal_error';
  if (err?.message) return String(err.message);
  return fallback;
}

function sendWorkspaceError(
  req,
  res,
  err,
  defaultStatus = 400,
  fieldErrors = undefined
) {
  const status =
    err?.status ||
    (toErrorCode(err) === 'validation_error' ? 422 : defaultStatus);
  const code = toErrorCode(err);
  const details = { ...(err?.details || {}) };
  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    details.field_errors = fieldErrors;
  }
  const body = {
    error: code,
    message: code,
    details,
    request_id: req.id || null,
  };
  if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
    body.field_errors = fieldErrors;
  }
  return res.status(status).json(body);
}

function ensureValid(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return true;
  const fieldErrors = result.array().map((entry) => ({
    field: entry.path,
    code: String(entry.msg || 'validation_error'),
    message: String(entry.msg || 'validation_error'),
  }));
  sendWorkspaceError(
    req,
    res,
    { message: 'validation_error', details: { validation: result.array() } },
    422,
    fieldErrors
  );
  return false;
}

function observeAndLog(
  action,
  requestId,
  entityId,
  startedAtMs,
  level = 'info'
) {
  const latencyMs = Math.max(0, nowMs() - startedAtMs);
  logger[level]('profile_workspace_event', {
    request_id: requestId || null,
    section: action,
    entity_id: entityId,
    latency_ms: latencyMs,
  });
  return latencyMs;
}

async function updateInn(userId, number, actorId) {
  const existing = await innService.getByUser(userId);
  if (existing) {
    const updated = await innService.update(userId, number, actorId);
    return innMapper.toPublic(updated);
  }
  const created = await innService.create(userId, number, actorId);
  return innMapper.toPublic(created);
}

async function updateSnils(userId, number, actorId) {
  const existing = await snilsService.getByUser(userId);
  if (existing) {
    const updated = await snilsService.update(userId, number, actorId);
    return snilsMapper.toPublic(updated);
  }
  const created = await snilsService.create(userId, number, actorId);
  return snilsMapper.toPublic(created);
}

async function updateAddress(userId, type, payload, actorId) {
  try {
    const current = await addressService.getForUser(userId, type);
    if (current) {
      const updated = await addressService.updateForUser(
        userId,
        type,
        payload,
        actorId
      );
      return addressMapper.toPublic(updated);
    }
  } catch (_err) {
    // If address is absent, create below.
  }

  const created = await addressService.createForUser(
    userId,
    type,
    payload,
    actorId
  );
  return addressMapper.toPublic(created);
}

async function updateBankAccount(userId, payload, actorId) {
  const bank = await dadataService.findBankByBic(payload.bic);
  if (!bank) {
    const err = new Error('bank_not_found');
    err.status = 400;
    throw err;
  }

  const data = {
    number: payload.number,
    bic: payload.bic,
    bank_name: bank.value,
    correspondent_account: bank.data.correspondent_account,
    swift: bank.data.swift,
    inn: bank.data.inn,
    kpp: bank.data.kpp,
    address: bank.data.address?.unrestricted_value,
  };

  const existing = await bankAccountService.getByUser(userId);

  if (!existing) {
    const created = await bankAccountService.createForUser(
      userId,
      data,
      actorId
    );
    return bankAccountMapper.toPublic(created);
  }

  if (existing.number !== data.number || existing.bic !== data.bic) {
    await bankAccountService.removeForUser(userId, actorId);
    const created = await bankAccountService.createForUser(
      userId,
      data,
      actorId
    );
    return bankAccountMapper.toPublic(created);
  }

  const updated = await bankAccountService.updateForUser(userId, data, actorId);
  return bankAccountMapper.toPublic(updated);
}

export default {
  async getWorkspace(req, res) {
    const startedAt = nowMs();
    try {
      const workspace = await profileWorkspaceService.getWorkspace(
        req.params.id,
        req.user
      );
      const latencyMs = observeAndLog(
        'workspace',
        req.id,
        req.params.id,
        startedAt
      );
      incProfileWorkspaceLoad('success');
      observeProfileWorkspaceLoadDuration(latencyMs / 1000);
      return res.json(workspace);
    } catch (err) {
      const latencyMs = observeAndLog(
        'workspace',
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      incProfileWorkspaceLoad('error');
      observeProfileWorkspaceLoadDuration(latencyMs / 1000);
      return sendWorkspaceError(req, res, err, 404);
    }
  },

  async updatePersonal(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'personal';
    try {
      await userService.updateUser(req.params.id, req.body, req.user.id);
      const user = await userService.getUser(req.params.id);
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err, 404);
    }
  },

  async upsertPassport(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'passport';
    try {
      const existing = await passportService.getByUser(req.params.id);
      if (existing)
        await passportService.removeByUser(req.params.id, req.user.id);
      const passport = await passportService.createForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ passport: passportMapper.toPublic(passport) });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async upsertInn(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'inn';
    try {
      const inn = await updateInn(req.params.id, req.body.number, req.user.id);
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ inn });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async upsertSnils(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'snils';
    try {
      const snils = await updateSnils(
        req.params.id,
        req.body.number,
        req.user.id
      );
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ snils });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async upsertBankAccount(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'bank_account';
    try {
      const account = await updateBankAccount(
        req.params.id,
        req.body,
        req.user.id
      );
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ account });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async upsertAddress(req, res) {
    if (!ensureValid(req, res)) return;
    const type = String(req.params.type || '').toUpperCase();
    if (!ADDRESS_TYPES.has(type)) {
      return sendWorkspaceError(
        req,
        res,
        { message: 'address_type_not_found' },
        404
      );
    }

    const startedAt = nowMs();
    const section = `address_${type.toLowerCase()}`;
    try {
      const address = await updateAddress(
        req.params.id,
        type,
        req.body,
        req.user.id
      );
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ address });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async checkTaxation(req, res) {
    const startedAt = nowMs();
    const section = 'taxation_check';
    try {
      const source = req.query.source || req.body?.source;
      const opts = {
        dadata: !source || source === 'dadata' || source === 'all',
        fns: !source || source === 'fns' || source === 'all',
      };
      const preview = await taxationService.previewForUser(req.params.id, opts);
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ preview: taxationMapper.toPublic(preview) });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async upsertTaxation(req, res) {
    const startedAt = nowMs();
    const section = 'taxation';
    try {
      const taxation = await taxationService.updateForUser(
        req.params.id,
        req.user.id
      );
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({ taxation: taxationMapper.toPublic(taxation) });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async updateRoles(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'roles';
    try {
      const desiredRoles = new Set(req.body.roles || []);
      const selectedFhmoRoles = [...desiredRoles].filter((alias) =>
        FHMO_STAFF_ROLES.includes(alias)
      );
      if (selectedFhmoRoles.length > 1) {
        return sendWorkspaceError(
          req,
          res,
          {
            code: 'invalid_fhmo_roles',
            status: 422,
            details: {
              max_fhmo_roles: 1,
              selected_roles: selectedFhmoRoles,
            },
          },
          422,
          [
            {
              field: 'roles',
              code: 'invalid_fhmo_roles',
              message:
                'Для сотрудника Федерации можно выбрать только одну должность',
            },
          ]
        );
      }

      const user = await userService.getUser(req.params.id);
      const currentRoles = new Set(
        (user.Roles || []).map((role) => role.alias)
      );

      const toAdd = [...desiredRoles].filter(
        (alias) => !currentRoles.has(alias)
      );
      const toRemove = [...currentRoles].filter(
        (alias) => !desiredRoles.has(alias)
      );

      for (const alias of toAdd) {
        await userService.assignRole(req.params.id, alias, req.user.id);
      }
      for (const alias of toRemove) {
        await userService.removeRole(req.params.id, alias, req.user.id);
      }

      const updatedUser = await userService.getUser(req.params.id);
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({
        roles: (updatedUser.Roles || []).map((role) => ({
          alias: role.alias,
          name: role.name,
        })),
      });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },

  async updateSportSchools(req, res) {
    if (!ensureValid(req, res)) return;
    const startedAt = nowMs();
    const section = 'sport_schools';
    try {
      const desiredClubs = new Set(req.body.club_ids || []);
      const desiredTeams = new Set(req.body.team_ids || []);

      const existingClubs = await clubUserService.listUserClubs(req.params.id);
      const existingClubIds = new Set(existingClubs.map((club) => club.id));

      for (const clubId of existingClubIds) {
        if (!desiredClubs.has(clubId)) {
          await clubUserService.removeUserClub(
            req.params.id,
            clubId,
            req.user.id
          );
        }
      }
      for (const clubId of desiredClubs) {
        if (!existingClubIds.has(clubId)) {
          await clubUserService.addUserClub(req.params.id, clubId, req.user.id);
        }
      }

      const currentTeams = await teamService.listUserTeams(req.params.id);
      const currentTeamIds = new Set(currentTeams.map((team) => team.id));

      for (const teamId of currentTeamIds) {
        if (!desiredTeams.has(teamId)) {
          await teamService.removeUserTeam(req.params.id, teamId, req.user.id);
        }
      }
      for (const teamId of desiredTeams) {
        if (!currentTeamIds.has(teamId)) {
          await teamService.addUserTeam(req.params.id, teamId, req.user.id);
        }
      }

      const [clubs, teams] = await Promise.all([
        clubUserService.listUserClubs(req.params.id),
        teamService.listUserTeams(req.params.id),
      ]);

      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt
      );
      incProfileSectionUpdate(section, 'success');
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return res.json({
        sport_school_links: {
          clubs: clubs.map(clubMapper.toPublic),
          teams: teams.map(teamMapper.toPublic),
        },
      });
    } catch (err) {
      const latencyMs = observeAndLog(
        section,
        req.id,
        req.params.id,
        startedAt,
        'warn'
      );
      const code = toErrorCode(err);
      incProfileSectionUpdate(section, 'error');
      incProfileSectionUpdateError(section, code);
      observeProfileSectionUpdateDuration(section, latencyMs / 1000);
      return sendWorkspaceError(req, res, err);
    }
  },
};
