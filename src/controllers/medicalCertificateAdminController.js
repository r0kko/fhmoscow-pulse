import { validationResult } from 'express-validator';

import medicalCertificateService from '../services/medicalCertificateService.js';
import medicalCertificateMapper from '../mappers/medicalCertificateMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const { page = '1', limit = '20', role } = req.query;
    const { rows, count } = await medicalCertificateService.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      role,
    });
    return res.json({
      certificates: rows.map(medicalCertificateMapper.toPublic),
      total: count,
    });
  },

  async listByRole(req, res) {
    try {
      const data = await medicalCertificateService.listByRole(req.params.alias);
      const judges = data.map((j) => ({
        user: {
          id: j.user.id,
          last_name: j.user.last_name,
          first_name: j.user.first_name,
          patronymic: j.user.patronymic,
          birth_date: j.user.birth_date,
        },
        certificates: j.certificates.map((c) =>
          medicalCertificateMapper.toPublic(c)
        ),
      }));
      return res.json({ judges });
    } catch (err) {
      return sendError(res, err);
    }
  },

  async get(req, res) {
    try {
      const cert = await medicalCertificateService.getById(req.params.id);
      return res.json({ certificate: medicalCertificateMapper.toPublic(cert) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const cert = await medicalCertificateService.createForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res
        .status(201)
        .json({ certificate: medicalCertificateMapper.toPublic(cert) });
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
      const cert = await medicalCertificateService.updateForUser(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ certificate: medicalCertificateMapper.toPublic(cert) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async updateById(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const cert = await medicalCertificateService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      return res.json({ certificate: medicalCertificateMapper.toPublic(cert) });
    } catch (err) {
      return sendError(res, err, 404);
    }
  },

  async remove(req, res) {
    try {
      await medicalCertificateService.remove(req.params.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
