import documentService from '../services/documentService.js';
import { sendError } from '../utils/api.js';

export default {
  async list(_req, res) {
    try {
      const documents = await documentService.listAll();
      res.json({ documents });
    } catch (err) {
      sendError(res, err);
    }
  },
  async downloadConsent(req, res) {
    try {
      const pdf = await documentService.generatePersonalDataConsent(
        req.params.id
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="consent.pdf"'
      );
      return res.end(pdf);
    } catch (err) {
      return sendError(res, err, 404);
    }
  },
  async requestSignature(req, res) {
    try {
      const status = await documentService.requestSignature(
        req.params.id,
        req.user.id
      );
      res.json({ status });
    } catch (err) {
      sendError(res, err);
    }
  },
  async uploadSigned(req, res) {
    try {
      const result = await documentService.uploadSignedFile(
        req.params.id,
        req.file,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  },
  async regenerate(req, res) {
    try {
      const result = await documentService.regenerate(
        req.params.id,
        req.user.id
      );
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  },
};
