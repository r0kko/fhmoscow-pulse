import { validationResult } from 'express-validator';

import bankAccountService from '../services/bankAccountService.js';
import dadataService from '../services/dadataService.js';
import bankAccountMapper from '../mappers/bankAccountMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async get(req, res) {
    try {
      const acc = await bankAccountService.getByUser(req.params.id);
      if (!acc) {
        return res.status(404).json({ error: 'bank_account_not_found' });
      }
      return res.json({ account: bankAccountMapper.toPublic(acc) });
    } catch (err) {
      return sendError(res, err);
    }
  },

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
        req.params.id,
        data,
        req.user.id
      );
      return res.status(201).json({ account: bankAccountMapper.toPublic(acc) });
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
      const acc = await bankAccountService.updateForUser(
        req.params.id,
        data,
        req.user.id
      );
      return res.json({ account: bankAccountMapper.toPublic(acc) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await bankAccountService.removeForUser(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
