import { validationResult } from 'express-validator';

import bankAccountService from '../services/bankAccountService.js';
import dadataService from '../services/dadataService.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const bank = await dadataService.findBankByBic(req.body.bic);
      if (!bank) return res.status(400).json({ error: 'bank_not_found' });
      const data = {
        number: req.body.number,
        bic: req.body.bic,
        bank_name: bank.value,
        correspondent_account: bank.data.correspondent_account,
        swift: bank.data.swift,
        inn: bank.data.inn,
        kpp: bank.data.kpp,
        address: bank.data.address?.unrestricted_value,
      };
      const acc = await bankAccountService.createForUser(
        req.user.id,
        data,
        req.user.id
      );
      return res.status(201).json({ account: bankAccountMapper.toPublic(acc) });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await bankAccountService.removeForUser(req.user.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
