import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../models/index.js';
import emailVerificationService from '../services/emailVerificationService.js';
import legacyService from '../services/legacyUserService.js';
import userService from '../services/userService.js';
import sexService from '../services/sexService.js';
import authService from '../services/authService.js';
import passportService from '../services/passportService.js';
import bankAccountService from '../services/bankAccountService.js';
import addressService from '../services/addressService.js';
// legacy data is fetched but not stored automatically
import { ExternalSystem, UserExternalId } from '../models/index.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie } from '../utils/cookie.js';
import { sendError } from '../utils/api.js';

export default {
  async start(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const email = String(req.body.email).trim().toLowerCase();
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'user_exists' });

    const legacy = await legacyService.findByEmail(email);
    if (!legacy) return res.status(404).json({ error: 'not_found' });

    const password = uuidv4();
    const data = {
      email,
      password,
      last_name: legacy.last_name,
      first_name: legacy.first_name,
      patronymic: legacy.second_name,
      birth_date: legacy.b_date,
      // phone_number in legacy DB may contain leading zeros
      // ensure both parts remain strings when concatenated
      phone: `7${String(legacy.phone_cod)}${String(legacy.phone_number)}`,
    };
    let user;
    try {
      const male = await sexService.getByAlias('MALE');
      user = await userService.createUser({ ...data, sex_id: male.id });
    } catch (err) {
      return sendError(res, err);
    }

    const system = await ExternalSystem.findOne({
      where: { alias: 'HOCKEYMOS' },
    });
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
      // Normalize password validation error to a single code for client UX
      const items = errors.array();
      const weakPwd = items.find(
        (e) => e.path === 'password' && e.msg === 'weak_password'
      );
      if (weakPwd) {
        return res.status(400).json({ error: 'weak_password' });
      }
      return res.status(400).json({ errors: items });
    }
    const email = String(req.body.email).trim().toLowerCase();
    const { code, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'not_found' });

    try {
      await emailVerificationService.verifyCode(
        user,
        code,
        'REGISTRATION_STEP_1'
      );
      await userService.resetPassword(user.id, password, user.id);
      await addressService.fetchFromLegacy(user.id);
      await bankAccountService.fetchFromLegacy(user.id);
      await passportService.fetchFromLegacy(user.id);
      await user.increment('token_version');
      const updated = await user.reload();
      const roles = (await updated.getRoles({ attributes: ['alias'] })).map(
        (r) => r.alias
      );
      const { accessToken, refreshToken } = authService.issueTokens(updated);
      setRefreshCookie(res, refreshToken);
      return res.json({
        access_token: accessToken,
        user: userMapper.toPublic(updated),
        roles,
      });
    } catch (err) {
      return sendError(res, err);
    }
  },
};
