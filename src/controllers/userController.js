import User from '../models/user.js';
import userMapper from '../mappers/userMapper.js';

export default {
  /**
   * Get list of users
   * @param {import('express').Request} _req
   * @param {import('express').Response} res
   */
  async list(_req, res) {
    const users = await User.findAll();
    const sanitized = userMapper.toPublicArray(users);
    res.locals.body = { users: sanitized };
    return res.json({ users: sanitized });
  },

  /**
   * Get user by id
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async get(req, res) {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const sanitized = userMapper.toPublic(user);
    res.locals.body = { user: sanitized };
    return res.json({ user: sanitized });
  },
};
