import { validationResult } from 'express-validator';
import userService from '../services/userService.js';
import userMapper from '../mappers/userMapper.js';

export default {
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const user = await userService.updateUser(req.user.id, req.body);
      return res.json({ user: userMapper.toPublic(user) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
