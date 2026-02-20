import crypto from 'crypto';

import { validationResult } from 'express-validator';

import logger from '../../logger.js';
import userService from '../services/userService.js';
import passportService from '../services/passportService.js';
import userMapper from '../mappers/userMapper.js';
import passportMapper from '../mappers/passportMapper.js';
import emailService from '../services/emailService.js';
import { sendError } from '../utils/api.js';

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export default {
  async list(req, res) {
    const {
      search = '',
      page = '1',
      limit = '20',
      sort = 'last_name',
      order = 'asc',
      status = '',
      role = '',
    } = req.query;
    const normalizedPage = normalizePage(page);
    const normalizedLimit = normalizeLimit(limit);
    const { rows, count } = await userService.listUsers({
      search,
      page: normalizedPage,
      limit: normalizedLimit,
      sort,
      order,
      status,
      role,
    });
    return res.json({
      users: userMapper.toPublicArray(rows),
      total: count,
      meta: {
        total: count,
        page: normalizedPage,
        pages: Math.max(1, Math.ceil(count / Math.max(normalizedLimit, 1))),
        limit: normalizedLimit,
      },
    });
  },

  async get(req, res) {
    try {
      const user = await userService.getUser(req.params.id);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
  async create(req, res) {
    // Generate a strong temporary password server-side
    const tempPassword = generateTempPassword();
    const payload = {
      ...req.body,
      password: tempPassword,
      password_change_required: true,
    };
    try {
      const user = await userService.createUser(payload, req.user.id);
      const delivery = await sendInviteAndBuildDelivery(user, tempPassword, {
        operation: 'user_create',
        requestId: req.id || null,
      });
      return res
        .status(201)
        .json({ user: userMapper.toPublic(user), delivery });
    } catch (err) {
      // Typical cases: phone_exists, email_exists, user_exists, invalid_* (400)
      return sendError(res, err, 400);
    }
  },

  async update(req, res) {
    try {
      const user = await userService.updateUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async resendInvite(req, res) {
    const tempPassword = generateTempPassword();
    try {
      const user = await userService.setTemporaryPassword(
        req.params.id,
        tempPassword,
        req.user.id
      );
      const delivery = await sendInviteAndBuildDelivery(user, tempPassword, {
        operation: 'user_invite_resend',
        requestId: req.id || null,
      });
      return res.json({ user: userMapper.toPublic(user), delivery });
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async block(req, res) {
    try {
      const user = await userService.setStatus(
        req.params.id,
        'INACTIVE',
        req.user.id
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async unblock(req, res) {
    try {
      const user = await userService.setStatus(
        req.params.id,
        'ACTIVE',
        req.user.id
      );
      const notification = await sendActivationEmailSafe(user, {
        operation: 'user_unblock',
        requestId: req.id || null,
      });
      const body = { user: userMapper.toPublic(user) };
      if (notification) body.notification = notification;
      return res.json(body);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async approve(req, res) {
    try {
      const user = await userService.setStatus(
        req.params.id,
        'ACTIVE',
        req.user.id
      );
      const notification = await sendActivationEmailSafe(user, {
        operation: 'user_approve',
        requestId: req.id || null,
      });
      const body = { user: userMapper.toPublic(user) };
      if (notification) body.notification = notification;
      return res.json(body);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async resetPassword(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await userService.resetPassword(
        req.params.id,
        req.body.password,
        req.user.id
      );
      await userService.bumpTokenVersion(req.params.id);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async assignRole(req, res) {
    try {
      const user = await userService.assignRole(
        req.params.id,
        req.params.roleAlias,
        req.user.id
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async removeRole(req, res) {
    try {
      const user = await userService.removeRole(
        req.params.id,
        req.params.roleAlias,
        req.user.id
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async addPassport(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const passport = await passportService.createForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res
        .status(201)
        .json({ passport: passportMapper.toPublic(passport) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async getPassport(req, res) {
    try {
      const passport = await passportService.getByUser(req.params.id);
      if (!passport)
        return res.status(404).json({ error: 'passport_not_found' });
      return res.json({ passport: passportMapper.toPublic(passport) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async deletePassport(req, res) {
    try {
      await passportService.removeByUser(req.params.id);
      return res.status(204).send();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};

// Local helper: generate password with letters, digits, and symbols
function generateTempPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  // Avoid HTML-problematic ampersand to ensure safe email rendering
  const symbols = '!@#$%^*';
  const all = upper + lower + digits + symbols;

  // Ensure at least one from each required group (letter+digit min, symbols optional)
  const picks = [
    upper.charAt(crypto.randomInt(0, upper.length)),
    lower.charAt(crypto.randomInt(0, lower.length)),
    digits.charAt(crypto.randomInt(0, digits.length)),
    symbols.charAt(crypto.randomInt(0, symbols.length)),
  ];
  for (let i = picks.length; i < length; i++) {
    picks.push(all.charAt(crypto.randomInt(0, all.length)));
  }
  // Shuffle
  for (let i = picks.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }
  return picks.join('');
}

function normalizePage(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(parsed, MAX_LIST_LIMIT);
}

async function sendActivationEmailSafe(
  user,
  { operation = 'user_status_activate', requestId = null } = {}
) {
  try {
    await emailService.sendAccountActivatedEmail(user);
    return null;
  } catch (err) {
    logger.warn('Account activation email failed', {
      operation,
      request_id: requestId,
      user_id: user?.id || null,
      reason: err?.code || err?.message || 'activation_email_failed',
    });
    return {
      status: 'failed',
      reason: 'activation_email_failed',
    };
  }
}

function mapDeliveryStatus(result) {
  if (result?.delivered === true) return 'sent';
  if (result?.accepted === true) return 'queued';
  if (result?.reason === 'duplicate') return 'queued';
  return 'failed';
}

async function sendInviteAndBuildDelivery(
  user,
  tempPassword,
  { operation = 'user_create', requestId = null } = {}
) {
  const base = {
    invited: false,
    channel: 'email',
    status: 'failed',
  };
  try {
    const result = await emailService.sendUserCreatedByAdminEmail(
      user,
      tempPassword
    );
    const status = mapDeliveryStatus(result);
    if (status === 'sent' || status === 'queued') {
      return {
        invited: true,
        channel: 'email',
        status,
      };
    }
    logger.warn('User invite delivery failed', {
      operation,
      request_id: requestId,
      user_id: user?.id || null,
      reason: result?.reason || 'unknown',
    });
    return { ...base, reason: String(result?.reason || 'delivery_failed') };
  } catch (err) {
    logger.warn('User invite delivery exception', {
      operation,
      request_id: requestId,
      user_id: user?.id || null,
      reason: err?.code || err?.message || 'delivery_exception',
    });
    return { ...base, reason: 'delivery_exception' };
  }
}
