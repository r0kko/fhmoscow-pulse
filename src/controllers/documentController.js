import { validationResult } from 'express-validator';

import documentService from '../services/documentService.js';
import { sendError } from '../utils/api.js';

export default {
  async list(req, res) {
    const documents = await documentService.listByUser(req.user.id);
    res.json({ documents });
  },

  async listPendingSignatures(req, res) {
    try {
      const documents = await documentService.listPendingSimpleSignatures(
        req.user.id
      );
      res.json({ documents });
    } catch (err) {
      sendError(res, err);
    }
  },

  async sendPendingSignatureCode(req, res) {
    try {
      await documentService.sendPendingSimpleSignatureCode(req.user);
      res.json({ message: 'sent' });
    } catch (err) {
      sendError(res, err);
    }
  },

  async previewPendingSignature(req, res) {
    try {
      const pdf = await documentService.previewPendingSimpleSignature(
        req.user.id,
        req.params.id
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="document-preview.pdf"'
      );
      res.setHeader('Cache-Control', 'no-store');
      return res.end(pdf);
    } catch (err) {
      return sendError(res, err);
    }
  },

  async signPendingSignatures(req, res) {
    try {
      const result = await documentService.signPendingSimpleSignatures(
        req.user,
        req.body?.documentIds,
        req.body?.code || ''
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
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
      const code = req.body?.code || '';
      await documentService.signWithCode(req.user, req.params.id, code);
      res.json({ signed: true });
    } catch (err) {
      sendError(res, err);
    }
  },

  async sendCode(req, res) {
    try {
      await documentService.sendSignCode(req.user, req.params.id);
      res.json({ message: 'sent' });
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
