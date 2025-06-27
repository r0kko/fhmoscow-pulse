import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import passportService from '../services/passportService.js';
import userMapper from '../mappers/userMapper.js';
import passportMapper from '../mappers/passportMapper.js';

export default {
  async list(req, res) {
    const {
      search = '',
      page = '1',
      limit = '20',
      sort = 'last_name',
      order = 'asc',
    } = req.query;
    const { rows, count } = await userService.listUsers({
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      order,
    });
    return res.json({
      users: userMapper.toPublicArray(rows),
      total: count,
    });
  },

  async get(req, res) {
    try {
      const user = await userService.getUser(req.params.id);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const user = await userService.createUser(req.body);
    return res.status(201).json({ user: userMapper.toPublic(user) });
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async block(req, res) {
    try {
      const user = await userService.setStatus(req.params.id, 'INACTIVE');
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async unblock(req, res) {
    try {
      const user = await userService.setStatus(req.params.id, 'ACTIVE');
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async approve(req, res) {
    try {
      const user = await userService.setStatus(req.params.id, 'ACTIVE');
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
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
        req.body.password
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async assignRole(req, res) {
    try {
      const user = await userService.assignRole(
        req.params.id,
        req.params.roleAlias
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async removeRole(req, res) {
    try {
      const user = await userService.removeRole(
        req.params.id,
        req.params.roleAlias
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
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
      const status = err.message === 'user_not_found' ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },

  async getPassport(req, res) {
    try {
      const passport = await passportService.getByUser(req.params.id);
      if (!passport)
        return res.status(404).json({ error: 'passport_not_found' });
      return res.json({ passport: passportMapper.toPublic(passport) });
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },

  async deletePassport(req, res) {
    try {
      await passportService.removeByUser(req.params.id);
      return res.status(204).send();
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },
};
