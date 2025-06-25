import { validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../models/index.js';
import emailVerificationService from '../services/emailVerificationService.js';
import legacyService from '../services/legacyUserService.js';
import userService from '../services/userService.js';
import innService from '../services/innService.js';
import snilsService from '../services/snilsService.js';
import passportService from '../services/passportService.js';
import bankAccountService from '../services/bankAccountService.js';
import dadataService from '../services/dadataService.js';
import authService from '../services/authService.js';
import { ExternalSystem, UserExternalId } from '../models/index.js';
import userMapper from '../mappers/userMapper.js';
import { setRefreshCookie } from '../utils/cookie.js';

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
      last_name: legacy.last_name,
      first_name: legacy.first_name,
      patronymic: legacy.second_name,
      birth_date: legacy.b_date,
      phone: `7${legacy.phone_cod}${legacy.phone_number}`,
    };
    let user;
    try {
      user = await userService.createUser(data);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      if (legacy.sv_ops) {
        await snilsService.create(user.id, legacy.sv_ops, user.id);
      }
      if (legacy.sv_inn) {
        await innService.create(user.id, legacy.sv_inn, user.id);
      }
      if (legacy.ps_ser && legacy.ps_num) {
        await passportService.createForUser(
          user.id,
          {
            document_type: 'CIVIL',
            country: 'RU',
            series: String(legacy.ps_ser),
            number: String(legacy.ps_num).padStart(6, '0'),
            issue_date: legacy.ps_date,
            issuing_authority: legacy.ps_org,
            issuing_authority_code: legacy.ps_pdrz,
          },
          user.id
        );
      }
      if (legacy.bank_rs && legacy.bik_bank) {
        const bank = await dadataService.findBankByBic(String(legacy.bik_bank));
        const accData = {
          number: String(legacy.bank_rs),
          bic: String(legacy.bik_bank).padStart(9, '0'),
          bank_name: bank?.value,
          correspondent_account: bank?.data.correspondent_account,
          swift: bank?.data.swift,
          inn: bank?.data.inn,
          kpp: bank?.data.kpp,
          address: bank?.data.address?.unrestricted_value,
        };
        await bankAccountService.createForUser(user.id, accData, user.id);
      }
    } catch {
      // ignore import errors
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
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, code, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'not_found' });

    try {
      await emailVerificationService.verifyCode(
        user,
        code,
        'REGISTRATION_STEP_1'
      );
      await userService.resetPassword(user.id, password);
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
      return res.status(400).json({ error: err.message });
    }
  },
};
