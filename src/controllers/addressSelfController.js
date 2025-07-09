import { validationResult } from 'express-validator';

import addressService from '../services/addressService.js';
import addressMapper from '../mappers/addressMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const addr = await addressService.createForUser(
        req.user.id,
        req.params.type,
        req.body,
        req.user.id
      );
      return res.status(201).json({ address: addressMapper.toPublic(addr) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const addr = await addressService.updateForUser(
        req.user.id,
        req.params.type,
        req.body,
        req.user.id
      );
      return res.json({ address: addressMapper.toPublic(addr) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await addressService.removeForUser(
        req.user.id,
        req.params.type,
        req.user.id
      );
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
