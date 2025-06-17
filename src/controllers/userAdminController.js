import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';

export default {
  async list(_req, res) {
    const users = await userService.listUsers();
    return res.json({ users: userMapper.toPublicArray(users) });
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
};
