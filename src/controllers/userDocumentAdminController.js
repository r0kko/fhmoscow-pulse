import { validationResult } from 'express-validator';

import documentService from '../services/documentService.js';
import userDocumentMapper from '../mappers/userDocumentMapper.js';

export default {
  async list(req, res) {
    const docs = await documentService.listByUser(req.params.id);
    return res.json({ documents: userDocumentMapper.toPublicArray(docs) });
  },

  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const doc = await documentService.createForUser(
        req.params.id,
        req.body.document,
        {
          signing_date: req.body.signing_date,
          valid_until: req.body.valid_until,
        },
        req.user.id
      );
      return res
        .status(201)
        .json({ document: userDocumentMapper.toPublic(doc) });
    } catch (err) {
      const notFound = [
        'user_not_found',
        'document_not_found',
        'status_not_found',
      ];
      const status = notFound.includes(err.message) ? 404 : 400;
      return res.status(status).json({ error: err.message });
    }
  },

  async remove(req, res) {
    try {
      await documentService.remove(req.params.docId);
      return res.status(204).end();
    } catch (err) {
      return res.status(404).json({ error: err.message });
    }
  },
};
