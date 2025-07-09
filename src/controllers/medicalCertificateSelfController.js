import { validationResult } from 'express-validator';

import medicalCertificateService from '../services/medicalCertificateService.js';
import medicalCertificateMapper from '../mappers/medicalCertificateMapper.js';
import { sendError } from '../utils/api.js';

export default {
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const cert = await medicalCertificateService.createForUser(
        req.user.id,
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

  async remove(req, res) {
    try {
      await medicalCertificateService.removeForUser(req.user.id, req.user.id);
      return res.status(204).end();
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
};
