import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../models/index.js';
import emailVerificationService from '../services/emailVerificationService.js';
import legacyService from '../services/legacyUserService.js';
import userService from '../services/userService.js';
import { ExternalSystem, UserExternalId } from '../models/index.js';
import userMapper from '../mappers/userMapper.js';

export default {
  async start(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'user_exists' });

    const legacy = await legacyService.findByEmail(email);
    if (!legacy) return res.status(404).json({ error: 'not_found' });

    const password = uuidv4();
    const data = {
      email,
      password,
      last_name: legacy.last_name || legacy.last_name,
      first_name: legacy.first_name,
      patronymic: legacy.second_name,
      birth_date: legacy.b_date,
      phone: `7${legacy.phone_cod}${legacy.phone_number}`,
    };
    const user = await userService.createUser(data);

    const system = await ExternalSystem.findOne({ where: { alias: 'HOCKEYMOS' } });
    if (system) {
      await UserExternalId.create({
        id: uuidv4(),
        user_id: user.id,
        external_system_id: system.id,
        external_id: String(legacy.id),
      });
    }

    await emailVerificationService.sendCode(user);

    return res.json({ message: 'code_sent' });
  },

  async finish(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'not_found' });

    try {
      await emailVerificationService.verifyCode(user, code);
      await userService.resetPassword(user.id, password);
      const updated = await user.reload();
      return res.json({ user: userMapper.toPublic(updated) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
