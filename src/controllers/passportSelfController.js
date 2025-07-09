import { validationResult } from 'express-validator';

import passportService from '../services/passportService.js';
import passportMapper from '../mappers/passportMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const passport = await passportService.createForUser(
        req.user.id,
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

  async remove(req, res) {
    try {
      await passportService.removeByUser(req.user.id, req.user.id);
      return res.status(204).send();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
