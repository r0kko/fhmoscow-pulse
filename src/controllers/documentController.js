import { validationResult } from 'express-validator';

import documentService from '../services/documentService.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const documents = await documentService.listByUser(req.user.id);
    res.json({ documents });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const payload = { ...req.body };
      if (req.file) payload.file = req.file;
      const document = await documentService.create(payload, req.user.id);
      res.status(201).json({ document });
    } catch (err) {
      sendError(res, err);
    }
  },

  async sign(req, res) {
    try {
      await documentService.sign(req.user, req.params.id);
      res.json({ signed: true });
    } catch (err) {
      sendError(res, err);
    }
  },

  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const document = await documentService.update(
        req.params.id,
        req.body,
        req.user.id
      );
      res.json({ document });
    } catch (err) {
      sendError(res, err);
    }
  },

  async remove(req, res) {
    try {
      await documentService.remove(req.params.id, req.user.id);
      res.status(204).end();
    } catch (err) {
      sendError(res, err);
    }
  },
};
