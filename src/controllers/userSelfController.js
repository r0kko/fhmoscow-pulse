import { validationResult } from 'express-validator';

import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await userService.updateUser(
        req.user.id,
        req.body,
        req.user.id
      );
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
